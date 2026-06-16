namespace CodeRehab.DotNetRunner.Execution;

public sealed class ProcessRunResult
{
    public int ExitCode { get; init; }

    public string Stdout { get; init; } = "";

    public string Stderr { get; init; } = "";

    public bool TimedOut { get; init; }

    public string CombinedOutput => string.Join(
        Environment.NewLine,
        new[] { Stdout, Stderr }.Where(value => !string.IsNullOrWhiteSpace(value)));
}
