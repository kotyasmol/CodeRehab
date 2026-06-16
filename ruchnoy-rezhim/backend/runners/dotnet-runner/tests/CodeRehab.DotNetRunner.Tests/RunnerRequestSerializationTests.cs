using System.Text.Json;
using CodeRehab.DotNetRunner.Models;

namespace CodeRehab.DotNetRunner.Tests;

public sealed class RunnerRequestSerializationTests
{
    [Fact]
    public void DeserializesCamelCaseRequest()
    {
        var json = """
        {
          "taskId": "async-cache-stampede",
          "language": "csharp",
          "userCode": "public sealed class UserProfileCache {}",
          "timeoutMs": 1500
        }
        """;

        var request = JsonSerializer.Deserialize<RunnerRequest>(
            json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(request);
        Assert.Equal("async-cache-stampede", request.TaskId);
        Assert.Equal("csharp", request.Language);
        Assert.Equal(1500, request.EffectiveTimeoutMs);
    }
}
