using System.Text.Json.Serialization;

namespace CodeRehab.DotNetRunner.Models;

public sealed class RunnerRequest
{
    public string TaskId { get; init; } = "";

    public string Language { get; init; } = "csharp";

    public string UserCode { get; init; } = "";

    public int TimeoutMs { get; init; } = 12_000;

    public bool Debug { get; init; }

    public Dictionary<string, string>? HarnessConfig { get; init; }

    [JsonIgnore]
    public int EffectiveTimeoutMs => TimeoutMs > 0 ? TimeoutMs : 12_000;
}
