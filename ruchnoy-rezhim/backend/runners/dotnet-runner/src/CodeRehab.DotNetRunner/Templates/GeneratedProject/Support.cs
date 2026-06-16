public sealed record CheckResult(string name, bool passed, string message);

public static class Check
{
    public static CheckResult Pass(string name, string message = "OK") => new(name, true, message);
    public static CheckResult Fail(string name, string message) => new(name, false, message);
}

public sealed class TestLogger<T> : ILogger<T>, IDisposable
{
    public List<string> Messages { get; } = new();

    public IDisposable BeginScope<TState>(TState state) => this;

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Dispose()
    {
    }

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception exception,
        Func<TState, Exception, string> formatter)
    {
        Messages.Add(formatter(state, exception));
    }
}

public static class ReflectionTools
{
    public static T CreateWithFields<T>(params (string Name, object Value)[] fields)
    {
        var instance = (T)Activator.CreateInstance(typeof(T), nonPublic: true)!;
        foreach (var field in fields)
        {
            typeof(T).GetField(field.Name, BindingFlags.Instance | BindingFlags.NonPublic)!
                .SetValue(instance, field.Value);
        }

        return instance;
    }

    public static async Task<object?> InvokeMaybeAsync(object target, string methodName, params object?[] args)
    {
        var method = target.GetType().GetMethod(methodName, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)!;
        var value = method.Invoke(target, args);

        if (value is Task task)
        {
            await task;
            var resultProperty = task.GetType().GetProperty("Result");
            return resultProperty?.GetValue(task);
        }

        return value;
    }
}
