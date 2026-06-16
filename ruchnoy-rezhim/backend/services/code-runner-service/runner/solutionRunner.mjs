import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const runTimeoutMs = 12000;

export async function runSolutionCheck(lessonId, code) {
  const harness = harnesses[lessonId];

  if (!harness) {
    return {
      passed: 0,
      total: 1,
      tests: [
        {
          name: "Конфигурация проверки",
          passed: false,
          message: "Для этого задания еще нет набора тестов.",
        },
      ],
    };
  }

  const workdir = await mkdtemp(join(tmpdir(), "ruchnoy-runner-"));

  try {
    await writeFile(join(workdir, "Runner.csproj"), projectFile(), "utf8");
    await writeFile(join(workdir, "Program.cs"), buildProgram(code, harness), "utf8");

    try {
      const { stdout } = await execFileAsync(
        "dotnet",
        ["run", "--project", join(workdir, "Runner.csproj")],
        { cwd: workdir, timeout: runTimeoutMs, maxBuffer: 1024 * 1024 * 4 },
      );

      const result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1));
      return {
        passed: result.tests.filter((test) => test.passed).length,
        total: result.tests.length,
        tests: result.tests,
      };
    } catch (error) {
      return failedRun(error);
    }
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

function failedRun(error) {
  const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`.trim();
  const timedOut = error.killed || error.signal === "SIGTERM";

  return {
    passed: 0,
    total: 1,
    tests: [
      {
        name: timedOut ? "Код завершился по таймауту" : "Компиляция или запуск",
        passed: false,
        message: timedOut
          ? "Проверка не завершилась за 12 секунд. Обычно это зависший await, .Result, Wait или неучтенная отмена."
          : trimOutput(output),
      },
    ],
  };
}

function trimOutput(output) {
  if (!output) {
    return "dotnet завершился с ошибкой без диагностического вывода.";
  }

  return output.split(/\r?\n/).slice(-24).join("\n");
}

function projectFile() {
  return `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>disable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <FrameworkReference Include="Microsoft.AspNetCore.App" />
  </ItemGroup>
</Project>`;
}

function buildProgram(code, harness) {
  return `${commonUsings()}

#line 1 "UserSolution.cs"
${code}
#line default

${commonSupport()}

${harness}`;
}

function commonUsings() {
  return `global using System;
global using System.Collections.Concurrent;
global using System.Collections.Generic;
global using System.Diagnostics;
global using System.Linq;
global using System.Net;
global using System.Net.Http;
global using System.Net.Http.Json;
global using System.Reflection;
global using System.Text;
global using System.Text.Json;
global using System.Threading;
global using System.Threading.Tasks;
global using Microsoft.AspNetCore.Http;
global using Microsoft.AspNetCore.Mvc;
global using Microsoft.Extensions.Hosting;
global using Microsoft.Extensions.Logging;`;
}

function commonSupport() {
  return `public sealed record CheckResult(string name, bool passed, string message);

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
    public void Dispose() { }
    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception exception, Func<TState, Exception, string> formatter)
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

public static class Program
{
    public static async Task Main()
    {
        var tests = await LessonTests.RunAsync();
        Console.WriteLine(JsonSerializer.Serialize(new { tests }));
    }
}`;
}

const harnesses = {
  "webhook-idempotency": `public sealed record PaymentWebhook(string EventId, Guid UserId, decimal Amount);
