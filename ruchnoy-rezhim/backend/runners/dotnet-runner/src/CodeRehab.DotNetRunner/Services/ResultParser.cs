using System.Text.Json;
using CodeRehab.DotNetRunner.Models;

namespace CodeRehab.DotNetRunner.Services;

public sealed class ResultParser
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public IReadOnlyList<TestResult>? TryParseTests(string stdout)
    {
        var lines = stdout.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);

        for (var index = lines.Length - 1; index >= 0; index--)
        {
            var line = lines[index].Trim();
            if (!line.StartsWith('{') || !line.EndsWith('}'))
            {
                continue;
            }

            try
            {
                using var document = JsonDocument.Parse(line);
                if (!document.RootElement.TryGetProperty("tests", out var testsElement))
                {
                    continue;
                }

                return JsonSerializer.Deserialize<List<TestResult>>(testsElement.GetRawText(), JsonOptions);
            }
            catch (JsonException)
            {
            }
        }

        return null;
    }

    public string RemoveResultLine(string stdout)
    {
        var lines = stdout.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None).ToList();
        var removeAt = lines.FindLastIndex(line =>
        {
            var trimmed = line.Trim();
            return trimmed.StartsWith('{') && trimmed.EndsWith('}') && trimmed.Contains("\"tests\"");
        });

        if (removeAt >= 0)
        {
            lines.RemoveAt(removeAt);
        }

        return string.Join(Environment.NewLine, lines).Trim();
    }
}
