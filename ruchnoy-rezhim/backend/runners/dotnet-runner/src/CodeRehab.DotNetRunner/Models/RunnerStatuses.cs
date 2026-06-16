namespace CodeRehab.DotNetRunner.Models;

public static class RunnerStatuses
{
    public const string Passed = "passed";
    public const string Failed = "failed";
    public const string CompileError = "compile_error";
    public const string RuntimeError = "runtime_error";
    public const string Timeout = "timeout";
    public const string ConfigurationError = "configuration_error";
}
