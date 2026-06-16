namespace CodeRehab.DotNetRunner.Services;

public sealed class HarnessCatalog
{
    private static readonly IReadOnlyDictionary<string, int> ExpectedTestCounts = new Dictionary<string, int>
    {
        ["webhook-idempotency"] = 2,
        ["parallel-order-refresh"] = 2,
        ["quote-timeouts"] = 2,
        ["forgotten-await-email"] = 2,
        ["async-cache-stampede"] = 2,
        ["background-export-status"] = 2,
        ["transaction-outbox"] = 2,
        ["cancellation-leak"] = 2,
        ["async-deadlock"] = 3,
        ["retry-policy"] = 3
    };

    public bool Contains(string taskId) => ExpectedTestCounts.ContainsKey(taskId);

    public int GetExpectedTestCount(string taskId) =>
        ExpectedTestCounts.TryGetValue(taskId, out var count) ? count : 1;
}
