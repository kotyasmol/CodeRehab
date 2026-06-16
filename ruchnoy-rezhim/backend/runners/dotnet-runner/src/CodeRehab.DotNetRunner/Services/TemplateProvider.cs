namespace CodeRehab.DotNetRunner.Services;

public sealed class TemplateProvider
{
    private readonly string _templateRoot;

    public TemplateProvider(string? templateRoot = null)
    {
        _templateRoot = templateRoot ?? ResolveTemplateRoot();
    }

    public Task<string> ReadGeneratedProjectTemplateAsync(string fileName, CancellationToken cancellationToken = default) =>
        File.ReadAllTextAsync(Path.Combine(_templateRoot, "GeneratedProject", fileName), cancellationToken);

    public Task<string> ReadHarnessAsync(string taskId, CancellationToken cancellationToken = default) =>
        File.ReadAllTextAsync(Path.Combine(_templateRoot, "Harnesses", taskId + ".cs"), cancellationToken);

    private static string ResolveTemplateRoot()
    {
        var outputCandidate = Path.Combine(AppContext.BaseDirectory, "Templates");
        if (Directory.Exists(outputCandidate))
        {
            return outputCandidate;
        }

        var current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var sourceCandidate = Path.Combine(current.FullName, "src", "CodeRehab.DotNetRunner", "Templates");
            if (Directory.Exists(sourceCandidate))
            {
                return sourceCandidate;
            }

            current = current.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate runner Templates directory.");
    }
}
