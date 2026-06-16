using System.Diagnostics;
using CodeRehab.DotNetRunner.Execution;
using CodeRehab.DotNetRunner.Models;

namespace CodeRehab.DotNetRunner.Services;

public sealed class DotNetExecutionService
{
    private const int BuildTimeoutMs = 120_000;

    private readonly TemporaryWorkspaceService _workspaceService;
    private readonly TemplateProvider _templates;
    private readonly HarnessCatalog _harnesses;
    private readonly ProcessRunner _processRunner;
    private readonly ResultParser _resultParser;

    public DotNetExecutionService(
        TemporaryWorkspaceService workspaceService,
        TemplateProvider templates,
        HarnessCatalog harnesses,
        ProcessRunner processRunner,
        ResultParser resultParser)
    {
        _workspaceService = workspaceService;
        _templates = templates;
        _harnesses = harnesses;
        _processRunner = processRunner;
        _resultParser = resultParser;
    }

    public async Task<RunnerResult> ExecuteAsync(RunnerRequest request, CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();

        if (!string.Equals(request.Language, "csharp", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(request.Language, "cs", StringComparison.OrdinalIgnoreCase))
        {
            return SingleFailure(
                RunnerStatuses.ConfigurationError,
                "Unsupported language",
                ResultLocalizer.Localize("Only C# is supported.", request.EffectiveLocale),
                testsTotal: 1,
                stopwatch.ElapsedMilliseconds,
                request.EffectiveLocale);
        }

        if (!_harnesses.Contains(request.TaskId))
        {
            return SingleFailure(
                RunnerStatuses.ConfigurationError,
                "Missing harness",
                ResultLocalizer.Localize("This task does not have a test harness yet.", request.EffectiveLocale),
                testsTotal: 1,
                stopwatch.ElapsedMilliseconds,
                request.EffectiveLocale);
        }

        var expectedTests = _harnesses.GetExpectedTestCount(request.TaskId);
        var workspace = await _workspaceService.CreateAsync(cancellationToken);

        try
        {
            await WriteGeneratedProjectAsync(workspace, request, cancellationToken);

            var restore = await _processRunner.RunAsync(
                "dotnet",
                new[] { "restore", "Runner.csproj" },
                workspace,
                BuildTimeoutMs,
                cancellationToken);

            if (restore.ExitCode != 0 || restore.TimedOut)
            {
                return CompileError(restore, expectedTests, stopwatch.ElapsedMilliseconds, request.EffectiveLocale);
            }

            var build = await _processRunner.RunAsync(
                "dotnet",
                new[] { "build", "Runner.csproj", "--no-restore", "--nologo", "-v", "minimal" },
                workspace,
                BuildTimeoutMs,
                cancellationToken);

            if (build.ExitCode != 0 || build.TimedOut)
            {
                return CompileError(build, expectedTests, stopwatch.ElapsedMilliseconds, request.EffectiveLocale);
            }

            var run = await _processRunner.RunAsync(
                "dotnet",
                new[] { "run", "--project", "Runner.csproj", "--no-build" },
                workspace,
                request.EffectiveTimeoutMs,
                cancellationToken);

            if (run.TimedOut)
            {
                return new RunnerResult
                {
                    Status = RunnerStatuses.Timeout,
                    Passed = false,
                    TestsPassed = 0,
                    TestsTotal = expectedTests,
                    CompileOutput = "",
                    RuntimeOutput = "",
                    Error = ResultLocalizer.Localize("Execution timed out", request.EffectiveLocale),
                    DurationMs = stopwatch.ElapsedMilliseconds,
                    ExitCode = run.ExitCode,
                    Tests = new[]
                    {
                        new TestResult(
                            ResultLocalizer.Localize("Code timed out", request.EffectiveLocale),
                            false,
                            ResultLocalizer.Localize("The check did not finish within " + request.EffectiveTimeoutMs + "ms. This is usually a stuck await, .Result, Wait, or missed cancellation.", request.EffectiveLocale))
                    }
                };
            }

            var tests = _resultParser.TryParseTests(run.Stdout);
            if (tests is not null)
            {
                var localizedTests = ResultLocalizer.LocalizeTests(tests, request.EffectiveLocale);
                return RunnerResult.FromTests(
                    localizedTests,
                    _resultParser.RemoveResultLine(run.Stdout),
                    stopwatch.ElapsedMilliseconds,
                    run.ExitCode);
            }

            return new RunnerResult
            {
                Status = RunnerStatuses.RuntimeError,
                Passed = false,
                TestsPassed = 0,
                TestsTotal = expectedTests,
                RuntimeOutput = TrimOutput(run.CombinedOutput),
                Error = run.ExitCode == 0 ? "Runner did not emit a test result." : "Execution failed",
                DurationMs = stopwatch.ElapsedMilliseconds,
                ExitCode = run.ExitCode,
                Tests = new[]
                {
                    new TestResult(
                        ResultLocalizer.Localize("Compilation or execution", request.EffectiveLocale),
                        false,
                        TrimOutput(run.CombinedOutput))
                }
            };
        }
        finally
        {
            await _workspaceService.CleanupAsync(workspace, request.Debug, cancellationToken);
        }
    }

    private async Task WriteGeneratedProjectAsync(
        string workspace,
        RunnerRequest request,
        CancellationToken cancellationToken)
    {
        await File.WriteAllTextAsync(
            Path.Combine(workspace, "Runner.csproj"),
            await _templates.ReadGeneratedProjectTemplateAsync("Runner.csproj.template", cancellationToken),
            cancellationToken);

        await File.WriteAllTextAsync(
            Path.Combine(workspace, "CommonUsings.cs"),
            await _templates.ReadGeneratedProjectTemplateAsync("CommonUsings.cs", cancellationToken),
            cancellationToken);

        await File.WriteAllTextAsync(
            Path.Combine(workspace, "Support.cs"),
            await _templates.ReadGeneratedProjectTemplateAsync("Support.cs", cancellationToken),
            cancellationToken);

        await File.WriteAllTextAsync(
            Path.Combine(workspace, "Program.cs"),
            await _templates.ReadGeneratedProjectTemplateAsync("Program.cs", cancellationToken),
            cancellationToken);

        await File.WriteAllTextAsync(
            Path.Combine(workspace, "Harness.cs"),
            await _templates.ReadHarnessAsync(request.TaskId, cancellationToken),
            cancellationToken);

        await File.WriteAllTextAsync(
            Path.Combine(workspace, "UserSolution.cs"),
            request.UserCode,
            cancellationToken);
    }

    private static RunnerResult CompileError(ProcessRunResult process, int testsTotal, long durationMs, string locale) =>
        new()
        {
            Status = RunnerStatuses.CompileError,
            Passed = false,
            TestsPassed = 0,
            TestsTotal = testsTotal,
            CompileOutput = TrimOutput(process.CombinedOutput),
            RuntimeOutput = "",
            Error = ResultLocalizer.Localize(process.TimedOut ? "Compilation timed out" : "Compilation failed", locale),
            DurationMs = durationMs,
            ExitCode = process.ExitCode,
            Tests = new[]
            {
                new TestResult(ResultLocalizer.Localize("Compilation", locale), false, TrimOutput(process.CombinedOutput))
            }
        };

    private static RunnerResult SingleFailure(
        string status,
        string error,
        string message,
        int testsTotal,
        long durationMs,
        string locale) =>
        new()
        {
            Status = status,
            Passed = false,
            TestsPassed = 0,
            TestsTotal = testsTotal,
            Error = error,
            DurationMs = durationMs,
            Tests = new[]
            {
                new TestResult(ResultLocalizer.Localize("Check configuration", locale), false, message)
            }
        };

    private static string TrimOutput(string output)
    {
        if (string.IsNullOrWhiteSpace(output))
        {
            return "dotnet failed without diagnostic output.";
        }

        return string.Join(
            Environment.NewLine,
            output.Trim().Split(new[] { "\r\n", "\n" }, StringSplitOptions.None).TakeLast(24));
    }
}
