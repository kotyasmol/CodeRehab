public sealed record NewLead(string Email, string Name, string RequestId);
public sealed record CreateLeadResponse(string LeadId);
public sealed class SequenceHandler : HttpMessageHandler
{
    private readonly Queue<HttpResponseMessage> _responses = new();
    public List<HttpRequestMessage> Requests { get; } = new();
    public SequenceHandler(params HttpResponseMessage[] responses)
    {
        foreach (var response in responses) _responses.Enqueue(response);
    }
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Add(request);
        return Task.FromResult(_responses.Dequeue());
    }
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var ok = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent.Create(new CreateLeadResponse("lead-1"))
        };
        var handler = new SequenceHandler(new HttpResponseMessage(HttpStatusCode.BadGateway), ok);
        var client = ReflectionTools.CreateWithFields<CrmLeadClient>(("_http", new HttpClient(handler) { BaseAddress = new Uri("https://crm.local") }));
        var tests = new List<CheckResult>();
        string? id = null;
        try
        {
            id = await client.CreateLeadAsync(new NewLead("a@example.com", "Ann", "req-1"), CancellationToken.None);
            tests.Add(id == "lead-1" && handler.Requests.Count == 2
                ? Check.Pass("Temporary 5xx failure is retried and then returns LeadId")
                : Check.Fail("Temporary 5xx failure is retried and then returns LeadId", "Requests=" + handler.Requests.Count + ", LeadId=" + id));
        }
        catch (Exception ex)
        {
            tests.Add(Check.Fail("Temporary 5xx failure is retried and then returns LeadId", ex.GetType().Name + ": " + ex.Message));
        }

        tests.Add(handler.Requests.Count > 0 && handler.Requests.All(x => x.Headers.Contains("Idempotency-Key"))
            ? Check.Pass("Every attempt contains Idempotency-Key")
            : Check.Fail("Every attempt contains Idempotency-Key", "At least one POST was sent without an idempotency key."));

        var bad = new SequenceHandler(new HttpResponseMessage(HttpStatusCode.BadRequest));
        var badClient = ReflectionTools.CreateWithFields<CrmLeadClient>(("_http", new HttpClient(bad) { BaseAddress = new Uri("https://crm.local") }));
        try { await badClient.CreateLeadAsync(new NewLead("bad", "Bad", "req-2"), CancellationToken.None); }
        catch { }
        tests.Add(bad.Requests.Count == 1
            ? Check.Pass("4xx errors are not retried")
            : Check.Fail("4xx errors are not retried", "BadRequest was sent " + bad.Requests.Count + " times."));
        return tests;
    }
}
