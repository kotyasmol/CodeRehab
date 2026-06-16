public sealed record Stock(int Available, int Reserved);
public sealed class InventoryDto
{
    public string Sku { get; set; } = "";
    public int Available { get; set; }
    public int Reserved { get; set; }
}
public interface IWarehouseClient
{
    Task<Stock?> GetStockAsync(string sku, CancellationToken ct);
}
public sealed class WarehouseSpy : IWarehouseClient
{
    public bool SawCancelableToken;
    public TaskCompletionSource<Stock?> Stock { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public Task<Stock?> GetStockAsync(string sku, CancellationToken ct)
    {
        SawCancelableToken = ct.CanBeCanceled;
        return Stock.Task;
    }
}
public sealed class TimeoutWarehouse : IWarehouseClient
{
    public Task<Stock?> GetStockAsync(string sku, CancellationToken ct) => throw new TimeoutException("warehouse timeout");
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var tests = new List<CheckResult>();
        var warehouse = new WarehouseSpy();
        var controller = ReflectionTools.CreateWithFields<InventoryController>(("_warehouse", warehouse));
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        using var cts = new CancellationTokenSource();
        controller.HttpContext.RequestAborted = cts.Token;

        var invokeTask = Task.Run(() => typeof(InventoryController).GetMethod("Get")!.Invoke(controller, new object[] { "sku-1" }));
        await Task.Delay(80);
        tests.Add(invokeTask.IsCompleted
            ? Check.Pass("Action не блокирует поток на ожидании склада")
            : Check.Fail("Action не блокирует поток на ожидании склада", "Вызов Get не вернул Task/результат быстро. Вероятно, внутри остался .Result или Wait()."));

        warehouse.Stock.SetResult(new Stock(5, 1));
        var raw = await invokeTask.WaitAsync(TimeSpan.FromSeconds(2));
        if (raw is Task task) await task;
        tests.Add(warehouse.SawCancelableToken
            ? Check.Pass("CancellationToken запроса прокинут в warehouse client")
            : Check.Fail("CancellationToken запроса прокинут в warehouse client", "Warehouse получил CancellationToken.None."));

        var timeoutController = ReflectionTools.CreateWithFields<InventoryController>(("_warehouse", new TimeoutWarehouse()));
        try
        {
            var value = await ReflectionTools.InvokeMaybeAsync(timeoutController, "Get", "sku-2");
            tests.Add(value is ObjectResult objectResult && objectResult.StatusCode == 503
                ? Check.Pass("Timeout склада превращается в 503")
                : Check.Fail("Timeout склада превращается в 503", "Ожидался ObjectResult со StatusCode=503."));
        }
        catch (Exception ex)
        {
            tests.Add(Check.Fail("Timeout склада превращается в 503", ex.GetType().Name + ": " + ex.Message));
        }
        return tests;
    }
}