public sealed class ProcessedPaymentEvent
{
    public string EventId { get; set; } = "";
    public DateTimeOffset ReceivedAt { get; set; }
}
public sealed class DbUpdateException : Exception
{
    public DbUpdateException(string message) : base(message) { }
}
public sealed class FakeDbSet<T> : List<T>
{
    public Func<Task>? BeforeAnyAsync { get; set; }
}
public static class AsyncQueryExtensions
{
    public static async Task<bool> AnyAsync<T>(this IEnumerable<T> source, Func<T, bool> predicate, CancellationToken ct = default)
    {
        if (source is FakeDbSet<T> set && set.BeforeAnyAsync is not null)
            await set.BeforeAnyAsync();
        ct.ThrowIfCancellationRequested();
        return source.Any(predicate);
    }
}
public sealed class BillingDbContext
{
    public FakeDbSet<ProcessedPaymentEvent> ProcessedPaymentEvents { get; } = new();
    public Task SaveChangesAsync(CancellationToken ct = default)
    {
        ct.ThrowIfCancellationRequested();
        var duplicate = ProcessedPaymentEvents.GroupBy(x => x.EventId).FirstOrDefault(x => x.Count() > 1);
        if (duplicate is not null)
            throw new DbUpdateException("Duplicate payment event: " + duplicate.Key);
        return Task.CompletedTask;
    }
}
public interface IUserBalanceClient
{
    Task AddCreditsAsync(Guid userId, decimal amount, CancellationToken ct);
}
public sealed class BalanceClientSpy : IUserBalanceClient
{
    public int AddCalls;
    public Task AddCreditsAsync(Guid userId, decimal amount, CancellationToken ct)
    {
        Interlocked.Increment(ref AddCalls);
        return Task.Delay(20, ct);
    }
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var tests = new List<CheckResult>();
        tests.Add(await SequentialDuplicate());
        tests.Add(await ConcurrentDuplicate());
        return tests;
    }

    private static async Task<CheckResult> SequentialDuplicate()
    {
        var db = new BillingDbContext();
        db.ProcessedPaymentEvents.Add(new ProcessedPaymentEvent { EventId = "evt-1" });
        var balances = new BalanceClientSpy();
        var handler = new PaymentWebhookHandler(db, balances);

        await handler.HandleAsync(new PaymentWebhook("evt-1", Guid.NewGuid(), 10), CancellationToken.None);
        return balances.AddCalls == 0
            ? Check.Pass("Повторный webhook не начисляет баланс")
            : Check.Fail("Повторный webhook не начисляет баланс", "Для уже обработанного eventId был вызван AddCreditsAsync.");
    }

    private static async Task<CheckResult> ConcurrentDuplicate()
    {
        var db = new BillingDbContext();
        var balances = new BalanceClientSpy();
        var handler = new PaymentWebhookHandler(db, balances);
        var entered = 0;
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        db.ProcessedPaymentEvents.BeforeAnyAsync = async () =>
        {
            if (Interlocked.Increment(ref entered) == 2)
                release.SetResult();
            await release.Task.WaitAsync(TimeSpan.FromSeconds(2));
        };

        var payload = new PaymentWebhook("evt-race", Guid.NewGuid(), 20);
        await Task.WhenAll(
            Task.Run(async () => { try { await handler.HandleAsync(payload, CancellationToken.None); } catch (DbUpdateException) { } }),
            Task.Run(async () => { try { await handler.HandleAsync(payload, CancellationToken.None); } catch (DbUpdateException) { } })
        );

        return balances.AddCalls == 1
            ? Check.Pass("Параллельные webhook не дают двойного начисления")
            : Check.Fail("Параллельные webhook не дают двойного начисления", "Ожидался 1 вызов AddCreditsAsync, фактически: " + balances.AddCalls + ".");
    }
}`,

  "parallel-order-refresh": `public sealed class Order
{
    public string PartnerOrderId { get; set; } = "";
    public string Status { get; set; } = "waiting";
}
public sealed class RefreshSummary
{
    public int Updated { get; }
    public int Failed { get; }
    public int Skipped { get; }
    public RefreshSummary(int updated, int failed, int skipped)
    {
        Updated = updated; Failed = failed; Skipped = skipped;
    }
    public override string ToString() => "Updated=" + Updated + ", Failed=" + Failed + ", Skipped=" + Skipped;
}
public interface IOrderRepository
{
    Task<IReadOnlyList<Order>> GetOrdersWaitingForShipmentAsync(CancellationToken ct);
    Task SaveAsync(Order order, CancellationToken ct);
}
public interface IPartnerOrderClient
{
    Task<string> GetStatusAsync(string partnerOrderId, CancellationToken ct);
}
public sealed class OrderRepositorySpy : IOrderRepository
{
    public List<Order> Orders { get; } = Enumerable.Range(1, 5).Select(i => new Order { PartnerOrderId = "p-" + i }).ToList();
    public int SaveCalls;
    public Task<IReadOnlyList<Order>> GetOrdersWaitingForShipmentAsync(CancellationToken ct) => Task.FromResult((IReadOnlyList<Order>)Orders);
    public Task SaveAsync(Order order, CancellationToken ct) { Interlocked.Increment(ref SaveCalls); return Task.CompletedTask; }
}
public sealed class PartnerClientSpy : IPartnerOrderClient
{
    private int _current;
    public int MaxConcurrency;
    public int Calls;
    public async Task<string> GetStatusAsync(string partnerOrderId, CancellationToken ct)
    {
        Interlocked.Increment(ref Calls);
        var now = Interlocked.Increment(ref _current);
        MaxConcurrency = Math.Max(MaxConcurrency, now);
        try
        {
            await Task.Delay(80, ct);
            if (partnerOrderId == "p-3") throw new HttpRequestException("temporary partner failure");
            return "shipped";
        }
        finally
        {
            Interlocked.Decrement(ref _current);
        }
    }
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var repo = new OrderRepositorySpy();
        var partner = new PartnerClientSpy();
        var logger = new TestLogger<OrderStatusRefreshJob>();
        var job = ReflectionTools.CreateWithFields<OrderStatusRefreshJob>(("_orders", repo), ("_partner", partner), ("_logger", logger));
        var tests = new List<CheckResult>();

