using CodeRehab.DotNetRunner.Execution;
using CodeRehab.DotNetRunner.Models;
using CodeRehab.DotNetRunner.Services;

namespace CodeRehab.DotNetRunner.Tests;

public sealed class DotNetExecutionServiceTests
{
    [Fact]
    public async Task ExecuteAsyncReturnsPassedForWorkingSolution()
    {
        var result = await CreateService().ExecuteAsync(new RunnerRequest
        {
            TaskId = "async-cache-stampede",
            Language = "csharp",
            TimeoutMs = 5_000,
            UserCode = """
            public sealed class UserProfileCache
            {
                private readonly IMemoryCache _cache;
                private readonly IUserRepository _users;
                private readonly ConcurrentDictionary<Guid, SemaphoreSlim> _locks = new();

                public async Task<UserProfile> GetAsync(Guid userId, CancellationToken ct)
                {
                    var key = $"profile:{userId}";
                    if (_cache.TryGetValue<UserProfile>(key, out var cached))
                    {
                        return cached;
                    }

                    var gate = _locks.GetOrAdd(userId, _ => new SemaphoreSlim(1, 1));
                    await gate.WaitAsync(ct);
                    try
                    {
                        if (_cache.TryGetValue<UserProfile>(key, out cached))
                        {
                            return cached;
                        }

                        var profile = await _users.LoadProfileAsync(userId, ct);
                        _cache.Set(key, profile, TimeSpan.FromMinutes(10));
                        return profile;
                    }
                    finally
                    {
                        gate.Release();
                        _locks.TryRemove(userId, out _);
                    }
                }
            }
            """
        });

        Assert.Equal(RunnerStatuses.Passed, result.Status);
        Assert.True(result.Passed);
        Assert.Equal(2, result.TestsPassed);
        Assert.Equal(2, result.TestsTotal);
    }

    [Fact]
    public async Task ExecuteAsyncReturnsCompileErrorForInvalidSolution()
    {
        var result = await CreateService().ExecuteAsync(new RunnerRequest
        {
            TaskId = "async-cache-stampede",
            Language = "csharp",
            TimeoutMs = 5_000,
            UserCode = "public sealed class UserProfileCache { this is not valid C# }"
        });

        Assert.Equal(RunnerStatuses.CompileError, result.Status);
        Assert.False(result.Passed);
        Assert.Contains("Compilation failed", result.Error);
        Assert.Equal(2, result.TestsTotal);
        Assert.NotEmpty(result.CompileOutput);
    }

    [Fact]
    public async Task ExecuteAsyncReturnsTimeoutForHangingSolution()
    {
        var result = await CreateService().ExecuteAsync(new RunnerRequest
        {
            TaskId = "async-cache-stampede",
            Language = "csharp",
            TimeoutMs = 500,
            UserCode = """
            public sealed class UserProfileCache
            {
                public async Task<UserProfile> GetAsync(Guid userId, CancellationToken ct)
                {
                    await Task.Delay(Timeout.InfiniteTimeSpan);
                    return new UserProfile(userId, "never");
                }
            }
            """
        });

        Assert.Equal(RunnerStatuses.Timeout, result.Status);
        Assert.False(result.Passed);
        Assert.Equal("Execution timed out", result.Error);
        Assert.Equal(2, result.TestsTotal);
    }

    private static DotNetExecutionService CreateService() =>
        new(
            new TemporaryWorkspaceService(),
            new TemplateProvider(),
            new HarnessCatalog(),
            new ProcessRunner(),
            new ResultParser());
}
