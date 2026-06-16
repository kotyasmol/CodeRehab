public sealed record RegisterUserCommand(string Email, string DisplayName);
public sealed class User
{
    public Guid Id { get; } = Guid.NewGuid();
    public string Email { get; }
    public string DisplayName { get; }
    public User(string email, string displayName) { Email = email; DisplayName = displayName; }
}
public sealed class EmailToken
{
    public Guid UserId { get; private set; }
    public string Value { get; private set; } = "";
    public static EmailToken CreateFor(Guid userId) => new() { UserId = userId, Value = "token-" + userId };
}
public sealed class AppDbContext
{
    public List<User> Users { get; } = new();
    public List<EmailToken> EmailTokens { get; } = new();
    public int SaveCalls;
    public Task SaveChangesAsync(CancellationToken ct = default) { SaveCalls++; return Task.CompletedTask; }
}
public interface IEmailSender
{
    Task SendConfirmationAsync(string email, string token, CancellationToken ct = default);
}
public sealed class EmailSenderSpy : IEmailSender
{
    public int Calls;
    public TaskCompletionSource Blocker { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public async Task SendConfirmationAsync(string email, string token, CancellationToken ct = default)
    {
        Calls++;
        await Blocker.Task.WaitAsync(ct);
    }
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var db = new AppDbContext();
        var email = new EmailSenderSpy();
        var service = ReflectionTools.CreateWithFields<RegistrationService>(("_db", db), ("_email", email));
        var tests = new List<CheckResult>();
        var task = service.RegisterAsync(new RegisterUserCommand("a@example.com", "Ann"));
        await Task.Delay(80);

        tests.Add(!task.IsCompleted
            ? Check.Pass("Регистрация ожидает результат отправки письма")
            : Check.Fail("Регистрация ожидает результат отправки письма", "RegisterAsync завершился, пока SendConfirmationAsync еще не завершился."));

        email.Blocker.SetResult();
        await task.WaitAsync(TimeSpan.FromSeconds(2));
        tests.Add(email.Calls == 1 && db.Users.Count == 1 && db.EmailTokens.Count == 1
            ? Check.Pass("Пользователь, токен и письмо проходят один согласованный сценарий")
            : Check.Fail("Пользователь, токен и письмо проходят один согласованный сценарий", "Проверь сохранение пользователя/токена и вызов письма."));
        return tests;
    }
}
