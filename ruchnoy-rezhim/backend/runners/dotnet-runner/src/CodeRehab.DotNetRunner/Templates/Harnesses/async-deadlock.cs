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
            ? Check.Pass("Action does not block a thread while waiting for the warehouse")
            : Check.Fail("Action does not block a thread while waiting for the warehouse", "Get did not return a Task/result quickly. .Result or Wait() is probably still inside."));

        warehouse.Stock.SetResult(new Stock(5, 1));
        var raw = await invokeTask.WaitAsync(TimeSpan.FromSeconds(2));
        if (raw is Task task) await task;
        tests.Add(warehouse.SawCancelableToken
            ? Check.Pass("Request CancellationToken is passed to the warehouse client")
            : Check.Fail("Request CancellationToken is passed to the warehouse client", "Warehouse received CancellationToken.None."));

        var timeoutController = ReflectionTools.CreateWithFields<InventoryController>(("_warehouse", new TimeoutWarehouse()));
        try
        {
            var value = await ReflectionTools.InvokeMaybeAsync(timeoutController, "Get", "sku-2");
            tests.Add(value is ObjectResult objectResult && objectResult.StatusCode == 503
                ? Check.Pass("Warehouse timeout becomes 503")
                : Check.Fail("Warehouse timeout becomes 503", "Expected ObjectResult with StatusCode=503."));
        }
        catch (Exception ex)
        {
            tests.Add(Check.Fail("Warehouse timeout becomes 503", ex.GetType().Name + ": " + ex.Message));
        }
        return tests;
    }
}
