using System.Text.Json.Serialization;

namespace CodeRehab.DotNetRunner.Models;

public sealed class TestResult
{
    public string Name { get; init; } = "";

    public bool Passed { get; init; }

    public string Message { get; init; } = "";

    [JsonConstructor]
    public TestResult(string name, bool passed, string message)
    {
        Name = name;
        Passed = passed;
        Message = message;
    }
}
