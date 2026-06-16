namespace CodeRehab.DotNetRunner.Models;

public sealed class RunnerResult
{
    public string Status { get; init; } = RunnerStatuses.Failed;

    public bool Passed { get; init; }

    public int TestsPassed { get; init; }

    public int TestsTotal { get; init; }

    public string CompileOutput { get; init; } = "";

    public string RuntimeOutput { get; init; } = "";

    public string? Error { get; init; }

    public long DurationMs { get; init; }

    public int? ExitCode { get; init; }

    public IReadOnlyList<TestResult> Tests { get; init; } = Array.Empty<TestResult>();

    public static RunnerResult FromTests(
        IReadOnlyList<TestResult> tests,
        string runtimeOutput,
        long durationMs,
        int exitCode)
    {
        var passed = tests.Count(test => test.Passed);

        var allPassed = tests.Count > 0 && passed == tests.Count;

        return new RunnerResult
        {
            Status = allPassed ? RunnerStatuses.Passed : RunnerStatuses.Failed,
            Passed = allPassed,
            TestsPassed = passed,
            TestsTotal = tests.Count,
            RuntimeOutput = runtimeOutput,
            DurationMs = durationMs,
            ExitCode = exitCode,
            Tests = tests
        };
    }
}
