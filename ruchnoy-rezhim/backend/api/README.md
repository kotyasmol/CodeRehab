# Backend API

Local backend for CodeRehab.

Endpoints:

- `GET /health` - service health check.
- `GET /api/lessons` - training task catalog from `shared/data/lessons.json`.
- `GET /api/lessons/:id` - one task.
- `POST /api/submissions/check` - run a submitted solution through behavioral tests.
- `GET /api/submissions/:id` - read an in-memory submission result.
- `GET /api/submissions?lessonId=...` - read in-memory submission history.

Run from `frontend/web`:

```bash
npm run dev:backend
```

The frontend dev server proxies `/api` to `http://127.0.0.1:5088`.

For C# submissions, the API calls the .NET runner at `backend/runners/dotnet-runner` through the `code-runner-service` adapter. The HTTP endpoint shape is unchanged.
