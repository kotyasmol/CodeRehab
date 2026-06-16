# CodeRehab.DotNetRunner

Отдельный .NET runner для проверки C# решений в CodeRehab / ruchnoy-rezhim.

Runner принимает JSON-запрос, создает временный `.NET` console project, копирует туда пользовательский `UserSolution.cs`, общую поддержку и task-specific harness из `Templates/Harnesses`, выполняет `dotnet restore`, `dotnet build`, `dotnet run` с timeout и возвращает структурированный JSON.

## Структура

```text
dotnet-runner/
  CodeRehab.DotNetRunner.sln
  src/CodeRehab.DotNetRunner/
    Program.cs
    Models/
    Services/
    Execution/
    Templates/
      GeneratedProject/
      Harnesses/
  tests/CodeRehab.DotNetRunner.Tests/
  examples/smoke-request.json
```

## Запуск

```bash
dotnet restore CodeRehab.DotNetRunner.sln
dotnet build CodeRehab.DotNetRunner.sln
dotnet test CodeRehab.DotNetRunner.sln
```

Smoke-run:

```bash
dotnet run --project src/CodeRehab.DotNetRunner/CodeRehab.DotNetRunner.csproj -- --request examples/smoke-request.json
```

Можно также передать JSON через stdin:

```bash
type examples\smoke-request.json | dotnet run --project src\CodeRehab.DotNetRunner\CodeRehab.DotNetRunner.csproj
```

## Request

```json
{
  "taskId": "async-cache-stampede",
  "language": "csharp",
  "userCode": "public sealed class UserProfileCache { ... }",
  "timeoutMs": 12000,
  "debug": false
}
```

`debug: true` оставляет временную директорию после выполнения. По умолчанию временные файлы удаляются.

## Response

```json
{
  "status": "passed",
  "passed": true,
  "testsPassed": 2,
  "testsTotal": 2,
  "compileOutput": "",
  "runtimeOutput": "",
  "error": null,
  "durationMs": 1234,
  "exitCode": 0,
  "tests": [
    { "name": "Параллельный cache miss загружает профиль один раз", "passed": true, "message": "OK" }
  ]
}
```

Возможные `status`: `passed`, `failed`, `compile_error`, `runtime_error`, `timeout`, `configuration_error`.

## Интеграция с backend

Node backend сохраняет прежний HTTP API. `backend/services/code-runner-service/runner/solutionRunner.mjs` теперь вызывает этот runner как отдельный процесс:

```text
dotnet run --project backend/runners/dotnet-runner/src/CodeRehab.DotNetRunner/CodeRehab.DotNetRunner.csproj -- --request <temp-request.json>
```

После этого adapter преобразует расширенный ответ runner-а в старый frontend-формат `{ passed, total, tests }`.

## Ограничения

Это локальный training runner, а не production sandbox. Он использует временные директории и timeout, но не изолирует CPU, память, файловую систему и сеть на уровне контейнера/OS policy.