        RefreshSummary? summary = null;
        try { summary = await job.RunAsync(CancellationToken.None); }
        catch (Exception ex) { tests.Add(Check.Fail("Job не падает из-за одного заказа", ex.GetType().Name + ": " + ex.Message)); }

        if (summary is not null)
        {
            tests.Add(partner.MaxConcurrency > 1
                ? Check.Pass("Запросы к партнеру выполняются конкурентно")
                : Check.Fail("Запросы к партнеру выполняются конкурентно", "MaxConcurrency остался 1: job все еще идет последовательно."));
            tests.Add(summary.Failed == 1 && summary.Updated == 4
                ? Check.Pass("Ошибки отдельных заказов попадают в summary")
                : Check.Fail("Ошибки отдельных заказов попадают в summary", "Ожидалось Updated=4, Failed=1. Фактически: " + summary + "."));
        }

        return tests;
    }
}`,

  "quote-timeouts": `public sealed record ShipmentRequest(string From, string To, decimal Weight);
public sealed record ShippingQuote(string Provider, decimal Price);
public interface IShippingProvider
{
    string Name { get; }
    Task<ShippingQuote> GetQuoteAsync(ShipmentRequest request, CancellationToken ct);
}
public sealed class ShippingProviderSpy : IShippingProvider
{
    private readonly int _delayMs;
    private readonly decimal _price;
    private readonly bool _throws;
    public string Name { get; }
    public ShippingProviderSpy(string name, int delayMs, decimal price, bool throws = false)
    {
        Name = name; _delayMs = delayMs; _price = price; _throws = throws;
    }
    public async Task<ShippingQuote> GetQuoteAsync(ShipmentRequest request, CancellationToken ct)
    {
        await Task.Delay(_delayMs, ct);
        if (_throws) throw new HttpRequestException(Name + " failed");
        return new ShippingQuote(Name, _price);
    }
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var providers = new IShippingProvider[]
        {
            new ShippingProviderSpy("fast", 40, 300),
            new ShippingProviderSpy("broken", 20, 100, throws: true),
            new ShippingProviderSpy("slow", 1500, 50),
        };
        var logger = new TestLogger<ShippingQuoteService>();
        var service = ReflectionTools.CreateWithFields<ShippingQuoteService>(("_providers", providers), ("_logger", logger));
        var tests = new List<CheckResult>();
        var sw = Stopwatch.StartNew();
        IReadOnlyList<ShippingQuote>? quotes = null;

