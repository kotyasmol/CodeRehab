public sealed class Order
{
    public string PartnerOrderId { get; set; } = "";
    public string Status { get; set; } = "waiting";
}
public sealed class RefreshSummary
{
    public int Updated { get; }
    public int Failed { get; }
    public int Skipped { get; }
    public RefreshSummary(int updated, int failed, int skipped)
    {
        Updated = updated; Failed = failed; Skipped = skipped;
    }
    public override string ToString() => "Updated=" + Updated + ", Failed=" + Failed + ", Skipped=" + Skipped;
}
public interface IOrderRepository
{
    Task<IReadOnlyList<Order>> GetOrdersWaitingForShipmentAsync(CancellationToken ct);
    Task SaveAsync(Order order, CancellationToken ct);
}
public interface IPartnerOrderClient
{
    Task<string> GetStatusAsync(string partnerOrderId, CancellationToken ct);
}
public sealed class OrderRepositorySpy : IOrderRepository
{
    public List<Order> Orders { get; } = Enumerable.Range(1, 5).Select(i => new Order { PartnerOrderId = "p-" + i }).ToList();
    public int SaveCalls;
    public Task<IReadOnlyList<Order>> GetOrdersWaitingForShipmentAsync(CancellationToken ct) => Task.FromResult((IReadOnlyList<Order>)Orders);
    public Task SaveAsync(Order order, CancellationToken ct) { Interlocked.Increment(ref SaveCalls); return Task.CompletedTask; }
}
public sealed class PartnerClientSpy : IPartnerOrderClient
{
    private int _current;
    public int MaxConcurrency;
    public int Calls;
    public async Task<string> GetStatusAsync(string partnerOrderId, CancellationToken ct)
    {
        Interlocked.Increment(ref Calls);
        var now = Interlocked.Increment(ref _current);
        MaxConcurrency = Math.Max(MaxConcurrency, now);
        try
        {
            await Task.Delay(80, ct);
            if (partnerOrderId == "p-3") throw new HttpRequestException("temporary partner failure");
            return "shipped";
        }
        finally
        {
            Interlocked.Decrement(ref _current);
        }
    }
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var repo = new OrderRepositorySpy();
        var partner = new PartnerClientSpy();
        var logger = new TestLogger<OrderStatusRefreshJob>();
        var job = ReflectionTools.CreateWithFields<OrderStatusRefreshJob>(("_orders", repo), ("_partner", partner), ("_logger", logger));
        var tests = new List<CheckResult>();

        RefreshSummary? summary = null;
        try { summary = await job.RunAsync(CancellationToken.None); }
        catch (Exception ex) { tests.Add(Check.Fail("Job не падает из-за одного заказа", ex.GetType().Name + ": " + ex.Message)); }

        if (summary is not null)
        {
            tests.Add(partner.MaxConcurrency > 1
                ? Check.Pass("Запросы к партнеру выполняются конкурентно")
                : Check.Fail("Запросы к партнеру выполняются конкурентно", "MaxConcurrency остался 1: job все еще идет последовательно."));
            tests.Add(summary.Failed == 1 && summary.Updated == 4
                ? Check.Pass("Ошибки отдельных заказов попадают в summary")
                : Check.Fail("Ошибки отдельных заказов попадают в summary", "Ожидалось Updated=4, Failed=1. Фактически: " + summary + "."));
        }

        return tests;
    }
}
