using System.Text.Json;
using CodeRehab.DotNetRunner.Execution;
using CodeRehab.DotNetRunner.Models;
using CodeRehab.DotNetRunner.Services;

var jsonOptions = new JsonSerializerOptions
{
    PropertyNameCaseInsensitive = true,
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    WriteIndented = false
};

var exitCode = 0;
RunnerResult result;

try
{
    var requestJson = await ReadRequestJsonAsync(args);
    var request = JsonSerializer.Deserialize<RunnerRequest>(requestJson, jsonOptions)
        ?? throw new InvalidOperationException("Request JSON is empty.");

    if (string.IsNullOrWhiteSpace(request.TaskId))
    {
        throw new InvalidOperationException("taskId is required.");
    }

    if (string.IsNullOrWhiteSpace(request.UserCode))
    {
        throw new InvalidOperationException("userCode is required.");
    }

    var service = new DotNetExecutionService(
        new TemporaryWorkspaceService(),
        new TemplateProvider(),
        new HarnessCatalog(),
        new ProcessRunner(),
        new ResultParser());

    result = await service.ExecuteAsync(request);
}
catch (Exception error)
{
    exitCode = 2;
    result = new RunnerResult
    {
        Status = RunnerStatuses.ConfigurationError,
        Passed = false,
        TestsPassed = 0,
        TestsTotal = 1,
        Error = error.Message,
        Tests = new[]
        {
            new TestResult("Runner configuration", false, error.Message)
        }
    };
}

Console.WriteLine(JsonSerializer.Serialize(result, jsonOptions));
return exitCode;

static async Task<string> ReadRequestJsonAsync(string[] args)
{
    if (args.Length == 0)
    {
        return await Console.In.ReadToEndAsync();
    }

    for (var index = 0; index < args.Length; index++)
    {
        switch (args[index])
        {
            case "--request":
            case "--request-file":
            case "-r":
                return await File.ReadAllTextAsync(RequireValue(args, ++index, args[index - 1]));

            case "--json":
            case "-j":
                return RequireValue(args, ++index, args[index - 1]);
        }
    }

    throw new InvalidOperationException(
        "Usage: CodeRehab.DotNetRunner --request request.json | --json '{...}' | < request.json");
}

static string RequireValue(string[] args, int index, string option)
{
    if (index >= args.Length || string.IsNullOrWhiteSpace(args[index]))
    {
        throw new InvalidOperationException(option + " requires a value.");
    }

    return args[index];
}
