# Submission Service

Solution submission is currently implemented in the local backend API:

- `POST /api/submissions/check` accepts `lessonId` and `code`.
- The backend starts the code runner and returns a submission with `passed` / `failed` status.
- Results are stored in process memory and are available through `GET /api/submissions/:id`.

A later phase can move this into a separate service with persistent storage, a queue, and workers.
