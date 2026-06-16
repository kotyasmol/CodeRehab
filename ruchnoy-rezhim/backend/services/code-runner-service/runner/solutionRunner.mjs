import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const runnerProjectPath = resolve(
  __dirname,
  "../../../runners/dotnet-runner/src/CodeRehab.DotNetRunner/CodeRehab.DotNetRunner.csproj",
);

const runTimeoutMs = 12000;

export async function runSolutionCheck(lessonId, code) {
  const request = {
    taskId: lessonId,
    language: "csharp",
    userCode: code,
    timeoutMs: runTimeoutMs,
  };

  try {
    const runnerResult = await invokeDotNetRunner(request);
    return toLegacyCheckResult(runnerResult);
  } catch (error) {
    return failedRun(error);
  }
}

async function invokeDotNetRunner(request) {
  const workdir = await mkdtemp(join(tmpdir(), "ruchnoy-runner-request-"));
  const requestPath = join(workdir, "request.json");

  try {
    await writeFile(requestPath, JSON.stringify(request), "utf8");

    try {
      const { stdout } = await execFileAsync(
        "dotnet",
        ["run", "--project", runnerProjectPath, "--", "--request", requestPath],
        {
          cwd: resolve(__dirname, "../../../runners/dotnet-runner"),
          timeout: runTimeoutMs + 180000,
          maxBuffer: 1024 * 1024 * 8,
        },
      );

      const parsed = parseRunnerJson(stdout);
      if (!parsed) {
        throw new Error("dotnet-runner did not return JSON.");
      }

      return parsed;
    } catch (error) {
      const parsed = parseRunnerJson(error.stdout ?? "");
      if (parsed) {
        return parsed;
      }

      throw error;
    }
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

function parseRunnerJson(stdout) {
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index--) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      // dotnet run may print restore/build noise before the runner JSON.
    }
  }

  return null;
}

function toLegacyCheckResult(runnerResult) {
  const tests = Array.isArray(runnerResult.tests) && runnerResult.tests.length > 0
    ? runnerResult.tests.map((test) => ({
        name: test.name,
        passed: Boolean(test.passed),
        message: test.message ?? "",
      }))
    : [fallbackTest(runnerResult)];

  const passed = Number.isFinite(runnerResult.testsPassed)
    ? runnerResult.testsPassed
    : tests.filter((test) => test.passed).length;

  const total = Number.isFinite(runnerResult.testsTotal)
    ? runnerResult.testsTotal
    : tests.length;

  return { passed, total, tests };
}

function fallbackTest(runnerResult) {
  return {
    name: statusName(runnerResult.status),
    passed: Boolean(runnerResult.passed),
    message:
      runnerResult.error ??
      runnerResult.compileOutput ??
      runnerResult.runtimeOutput ??
      "Runner did not return test details.",
  };
}

function statusName(status) {
  switch (status) {
    case "timeout":
      return "Код завершился по таймауту";
    case "compile_error":
      return "Компиляция";
    case "configuration_error":
      return "Конфигурация проверки";
    default:
      return "Компиляция или запуск";
  }
}

function failedRun(error) {
  const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`.trim();
  const timedOut = error.killed || error.signal === "SIGTERM";

  return {
    passed: 0,
    total: 1,
    tests: [
      {
        name: timedOut ? "Код завершился по таймауту" : "Компиляция или запуск",
        passed: false,
        message: timedOut
          ? "Проверка не завершилась за 12 секунд. Обычно это зависший await, .Result, Wait или неучтенная отмена."
          : trimOutput(output),
      },
    ],
  };
}

function trimOutput(output) {
  if (!output) {
    return "dotnet-runner завершился с ошибкой без диагностического вывода.";
  }

  return output.split(/\r?\n/).slice(-24).join("\n");
}
