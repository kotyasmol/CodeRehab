import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSolutionCheck } from "../services/code-runner-service/runner/solutionRunner.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const lessonPaths = {
  en: resolve(__dirname, "../../shared/data/lessons.json"),
  ru: resolve(__dirname, "../../shared/data/lessons.ru.json"),
};
const port = Number(process.env.CODE_REHAB_BACKEND_PORT ?? 5088);
const host = process.env.CODE_REHAB_BACKEND_HOST ?? "127.0.0.1";
const corsOrigins = (process.env.CODE_REHAB_CORS_ORIGINS ?? "http://127.0.0.1:5173,http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const submissions = new Map();

const cachedLessons = new Map();

const server = createServer(async (request, response) => {
  try {
    setCorsHeaders(request, response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "code-rehab-backend" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/lessons") {
      const lessons = await loadLessons(getRequestedLanguage(url));
      sendJson(response, 200, lessons);
      return;
    }

    const lessonMatch = url.pathname.match(/^\/api\/lessons\/([^/]+)$/);
    if (request.method === "GET" && lessonMatch) {
      const lesson = (await loadLessons(getRequestedLanguage(url))).find((item) => item.id === lessonMatch[1]);
      sendJson(response, lesson ? 200 : 404, lesson ?? { error: "Lesson not found" });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/submissions/check") {
      const body = await readJson(request);
      const uiLanguage = normalizeLanguage(body.uiLanguage);
      const lessons = await loadLessons(uiLanguage);
      const lesson = lessons.find((item) => item.id === body.lessonId);

      if (!lesson) {
        sendJson(response, 404, { error: "Lesson not found" });
        return;
      }

      if (typeof body.code !== "string" || body.code.trim().length === 0) {
        sendJson(response, 400, { error: "Code is required" });
        return;
      }

      const check = await runSolutionCheck(lesson.id, body.code, uiLanguage);
      const submission = {
        id: randomUUID(),
        lessonId: lesson.id,
        createdAt: new Date().toISOString(),
        status: check.passed === check.total ? "passed" : "failed",
        result: check,
      };

      submissions.set(submission.id, submission);
      sendJson(response, 200, submission);
      return;
    }

    const submissionMatch = url.pathname.match(/^\/api\/submissions\/([^/]+)$/);
    if (request.method === "GET" && submissionMatch) {
      const submission = submissions.get(submissionMatch[1]);
      sendJson(response, submission ? 200 : 404, submission ?? { error: "Submission not found" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/submissions") {
      const lessonId = url.searchParams.get("lessonId");
      const items = [...submissions.values()]
        .filter((item) => !lessonId || item.lessonId === lessonId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      sendJson(response, 200, items);
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 500, {
      error: "Backend error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, host, () => {
  console.log(`CodeRehab backend listening on http://${host}:${port}`);
});

async function loadLessons(language = "en") {
  const normalizedLanguage = normalizeLanguage(language);

  if (!cachedLessons.has(normalizedLanguage)) {
    cachedLessons.set(normalizedLanguage, JSON.parse(await readFile(lessonPaths[normalizedLanguage], "utf8")));
  }

  return cachedLessons.get(normalizedLanguage);
}

function getRequestedLanguage(url) {
  return normalizeLanguage(url.searchParams.get("lang"));
}

function normalizeLanguage(value) {
  return value === "ru" || value === "rus" ? "ru" : "en";
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("error", reject);
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function setCorsHeaders(request, response) {
  const requestOrigin = request.headers.origin;
  const allowedOrigin =
    corsOrigins.includes("*") || !requestOrigin || corsOrigins.includes(requestOrigin)
      ? (corsOrigins.includes("*") ? "*" : requestOrigin ?? corsOrigins[0])
      : corsOrigins[0];

  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
