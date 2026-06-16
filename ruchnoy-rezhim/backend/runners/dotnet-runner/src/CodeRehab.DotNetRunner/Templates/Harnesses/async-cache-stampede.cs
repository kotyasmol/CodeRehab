public interface IMemoryCache
{
    bool TryGetValue<T>(object key, out T value);
    T Set<T>(object key, T value, TimeSpan ttl);
}
public sealed class MemoryCacheSpy : IMemoryCache
{
    private readonly ConcurrentDictionary<object, object> _items = new();
    public bool TryGetValue<T>(object key, out T value)
    {
        if (_items.TryGetValue(key, out var raw)) { value = (T)raw; return true; }
        value = default!; return false;
    }
    public T Set<T>(object key, T value, TimeSpan ttl) { _items[key] = value!; return value; }
}
public sealed record UserProfile(Guid UserId, string Name);
public interface IUserRepository
{
    Task<UserProfile> LoadProfileAsync(Guid userId, CancellationToken ct);
}
public sealed class UserRepositorySpy : IUserRepository
{
    public int Calls;
    public async Task<UserProfile> LoadProfileAsync(Guid userId, CancellationToken ct)
    {
        Interlocked.Increment(ref Calls);
        await Task.Delay(100, ct);
        return new UserProfile(userId, "Ada");
    }
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var cache = new MemoryCacheSpy();
        var repo = new UserRepositorySpy();
        var service = ReflectionTools.CreateWithFields<UserProfileCache>(("_cache", cache), ("_users", repo));
        var userId = Guid.NewGuid();
        var calls = Enumerable.Range(0, 8).Select(_ => service.GetAsync(userId, CancellationToken.None)).ToArray();
        var profiles = await Task.WhenAll(calls);

        return new List<CheckResult>
        {
            repo.Calls == 1
                ? Check.Pass("Параллельный cache miss загружает профиль один раз")
                : Check.Fail("Параллельный cache miss загружает профиль один раз", "LoadProfileAsync вызван " + repo.Calls + " раз."),
            profiles.All(x => x.UserId == userId)
                ? Check.Pass("Все ожидающие запросы получают один корректный результат")
                : Check.Fail("Все ожидающие запросы получают один корректный результат", "Часть запросов получила неверный профиль.")
        };
    }
}
