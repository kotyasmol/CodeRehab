public sealed record CreateOrder(Guid UserId, IReadOnlyList<string> Items, string RequestId);
public sealed class Order
{
    public Guid Id { get; } = Guid.NewGuid();
    public Guid UserId { get; private set; }
    public IReadOnlyList<string> Items { get; private set; } = Array.Empty<string>();
    public string RequestId { get; set; } = "";
    public static Order Create(Guid userId, IReadOnlyList<string> items) => new() { UserId = userId, Items = items };
}
public sealed class OrderCreated
{
    public Guid OrderId { get; set; }
    public Guid UserId { get; set; }
}
public sealed class OutboxMessage
{
    public string Type { get; set; } = "";
    public string Payload { get; set; } = "";
    public string RequestId { get; set; } = "";
}
public sealed class ShopDbContext
{
    public List<Order> Orders { get; } = new();
    public List<OutboxMessage> OutboxMessages { get; } = new();
    public Task SaveChangesAsync(CancellationToken ct) => Task.CompletedTask;
}
public interface IMessageBus
{
    Task PublishAsync(object message, CancellationToken ct);
}
public sealed class BusSpy : IMessageBus
{
    public int Published;
    public Task PublishAsync(object message, CancellationToken ct) { Published++; return Task.CompletedTask; }
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var db = new ShopDbContext();
        var bus = new BusSpy();
        var handler = ReflectionTools.CreateWithFields<CreateOrderHandler>(("_db", db), ("_bus", bus));
        var command = new CreateOrder(Guid.NewGuid(), new[] { "sku-1" }, "req-1");
        await handler.HandleAsync(command, CancellationToken.None);
        await handler.HandleAsync(command, CancellationToken.None);

        return new List<CheckResult>
        {
            db.OutboxMessages.Count == 1 && bus.Published == 0
                ? Check.Pass("OrderCreated is written to the outbox instead of being published directly")
                : Check.Fail("OrderCreated is written to the outbox instead of being published directly", "Outbox=" + db.OutboxMessages.Count + ", direct publish=" + bus.Published),
            db.Orders.Count == 1
                ? Check.Pass("Repeating a command with the same requestId does not create a second order")
                : Check.Fail("Repeating a command with the same requestId does not create a second order", "Orders.Count=" + db.Orders.Count)
        };
    }
}
