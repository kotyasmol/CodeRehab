export type Lesson = {
  id: string;
  title: string;
  topic: string;
  duration: string;
  level: string;
  description: string;
  accent: "olive" | "coral" | "green";
  fileName: string;
  goal: string;
  tasks: string[];
  hints: string[];
  starterCode: string;
};

export type TestResult = {
  name: string;
  passed: boolean;
  message: string;
};

export type CheckResponse = {
  passed: number;
  total: number;
  tests: TestResult[];
};

export type SubmissionResponse = {
  id: string;
  lessonId: string;
  createdAt: string;
  status: "passed" | "failed";
  result: CheckResponse;
};

export async function fetchLessons(language = "en") {
  const response = await fetch(`/api/lessons?lang=${encodeURIComponent(language)}`);
  return parseJson<Lesson[]>(response);
}

export async function fetchLesson(id: string, language = "en") {
  const response = await fetch(`/api/lessons/${id}?lang=${encodeURIComponent(language)}`);
  return parseJson<Lesson>(response);
}

export async function checkSolution(lessonId: string, code: string, uiLanguage = "en") {
  const response = await fetch("/api/submissions/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lessonId, code, uiLanguage }),
  });

  return parseJson<SubmissionResponse>(response);
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.error ?? "Backend request failed");
  }

  return payload as T;
}
