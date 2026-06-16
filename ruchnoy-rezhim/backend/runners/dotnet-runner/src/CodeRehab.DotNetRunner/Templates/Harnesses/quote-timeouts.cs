public sealed record ShipmentRequest(string From, string To, decimal Weight);
public sealed record ShippingQuote(string Provider, decimal Price);
public interface IShippingProvider
{
    string Name { get; }
    Task<ShippingQuote> GetQuoteAsync(ShipmentRequest request, CancellationToken ct);
}
public sealed class ShippingProviderSpy : IShippingProvider
{
    private readonly int _delayMs;
    private readonly decimal _price;
    private readonly bool _throws;
    public string Name { get; }
    public ShippingProviderSpy(string name, int delayMs, decimal price, bool throws = false)
    {
        Name = name; _delayMs = delayMs; _price = price; _throws = throws;
    }
    public async Task<ShippingQuote> GetQuoteAsync(ShipmentRequest request, CancellationToken ct)
    {
        await Task.Delay(_delayMs, ct);
        if (_throws) throw new HttpRequestException(Name + " failed");
        return new ShippingQuote(Name, _price);
    }
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var providers = new IShippingProvider[]
        {
            new ShippingProviderSpy("fast", 40, 300),
            new ShippingProviderSpy("broken", 20, 100, throws: true),
            new ShippingProviderSpy("slow", 1500, 50),
        };
        var logger = new TestLogger<ShippingQuoteService>();
        var service = ReflectionTools.CreateWithFields<ShippingQuoteService>(("_providers", providers), ("_logger", logger));
        var tests = new List<CheckResult>();
        var sw = Stopwatch.StartNew();
        IReadOnlyList<ShippingQuote>? quotes = null;

        try { quotes = await service.GetQuotesAsync(new ShipmentRequest("A", "B", 1), CancellationToken.None); }
        catch (Exception ex) { tests.Add(Check.Fail("Падение одного провайдера не ломает весь ответ", ex.GetType().Name + ": " + ex.Message)); }

        if (quotes is not null)
        {
            tests.Add(quotes.Any(x => x.Provider == "fast")
                ? Check.Pass("Успешные тарифы возвращаются")
                : Check.Fail("Успешные тарифы возвращаются", "Ответ не содержит тариф от fast-провайдера."));
            tests.Add(sw.ElapsedMilliseconds < 1200
                ? Check.Pass("Медленный провайдер ограничен дедлайном")
                : Check.Fail("Медленный провайдер ограничен дедлайном", "Проверка заняла " + sw.ElapsedMilliseconds + "ms."));
        }

        return tests;
    }
}