        try { quotes = await service.GetQuotesAsync(new ShipmentRequest("A", "B", 1), CancellationToken.None); }
        catch (Exception ex) { tests.Add(Check.Fail("Падение одного провайдера не ломает весь ответ", ex.GetType().Name + ": " + ex.Message)); }

        if (quotes is not null)
        {
            tests.Add(quotes.Any(x => x.Provider == "fast")
                ? Check.Pass("Успешные тарифы возвращаются")
                : Check.Fail("Успешные тарифы возвращаются", "Ответ не содержит тариф от fast-провайдера."));
            tests.Add(sw.ElapsedMilliseconds < 1200
                ? Check.Pass("Медленный провайдер ограничен дедлайном")
                : Check.Fail("Медленный провайдер ограничен дедлайном", "Проверка заняла " + sw.ElapsedMilliseconds + "ms."));
        }

        return tests;
    }
}`,

  "forgotten-await-email": `public sealed record RegisterUserCommand(string Email, string DisplayName);
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
}`,

  "async-cache-stampede": `public interface IMemoryCache
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
}`,

  "background-export-status": `public sealed class ExportJob
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
}`,

  "transaction-outbox": `public sealed record CreateOrder(Guid UserId, IReadOnlyList<string> Items, string RequestId);
public sealed class Order
{
    public Guid Id { get; } = Guid.NewGuid();
    public Guid UserId { get; private set; }
    public IReadOnlyList<string> Items { get; private set; } = Array.Empty<string>();
    public string RequestId { get; set; } = "";
    public static Order Create(Guid userId, IReadOnlyList<string> items) => new() { UserId = userId, Items = items };
}
public sealed class OrderCreated
{
    public Guid OrderId { get; set; }
    public Guid UserId { get; set; }
}
public sealed class OutboxMessage
{
    public string Type { get; set; } = "";
    public string Payload { get; set; } = "";
    public string RequestId { get; set; } = "";
}
public sealed class ShopDbContext
{
    public List<Order> Orders { get; } = new();
    public List<OutboxMessage> OutboxMessages { get; } = new();
    public Task SaveChangesAsync(CancellationToken ct) => Task.CompletedTask;
}
public interface IMessageBus
{
    Task PublishAsync(object message, CancellationToken ct);
}
public sealed class BusSpy : IMessageBus
{
    public int Published;
    public Task PublishAsync(object message, CancellationToken ct) { Published++; return Task.CompletedTask; }
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var db = new ShopDbContext();
        var bus = new BusSpy();
        var handler = ReflectionTools.CreateWithFields<CreateOrderHandler>(("_db", db), ("_bus", bus));
        var command = new CreateOrder(Guid.NewGuid(), new[] { "sku-1" }, "req-1");
        await handler.HandleAsync(command, CancellationToken.None);
        await handler.HandleAsync(command, CancellationToken.None);

        return new List<CheckResult>
        {
            db.OutboxMessages.Count == 1 && bus.Published == 0
                ? Check.Pass("OrderCreated пишется в outbox, а не публикуется напрямую")
                : Check.Fail("OrderCreated пишется в outbox, а не публикуется напрямую", "Outbox=" + db.OutboxMessages.Count + ", direct publish=" + bus.Published),
            db.Orders.Count == 1
                ? Check.Pass("Повтор команды с тем же requestId не создает второй заказ")
                : Check.Fail("Повтор команды с тем же requestId не создает второй заказ", "Orders.Count=" + db.Orders.Count)
        };
    }
}`,

  "cancellation-leak": `public sealed record SearchResponse(IReadOnlyList<string> Products, IReadOnlyList<string> Reviews, IReadOnlyList<string> Articles);
