# Submission Service

Отправка решений реализована в локальном backend API:

- `POST /api/submissions/check` принимает `lessonId` и `code`.
- backend запускает code-runner и возвращает submission с `passed` / `failed` статусом.
- результаты хранятся в памяти процесса и доступны через `GET /api/submissions/:id`.

На следующем этапе это можно вынести в отдельный сервис с постоянной БД, очередью и воркерами.
