using System.Text.RegularExpressions;
using CodeRehab.DotNetRunner.Models;

namespace CodeRehab.DotNetRunner.Services;

public static partial class ResultLocalizer
{
    private static readonly IReadOnlyDictionary<string, string> Ru = new Dictionary<string, string>
    {
        ["Only C# is supported."] = "Поддерживается только C#.",
        ["This task does not have a test harness yet."] = "Для этого задания еще нет набора тестов.",
        ["Code timed out"] = "Код завершился по таймауту",
        ["Compilation or execution"] = "Компиляция или запуск",
        ["Compilation"] = "Компиляция",
        ["Check configuration"] = "Конфигурация проверки",
        ["Runner configuration"] = "Конфигурация runner-а",
        ["Compilation failed"] = "Ошибка компиляции",
        ["Compilation timed out"] = "Компиляция завершилась по таймауту",
        ["Execution timed out"] = "Выполнение завершилось по таймауту",
        ["dotnet failed without diagnostic output."] = "dotnet завершился с ошибкой без диагностического вывода.",
        ["Duplicate webhook does not credit the balance"] = "Повторный webhook не начисляет баланс",
        ["AddCreditsAsync was called for an already processed eventId."] = "Для уже обработанного eventId был вызван AddCreditsAsync.",
        ["Concurrent webhooks do not double-credit the account"] = "Параллельные webhook не дают двойного начисления",
        ["Job does not fail because of one order"] = "Job не падает из-за одного заказа",
        ["Partner requests run concurrently"] = "Запросы к партнеру выполняются конкурентно",
        ["MaxConcurrency stayed at 1: the job is still sequential."] = "MaxConcurrency остался 1: job все еще идет последовательно.",
        ["Individual order errors are included in the summary"] = "Ошибки отдельных заказов попадают в summary",
        ["One provider failure does not break the whole response"] = "Падение одного провайдера не ломает весь ответ",
        ["Successful quotes are returned"] = "Успешные тарифы возвращаются",
        ["The response does not include the fast provider quote."] = "Ответ не содержит тариф от fast-провайдера.",
        ["Slow provider is limited by the deadline"] = "Медленный провайдер ограничен дедлайном",
        ["Registration waits for the email send result"] = "Регистрация ожидает результат отправки письма",
        ["RegisterAsync completed before SendConfirmationAsync finished."] = "RegisterAsync завершился, пока SendConfirmationAsync еще не завершился.",
        ["User, token, and email follow one consistent flow"] = "Пользователь, токен и письмо проходят один согласованный сценарий",
        ["Check user/token persistence and the email call."] = "Проверь сохранение пользователя/токена и вызов письма.",
        ["Parallel cache miss loads the profile once"] = "Параллельный cache miss загружает профиль один раз",
        ["All waiting requests receive one correct result"] = "Все ожидающие запросы получают один корректный результат",
        ["Some requests received the wrong profile."] = "Часть запросов получила неверный профиль.",
        ["Successful export gets a final status and URL"] = "Успешный экспорт получает финальный статус и ссылку",
        ["Worker saves intermediate and final statuses"] = "Worker сохраняет промежуточный и финальный статусы",
        ["OrderCreated is written to the outbox instead of being published directly"] = "OrderCreated пишется в outbox, а не публикуется напрямую",
        ["Repeating a command with the same requestId does not create a second order"] = "Повтор команды с тем же requestId не создает второй заказ",
        ["RequestAborted is passed to every downstream call"] = "RequestAborted прокинут во все downstream-вызовы",
        ["One of the services received CancellationToken.None."] = "Один из сервисов получил CancellationToken.None.",
        ["One failed search does not break the whole response"] = "Падение одного поиска не ломает весь ответ",
        ["Expected OkObjectResult with partial data."] = "Ожидался OkObjectResult с частичными данными.",
        ["Action does not block a thread while waiting for the warehouse"] = "Action не блокирует поток на ожидании склада",
        ["Get did not return a Task/result quickly. .Result or Wait() is probably still inside."] = "Вызов Get не вернул Task/результат быстро. Вероятно, внутри остался .Result или Wait().",
        ["Request CancellationToken is passed to the warehouse client"] = "CancellationToken запроса прокинут в warehouse client",
        ["Warehouse received CancellationToken.None."] = "Warehouse получил CancellationToken.None.",
        ["Warehouse timeout becomes 503"] = "Timeout склада превращается в 503",
        ["Expected ObjectResult with StatusCode=503."] = "Ожидался ObjectResult со StatusCode=503.",
        ["Temporary 5xx failure is retried and then returns LeadId"] = "Временная 5xx ошибка повторяется и затем возвращает LeadId",
        ["Every attempt contains Idempotency-Key"] = "Каждая попытка содержит Idempotency-Key",
        ["At least one POST was sent without an idempotency key."] = "Хотя бы один POST ушел без идемпотентного ключа.",
        ["4xx errors are not retried"] = "4xx ошибки не ретраятся"
    };

    public static IReadOnlyList<TestResult> LocalizeTests(IReadOnlyList<TestResult> tests, string locale) =>
        IsRussian(locale)
            ? tests.Select(test => new TestResult(Localize(test.Name, locale), test.Passed, Localize(test.Message, locale))).ToArray()
            : tests;

    public static string Localize(string text, string locale)
    {
        if (!IsRussian(locale))
        {
            return text;
        }

        if (Ru.TryGetValue(text, out var translated))
        {
            return translated;
        }

        return LocalizeDynamic(text);
    }

    private static bool IsRussian(string locale) => locale.Equals("ru", StringComparison.OrdinalIgnoreCase);

    private static string LocalizeDynamic(string text)
    {
        var match = Regex.Match(text, @"^The check did not finish within (?<ms>\d+)ms\. This is usually a stuck await, \.Result, Wait, or missed cancellation\.$");
        if (match.Success)
        {
            return "Проверка не завершилась за " + match.Groups["ms"].Value + "ms. Обычно это зависший await, .Result, Wait или неучтенная отмена.";
        }

        match = Regex.Match(text, @"^Expected 1 AddCreditsAsync call, actual: (?<count>\d+)\.$");
        if (match.Success)
        {
            return "Ожидался 1 вызов AddCreditsAsync, фактически: " + match.Groups["count"].Value + ".";
        }

        match = Regex.Match(text, @"^Expected Updated=4, Failed=1\. Actual: (?<summary>.+)\.$");
        if (match.Success)
        {
            return "Ожидалось Updated=4, Failed=1. Фактически: " + match.Groups["summary"].Value + ".";
        }

        match = Regex.Match(text, @"^The check took (?<ms>\d+)ms\.$");
        if (match.Success)
        {
            return "Проверка заняла " + match.Groups["ms"].Value + "ms.";
        }

        match = Regex.Match(text, @"^LoadProfileAsync was called (?<count>\d+) times\.$");
        if (match.Success)
        {
            return "LoadProfileAsync вызван " + match.Groups["count"].Value + " раз.";
        }

        match = Regex.Match(text, @"^Saved statuses: (?<statuses>.+)$");
        if (match.Success)
        {
            return "Сохраненные статусы: " + match.Groups["statuses"].Value;
        }

        match = Regex.Match(text, @"^BadRequest was sent (?<count>\d+) times\.$");
        if (match.Success)
        {
            return "BadRequest был отправлен " + match.Groups["count"].Value + " раз.";
        }

        return text;
    }
}
