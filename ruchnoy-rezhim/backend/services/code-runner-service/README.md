# Code Runner Service

Локальный слой интеграции проверки C#-решений.

`runner/solutionRunner.mjs` теперь является Node-адаптером: backend API вызывает его как раньше, а adapter запускает отдельный .NET runner из `backend/runners/dotnet-runner`.

.NET runner создает временный console-проект, добавляет пользовательский `UserSolution.cs`, общие `.cs` шаблоны и task-specific harness, выполняет `dotnet restore`, `dotnet build`, `dotnet run` с timeout и возвращает структурированный JSON. Adapter преобразует этот ответ в прежний frontend-формат `{ passed, total, tests }`.

Это поведенческая проверка, а не сравнение файлов. Для production-режима потребуется отдельная изоляция процесса, лимиты ресурсов и запрет сети на уровне sandbox.