public interface ICatalogSearch { Task<IReadOnlyList<string>> FindAsync(string query, CancellationToken ct); }
public interface IReviewSearch { Task<IReadOnlyList<string>> FindAsync(string query, CancellationToken ct); }
public interface IHelpCenterSearch { Task<IReadOnlyList<string>> FindAsync(string query, CancellationToken ct); }
public sealed class SearchSpy : ICatalogSearch, IReviewSearch, IHelpCenterSearch
{
    private readonly string _value;
    private readonly bool _throws;
    public bool SawCancelableToken;
    public SearchSpy(string value, bool throws = false) { _value = value; _throws = throws; }
    public Task<IReadOnlyList<string>> FindAsync(string query, CancellationToken ct)
    {
        SawCancelableToken = ct.CanBeCanceled;
        if (_throws) throw new HttpRequestException(_value + " failed");
        return Task.FromResult((IReadOnlyList<string>)new[] { _value });
    }
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var catalog = new SearchSpy("product");
        var reviews = new SearchSpy("review");
        var help = new SearchSpy("article");
        var controller = ReflectionTools.CreateWithFields<SearchController>(("_catalog", catalog), ("_reviews", reviews), ("_help", help));
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        using var cts = new CancellationTokenSource();
        controller.HttpContext.RequestAborted = cts.Token;
        await controller.Search("phone");

        var tests = new List<CheckResult>
        {
            catalog.SawCancelableToken && reviews.SawCancelableToken && help.SawCancelableToken
                ? Check.Pass("RequestAborted прокинут во все downstream-вызовы")
                : Check.Fail("RequestAborted прокинут во все downstream-вызовы", "Один из сервисов получил CancellationToken.None.")
        };

        var brokenReviews = new SearchSpy("review", throws: true);
        var partial = ReflectionTools.CreateWithFields<SearchController>(("_catalog", new SearchSpy("product")), ("_reviews", brokenReviews), ("_help", new SearchSpy("article")));
        partial.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        try
        {
            var result = await partial.Search("phone");
            tests.Add(result is OkObjectResult
                ? Check.Pass("Падение одного поиска не ломает весь ответ")
                : Check.Fail("Падение одного поиска не ломает весь ответ", "Ожидался OkObjectResult с частичными данными."));
        }
        catch (Exception ex)
        {
            tests.Add(Check.Fail("Падение одного поиска не ломает весь ответ", ex.GetType().Name + ": " + ex.Message));
        }
        return tests;
    }
}`,

  "async-deadlock": `public sealed record Stock(int Available, int Reserved);
public sealed class InventoryDto
{
    public string Sku { get; set; } = "";
    public int Available { get; set; }
    public int Reserved { get; set; }
}
public interface IWarehouseClient
{
    Task<Stock?> GetStockAsync(string sku, CancellationToken ct);
}
public sealed class WarehouseSpy : IWarehouseClient
{
    public bool SawCancelableToken;
    public TaskCompletionSource<Stock?> Stock { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public Task<Stock?> GetStockAsync(string sku, CancellationToken ct)
    {
        SawCancelableToken = ct.CanBeCanceled;
        return Stock.Task;
    }
}
public sealed class TimeoutWarehouse : IWarehouseClient
{
    public Task<Stock?> GetStockAsync(string sku, CancellationToken ct) => throw new TimeoutException("warehouse timeout");
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var tests = new List<CheckResult>();
        var warehouse = new WarehouseSpy();
        var controller = ReflectionTools.CreateWithFields<InventoryController>(("_warehouse", warehouse));
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        using var cts = new CancellationTokenSource();
        controller.HttpContext.RequestAborted = cts.Token;

        var invokeTask = Task.Run(() => typeof(InventoryController).GetMethod("Get")!.Invoke(controller, new object[] { "sku-1" }));
        await Task.Delay(80);
        tests.Add(invokeTask.IsCompleted
            ? Check.Pass("Action не блокирует поток на ожидании склада")
            : Check.Fail("Action не блокирует поток на ожидании склада", "Вызов Get не вернул Task/результат быстро. Вероятно, внутри остался .Result или Wait()."));

