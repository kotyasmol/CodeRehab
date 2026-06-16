# CodeRehab.DotNetRunner

Standalone .NET runner for checking C# solutions in CodeRehab / ruchnoy-rezhim.

The runner accepts a JSON request, creates a temporary `.NET` console project, copies the submitted `UserSolution.cs`, shared support code, and a task-specific harness from `Templates/Harnesses`, runs `dotnet restore`, `dotnet build`, and `dotnet run` with timeouts, then returns structured JSON.

## Structure

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

## Run

```bash
dotnet restore CodeRehab.DotNetRunner.sln
dotnet build CodeRehab.DotNetRunner.sln
dotnet test CodeRehab.DotNetRunner.sln
```

Smoke-run:

```bash
dotnet run --project src/CodeRehab.DotNetRunner/CodeRehab.DotNetRunner.csproj -- --request examples/smoke-request.json
```

You can also pass JSON through stdin:

```bash
type examples\smoke-request.json | dotnet run --project src\CodeRehab.DotNetRunner\CodeRehab.DotNetRunner.csproj
```

## Request

```json
{
  "taskId": "async-cache-stampede",
  "language": "csharp",
  "locale": "en",
  "userCode": "public sealed class UserProfileCache { ... }",
  "timeoutMs": 12000,
  "debug": false
}
```

`debug: true` keeps the temporary workspace after execution. Temporary files are deleted by default.

`locale` controls runner-facing messages. Supported values are `en` and `ru`.

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
    { "name": "Parallel cache miss loads the profile once", "passed": true, "message": "OK" }
  ]
}
```

Possible `status` values: `passed`, `failed`, `compile_error`, `runtime_error`, `timeout`, `configuration_error`.

## Backend Integration

The Node backend keeps the existing HTTP API. `backend/services/code-runner-service/runner/solutionRunner.mjs` calls this runner as a separate process:

```text
dotnet run --project backend/runners/dotnet-runner/src/CodeRehab.DotNetRunner/CodeRehab.DotNetRunner.csproj -- --request <temp-request.json>
```

The adapter converts the extended runner response back to the frontend format `{ passed, total, tests }`.

## Docker

Project-level Docker Compose builds a backend image with Node.js plus the .NET SDK. That image runs the Node API and uses this runner for C# submissions.

```bash
cd ../../..
docker compose up --build
```

## Limitations

This is a local training runner, not a production sandbox. It uses temporary directories and timeouts, but it does not isolate CPU, memory, the filesystem, or the network at the container/OS policy level.
