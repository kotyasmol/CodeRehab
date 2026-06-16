public sealed class ExportJob
{
    public Guid ReportId { get; set; } = Guid.NewGuid();
    public string Status { get; set; } = "pending";
    public string? Error { get; set; }
    public string? DownloadUrl { get; set; }
}
public interface IExportQueue
{
    Task<ExportJob> DequeueAsync(CancellationToken ct);
    Task SaveAsync(ExportJob job, CancellationToken ct);
}
public interface IReportRenderer
{
    Task<byte[]> RenderAsync(Guid reportId, CancellationToken ct);
}
public interface IFileStorage
{
    Task<string> UploadAsync(byte[] file, CancellationToken ct);
}
public sealed class ExportQueueSpy : IExportQueue
{
    private readonly ExportJob _job;
    private int _dequeued;
    public List<string> SavedStatuses { get; } = new();
    public ExportQueueSpy(ExportJob job) { _job = job; }
    public async Task<ExportJob> DequeueAsync(CancellationToken ct)
    {
        if (Interlocked.Exchange(ref _dequeued, 1) == 0) return _job;
        await Task.Delay(Timeout.Infinite, ct);
        throw new OperationCanceledException(ct);
    }
    public Task SaveAsync(ExportJob job, CancellationToken ct) { SavedStatuses.Add(job.Status); return Task.CompletedTask; }
}
public sealed class RendererSpy : IReportRenderer
{
    public bool Throw;
    public Task<byte[]> RenderAsync(Guid reportId, CancellationToken ct)
    {
        if (Throw) throw new InvalidOperationException("render exploded with password=secret");
        return Task.FromResult(new byte[] { 1, 2, 3 });
    }
}
public sealed class StorageSpy : IFileStorage
{
    public Task<string> UploadAsync(byte[] file, CancellationToken ct) => Task.FromResult("https://files/report.csv");
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var tests = new List<CheckResult>();
        var job = new ExportJob();
        var queue = new ExportQueueSpy(job);
        var worker = ReflectionTools.CreateWithFields<ReportExportWorker>(("_queue", queue), ("_renderer", new RendererSpy()), ("_storage", new StorageSpy()));
        using var cts = new CancellationTokenSource();
        var execute = (Task)typeof(ReportExportWorker).GetMethod("ExecuteAsync", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(worker, new object[] { cts.Token })!;
        await Task.Delay(250);
        cts.Cancel();
        try { await execute; } catch (OperationCanceledException) { }

        tests.Add(job.Status == "succeeded" && job.DownloadUrl is not null
            ? Check.Pass("Успешный экспорт получает финальный статус и ссылку")
            : Check.Fail("Успешный экспорт получает финальный статус и ссылку", "Status=" + job.Status + ", DownloadUrl=" + job.DownloadUrl));
        tests.Add(queue.SavedStatuses.Contains("running") && queue.SavedStatuses.Contains("succeeded")
            ? Check.Pass("Worker сохраняет промежуточный и финальный статусы")
            : Check.Fail("Worker сохраняет промежуточный и финальный статусы", "Сохраненные статусы: " + string.Join(", ", queue.SavedStatuses)));
        return tests;
    }
}
