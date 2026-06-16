using System.Diagnostics;
using System.Text;

namespace CodeRehab.DotNetRunner.Execution;

public sealed class ProcessRunner
{
    public async Task<ProcessRunResult> RunAsync(
        string fileName,
        IReadOnlyList<string> arguments,
        string workingDirectory,
        int timeoutMs,
        CancellationToken cancellationToken = default)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = fileName,
            WorkingDirectory = workingDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false
        };

        foreach (var argument in arguments)
        {
            startInfo.ArgumentList.Add(argument);
        }

        using var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();

        process.OutputDataReceived += (_, args) =>
        {
            if (args.Data is not null)
            {
                stdout.AppendLine(args.Data);
            }
        };
        process.ErrorDataReceived += (_, args) =>
        {
            if (args.Data is not null)
            {
                stderr.AppendLine(args.Data);
            }
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        using var timeout = new CancellationTokenSource(timeoutMs);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(timeout.Token, cancellationToken);

        try
        {
            await process.WaitForExitAsync(linked.Token);
            await Task.Run(process.WaitForExit, CancellationToken.None);

            return new ProcessRunResult
            {
                ExitCode = process.ExitCode,
                Stdout = stdout.ToString(),
                Stderr = stderr.ToString()
            };
        }
        catch (OperationCanceledException) when (timeout.IsCancellationRequested)
        {
            TryKill(process);

            return new ProcessRunResult
            {
                ExitCode = -1,
                Stdout = stdout.ToString(),
                Stderr = stderr.ToString(),
                TimedOut = true
            };
        }
    }

    private static void TryKill(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch (InvalidOperationException)
        {
        }
    }
}
