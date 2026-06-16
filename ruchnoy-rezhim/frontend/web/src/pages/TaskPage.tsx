import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { checkSolution, fetchLesson, type CheckResponse, type Lesson } from "../data/mockLessons";
import { useI18n } from "../i18n/LanguageContext";

export function TaskPage() {
  const { id } = useParams();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loadError, setLoadError] = useState("");
  const storageKey = useMemo(() => (lesson ? `solution:${lesson.id}` : ""), [lesson]);
  const [code, setCode] = useState("");
  const [checkResult, setCheckResult] = useState<CheckResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const { language, t } = useI18n();

  useEffect(() => {
    if (!id) {
      return;
    }

    setLesson(null);
    setLoadError("");
    fetchLesson(id, language)
      .then(setLesson)
      .catch((requestError) => {
        setLoadError(requestError instanceof Error ? requestError.message : t("backendUnavailable"));
      });
  }, [id, language, t]);

  useEffect(() => {
    if (!lesson) {
      return;
    }

    setCode(localStorage.getItem(`solution:${lesson.id}`) ?? lesson.starterCode);
    setCheckResult(null);
  }, [lesson]);

  useEffect(() => {
    if (storageKey && code) {
      localStorage.setItem(storageKey, code);
    }
  }, [code, storageKey]);

  if (loadError) {
    return (
      <section className="placeholder-page">
        <h1>{t("taskNotFound")}</h1>
        <p>{loadError}</p>
        <Link className="primary-button" to="/lessons">
          {t("toCatalog")}
        </Link>
      </section>
    );
  }

  if (!lesson) {
    return (
      <section className="placeholder-page">
        <h1>{t("loadingTask")}</h1>
        <p>{t("requestScenario")}</p>
      </section>
    );
  }

  async function runCheck() {
    if (!lesson) {
      return;
    }

    setIsChecking(true);
    setCheckResult(null);

    try {
      const submission = await checkSolution(lesson.id, code, language);
      setCheckResult(submission.result);
    } catch (error) {
      setCheckResult({
        passed: 0,
        total: 1,
        tests: [
          {
            name: t("checkExecution"),
            passed: false,
            message: error instanceof Error ? error.message : t("couldNotStartCheck"),
          },
        ],
      });
    } finally {
      setIsChecking(false);
    }
  }

  const allPassed = checkResult !== null && checkResult.passed === checkResult.total;

  return (
    <section className="placeholder-page task-page">
      <div className="task-page__intro">
        <div>
          <div className="lesson-card__stickers">
            <span>{lesson.topic}</span>
            <span>{lesson.duration}</span>
            <span>{lesson.level}</span>
          </div>
          <h1>{lesson.title}</h1>
          <p>{lesson.goal}</p>
        </div>
        <Link className="primary-button" to="/lessons">
          {t("allTasks")}
        </Link>
      </div>

      <div className="task-layout">
        <aside className="task-brief">
          <span className="task-file-name">{lesson.fileName}</span>
          <p>{lesson.description}</p>

          <h2>{t("whatToFix")}</h2>
          <ul>
            {lesson.tasks.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ul>

          <h2>{t("hints")}</h2>
          <ol>
            {lesson.hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ol>
        </aside>

        <div className="task-workbench">
          <div className="task-workbench__toolbar">
            <span>{t("solutionEditor")}</span>
            <div>
              <button type="button" onClick={() => setCode(lesson.starterCode)}>
                {t("reset")}
              </button>
              <button type="button" onClick={runCheck} disabled={isChecking}>
                {isChecking ? t("checking") : t("runTests")}
              </button>
            </div>
          </div>
          <textarea
            className="task-code-editor"
            aria-label={`${t("fileEditor")} ${lesson.fileName}`}
            spellCheck={false}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />

          {checkResult && (
            <section className={`check-panel ${allPassed ? "check-panel--passed" : "check-panel--failed"}`}>
              <div className="check-panel__summary">
                <h2>{allPassed ? t("solutionPassed") : t("someTestsFailing")}</h2>
                <span>
                  {checkResult.passed}/{checkResult.total}
                </span>
              </div>
              <ul>
                {checkResult.tests.map((test) => (
                  <li key={test.name} className={test.passed ? "test-result--passed" : "test-result--failed"}>
                    <strong>{test.passed ? "OK" : "FAIL"} · {test.name}</strong>
                    <p>{test.message}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
