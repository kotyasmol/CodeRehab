public sealed record PaymentWebhook(string EventId, Guid UserId, decimal Amount);
public sealed class ProcessedPaymentEvent
{
    public string EventId { get; set; } = "";
    public DateTimeOffset ReceivedAt { get; set; }
}
public sealed class DbUpdateException : Exception
{
    public DbUpdateException(string message) : base(message) { }
}
public sealed class FakeDbSet<T> : List<T>
{
    public Func<Task>? BeforeAnyAsync { get; set; }
}
public static class AsyncQueryExtensions
{
    public static async Task<bool> AnyAsync<T>(this IEnumerable<T> source, Func<T, bool> predicate, CancellationToken ct = default)
    {
        if (source is FakeDbSet<T> set && set.BeforeAnyAsync is not null)
            await set.BeforeAnyAsync();
        ct.ThrowIfCancellationRequested();
        return source.Any(predicate);
    }
}
public sealed class BillingDbContext
{
    public FakeDbSet<ProcessedPaymentEvent> ProcessedPaymentEvents { get; } = new();
    public Task SaveChangesAsync(CancellationToken ct = default)
    {
        ct.ThrowIfCancellationRequested();
        var duplicate = ProcessedPaymentEvents.GroupBy(x => x.EventId).FirstOrDefault(x => x.Count() > 1);
        if (duplicate is not null)
            throw new DbUpdateException("Duplicate payment event: " + duplicate.Key);
        return Task.CompletedTask;
    }
}
public interface IUserBalanceClient
{
    Task AddCreditsAsync(Guid userId, decimal amount, CancellationToken ct);
}
public sealed class BalanceClientSpy : IUserBalanceClient
{
    public int AddCalls;
    public Task AddCreditsAsync(Guid userId, decimal amount, CancellationToken ct)
    {
        Interlocked.Increment(ref AddCalls);
        return Task.Delay(20, ct);
    }
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var tests = new List<CheckResult>();
        tests.Add(await SequentialDuplicate());
        tests.Add(await ConcurrentDuplicate());
        return tests;
    }

    private static async Task<CheckResult> SequentialDuplicate()
    {
        var db = new BillingDbContext();
        db.ProcessedPaymentEvents.Add(new ProcessedPaymentEvent { EventId = "evt-1" });
        var balances = new BalanceClientSpy();
        var handler = new PaymentWebhookHandler(db, balances);

        await handler.HandleAsync(new PaymentWebhook("evt-1", Guid.NewGuid(), 10), CancellationToken.None);
        return balances.AddCalls == 0
            ? Check.Pass("Повторный webhook не начисляет баланс")
            : Check.Fail("Повторный webhook не начисляет баланс", "Для уже обработанного eventId был вызван AddCreditsAsync.");
    }

    private static async Task<CheckResult> ConcurrentDuplicate()
    {
        var db = new BillingDbContext();
        var balances = new BalanceClientSpy();
        var handler = new PaymentWebhookHandler(db, balances);
        var entered = 0;
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        db.ProcessedPaymentEvents.BeforeAnyAsync = async () =>
        {
            if (Interlocked.Increment(ref entered) == 2)
                release.SetResult();
            await release.Task.WaitAsync(TimeSpan.FromSeconds(2));
        };

        var payload = new PaymentWebhook("evt-race", Guid.NewGuid(), 20);
        await Task.WhenAll(
            Task.Run(async () => { try { await handler.HandleAsync(payload, CancellationToken.None); } catch (DbUpdateException) { } }),
            Task.Run(async () => { try { await handler.HandleAsync(payload, CancellationToken.None); } catch (DbUpdateException) { } })
        );

        return balances.AddCalls == 1
            ? Check.Pass("Параллельные webhook не дают двойного начисления")
            : Check.Fail("Параллельные webhook не дают двойного начисления", "Ожидался 1 вызов AddCreditsAsync, фактически: " + balances.AddCalls + ".");
    }
}