        warehouse.Stock.SetResult(new Stock(5, 1));
        var raw = await invokeTask.WaitAsync(TimeSpan.FromSeconds(2));
        if (raw is Task task) await task;
        tests.Add(warehouse.SawCancelableToken
            ? Check.Pass("CancellationToken запроса прокинут в warehouse client")
            : Check.Fail("CancellationToken запроса прокинут в warehouse client", "Warehouse получил CancellationToken.None."));

        var timeoutController = ReflectionTools.CreateWithFields<InventoryController>(("_warehouse", new TimeoutWarehouse()));
        try
        {
            var value = await ReflectionTools.InvokeMaybeAsync(timeoutController, "Get", "sku-2");
            tests.Add(value is ObjectResult objectResult && objectResult.StatusCode == 503
                ? Check.Pass("Timeout склада превращается в 503")
                : Check.Fail("Timeout склада превращается в 503", "Ожидался ObjectResult со StatusCode=503."));
        }
        catch (Exception ex)
        {
            tests.Add(Check.Fail("Timeout склада превращается в 503", ex.GetType().Name + ": " + ex.Message));
        }
        return tests;
    }
}`,

  "retry-policy": `public sealed record NewLead(string Email, string Name, string RequestId);
public sealed record CreateLeadResponse(string LeadId);
public sealed class SequenceHandler : HttpMessageHandler
{
    private readonly Queue<HttpResponseMessage> _responses = new();
    public List<HttpRequestMessage> Requests { get; } = new();
    public SequenceHandler(params HttpResponseMessage[] responses)
    {
        foreach (var response in responses) _responses.Enqueue(response);
    }
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Add(request);
        return Task.FromResult(_responses.Dequeue());
    }
}
public static class LessonTests
{
    public static async Task<List<CheckResult>> RunAsync()
    {
        var ok = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent.Create(new CreateLeadResponse("lead-1"))
        };
        var handler = new SequenceHandler(new HttpResponseMessage(HttpStatusCode.BadGateway), ok);
        var client = ReflectionTools.CreateWithFields<CrmLeadClient>(("_http", new HttpClient(handler) { BaseAddress = new Uri("https://crm.local") }));
        var tests = new List<CheckResult>();
        string? id = null;
        try
        {
            id = await client.CreateLeadAsync(new NewLead("a@example.com", "Ann", "req-1"), CancellationToken.None);
            tests.Add(id == "lead-1" && handler.Requests.Count == 2
                ? Check.Pass("Временная 5xx ошибка повторяется и затем возвращает LeadId")
                : Check.Fail("Временная 5xx ошибка повторяется и затем возвращает LeadId", "Requests=" + handler.Requests.Count + ", LeadId=" + id));
        }
        catch (Exception ex)
        {
            tests.Add(Check.Fail("Временная 5xx ошибка повторяется и затем возвращает LeadId", ex.GetType().Name + ": " + ex.Message));
        }

        tests.Add(handler.Requests.Count > 0 && handler.Requests.All(x => x.Headers.Contains("Idempotency-Key"))
            ? Check.Pass("Каждая попытка содержит Idempotency-Key")
            : Check.Fail("Каждая попытка содержит Idempotency-Key", "Хотя бы один POST ушел без идемпотентного ключа."));

        var bad = new SequenceHandler(new HttpResponseMessage(HttpStatusCode.BadRequest));
        var badClient = ReflectionTools.CreateWithFields<CrmLeadClient>(("_http", new HttpClient(bad) { BaseAddress = new Uri("https://crm.local") }));
        try { await badClient.CreateLeadAsync(new NewLead("bad", "Bad", "req-2"), CancellationToken.None); }
        catch { }
        tests.Add(bad.Requests.Count == 1
            ? Check.Pass("4xx ошибки не ретраятся")
            : Check.Fail("4xx ошибки не ретраятся", "BadRequest был отправлен " + bad.Requests.Count + " раз."));
        return tests;
    }
}`,
};
