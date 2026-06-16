namespace CodeRehab.DotNetRunner.Services;

public sealed class TemporaryWorkspaceService
{
    public Task<string> CreateAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var path = Path.Combine(Path.GetTempPath(), "ruchnoy-dotnet-runner-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(path);
        return Task.FromResult(path);
    }

    public Task CleanupAsync(string path, bool keepWorkspace, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!keepWorkspace && Directory.Exists(path))
        {
            Directory.Delete(path, recursive: true);
        }

        return Task.CompletedTask;
    }
}
