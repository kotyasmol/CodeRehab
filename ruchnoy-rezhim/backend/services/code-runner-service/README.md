# Code Runner Service

Local integration layer for checking C# solutions.

`runner/solutionRunner.mjs` is now a Node adapter: the backend API calls it as before, and the adapter starts the separate .NET runner in `backend/runners/dotnet-runner`.

The .NET runner creates a temporary console project, adds the submitted `UserSolution.cs`, shared `.cs` templates, and a task-specific harness, runs `dotnet restore`, `dotnet build`, and `dotnet run` with a timeout, then returns structured JSON. The adapter converts that response into the existing frontend format `{ passed, total, tests }`.

This is behavioral checking, not file comparison. Production mode still needs process isolation, resource limits, and network restrictions at the sandbox level.
