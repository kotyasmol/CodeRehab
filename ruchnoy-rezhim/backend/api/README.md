# Backend API

Local backend for CodeRehab.

Endpoints:

- `GET /health` - service health check.
- `GET /api/lessons?lang=en|ru` - localized training task catalog.
- `GET /api/lessons/:id?lang=en|ru` - one localized task.
- `POST /api/submissions/check` - run a submitted solution through behavioral tests.
- `GET /api/submissions/:id` - read an in-memory submission result.
- `GET /api/submissions?lessonId=...` - read in-memory submission history.

Run from `frontend/web`:

```bash
npm run dev:backend
```

The frontend dev server proxies `/api` to `http://127.0.0.1:5088`.

For C# submissions, the API calls the .NET runner at `backend/runners/dotnet-runner` through the `code-runner-service` adapter. The HTTP endpoint shape is unchanged.

`POST /api/submissions/check` accepts optional `uiLanguage: "en" | "ru"` and returns runner test messages in that locale.

Docker sets:

- `CODE_REHAB_BACKEND_HOST=0.0.0.0`
- `CODE_REHAB_BACKEND_PORT=5088`
- `CODE_REHAB_CORS_ORIGINS=...`

Without Docker the backend still defaults to `127.0.0.1:5088`.
