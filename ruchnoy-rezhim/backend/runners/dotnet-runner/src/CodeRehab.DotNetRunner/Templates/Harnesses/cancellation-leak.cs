public sealed record SearchResponse(IReadOnlyList<string> Products, IReadOnlyList<string> Reviews, IReadOnlyList<string> Articles);
public interface ICatalogSearch { Task<IReadOnlyList<string>> FindAsync(string query, CancellationToken ct); }
public interface IReviewSearch { Task<IReadOnlyList<string>> FindAsync(string query, CancellationToken ct); }
public interface IHelpCenterSearch { Task<IReadOnlyList<string>> FindAsync(string query, CancellationToken ct); }
public sealed class SearchSpy : ICatalogSearch, IReviewSearch, IHelpCenterSearch
{
    private readonly string _value;
    private readonly bool _throws;
    public bool SawCancelableToken;
    public SearchSpy(string value, bool throws = false) { _value = value; _throws = throws; }
    public Task<IReadOnlyList<string>> FindAsync(string query, CancellationToken ct)
    {
        SawCancelableToken = ct.CanBeCanceled;
        if (_throws) throw new HttpRequestException(_value + " failed");
        return Task.FromResult((IReadOnlyList<string>)new[] { _value });
    }
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var catalog = new SearchSpy("product");
        var reviews = new SearchSpy("review");
        var help = new SearchSpy("article");
        var controller = ReflectionTools.CreateWithFields<SearchController>(("_catalog", catalog), ("_reviews", reviews), ("_help", help));
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        using var cts = new CancellationTokenSource();
        controller.HttpContext.RequestAborted = cts.Token;
        await controller.Search("phone");

        var tests = new List<CheckResult>
        {
            catalog.SawCancelableToken && reviews.SawCancelableToken && help.SawCancelableToken
                ? Check.Pass("RequestAborted прокинут во все downstream-вызовы")
                : Check.Fail("RequestAborted прокинут во все downstream-вызовы", "Один из сервисов получил CancellationToken.None.")
        };

        var brokenReviews = new SearchSpy("review", throws: true);
        var partial = ReflectionTools.CreateWithFields<SearchController>(("_catalog", new SearchSpy("product")), ("_reviews", brokenReviews), ("_help", new SearchSpy("article")));
        partial.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        try
        {
            var result = await partial.Search("phone");
            tests.Add(result is OkObjectResult
                ? Check.Pass("Падение одного поиска не ломает весь ответ")
                : Check.Fail("Падение одного поиска не ломает весь ответ", "Ожидался OkObjectResult с частичными данными."));
        }
        catch (Exception ex)
        {
            tests.Add(Check.Fail("Падение одного поиска не ломает весь ответ", ex.GetType().Name + ": " + ex.Message));
        }
        return tests;
    }
}
