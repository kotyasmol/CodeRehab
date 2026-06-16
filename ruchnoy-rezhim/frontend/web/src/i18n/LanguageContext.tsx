import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AppLanguage = "en" | "ru";

const storageKey = "codeRehab.language";

const dictionaries = {
  en: {
    allTasks: "All tasks",
    backendUnavailable: "Backend is unavailable",
    brand: "Manual Mode",
    brandHomeLabel: "Manual Mode, home",
    catalogIntro:
      "Ten everyday backend tasks: one file, one problem, manual repair without toy algorithms.",
    catalogTitle: "Async backend",
    checkExecution: "Check execution",
    checking: "Checking...",
    codeExampleLabel: "C# code example",
    couldNotStartCheck: "Could not start the check.",
    currentProgress: "Current progress",
    fileEditor: "File editor for",
    hints: "Hints",
    homePracticeBody: "Short tasks without pressure or shame about red test failures.",
    homePracticeTitle: "Today's practice",
    languageLabel: "Language",
    loadingTask: "Loading task",
    login: "Sign in",
    mainNavigation: "Main navigation",
    manualBuild: "manual build",
    navLessons: "Lessons",
    navProgress: "Progress",
    navTasks: "Tasks",
    open: "Open",
    progressBody: "Streaks, completed topics, and first badges will appear here soon.",
    progressItemCode: "C#",
    progressItemStreak: "3-day streak",
    progressItemTasks: "7 tasks written by hand",
    progressTitle: "Progress",
    requestScenario: "Requesting the scenario from the backend API.",
    reset: "Reset",
    runTests: "Run tests",
    smallStepsBody:
      "First the method signature, then the condition, then one test. That is how your hands remember the syntax again.",
    smallStepsTitle: "Write in small steps",
    solutionEditor: "Solution editor",
    solutionPassed: "Solution passed",
    someTestsFailing: "Some tests are failing",
    startLesson: "Start a lesson",
    switchHeroBody: "Small C# tasks that help you get comfortable writing code by hand again",
    switchHeroTitle: "Switch on manual mode",
    taskExample: "Task example",
    taskNotFound: "Task not found",
    toCatalog: "Back to catalog",
    whatToFix: "What to fix",
  },
  ru: {
    allTasks: "Все задания",
    backendUnavailable: "Backend недоступен",
    brand: "Ручной режим",
    brandHomeLabel: "Ручной режим, на главную",
    catalogIntro:
      "Десять задач из обычной рабочей жизни: один файл, одна проблема, ручное исправление без игрушечных алгоритмов.",
    catalogTitle: "Асинхронный backend",
    checkExecution: "Запуск проверки",
    checking: "Проверяем...",
    codeExampleLabel: "Пример кода C#",
    couldNotStartCheck: "Не удалось запустить проверку.",
    currentProgress: "Текущий прогресс",
    fileEditor: "Редактор файла",
    hints: "Подсказки",
    homePracticeBody: "Короткие задания без гонки и стыда за красные ошибки.",
    homePracticeTitle: "Тренировки на сегодня",
    languageLabel: "Язык",
    loadingTask: "Загружаем задание",
    login: "Войти",
    mainNavigation: "Основная навигация",
    manualBuild: "ручная сборка",
    navLessons: "Уроки",
    navProgress: "Прогресс",
    navTasks: "Задания",
    open: "Открыть",
    progressBody: "Здесь скоро будут streak, решенные темы и первые бейджи.",
    progressItemCode: "C#",
    progressItemStreak: "3 дня подряд",
    progressItemTasks: "7 заданий написано руками",
    progressTitle: "Прогресс",
    requestScenario: "Запрашиваем сценарий с backend API.",
    reset: "Сбросить",
    runTests: "Запустить тесты",
    smallStepsBody:
      "Сначала сигнатура метода, потом условие, потом один тест. Так руки снова вспоминают синтаксис.",
    smallStepsTitle: "Пиши маленькими шагами",
    solutionEditor: "Редактор решения",
    solutionPassed: "Решение прошло проверку",
    someTestsFailing: "Есть падающие тесты",
    startLesson: "Начать урок",
    switchHeroBody: "Маленькие задания на C#, чтобы снова привыкнуть писать код самостоятельно",
    switchHeroTitle: "Включи ручной режим",
    taskExample: "Пример задания",
    taskNotFound: "Задание не найдено",
    toCatalog: "К каталогу",
    whatToFix: "Что исправить",
  },
} as const;

type Dictionary = (typeof dictionaries)["en"];

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: keyof Dictionary) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => normalizeLanguage(localStorage.getItem(storageKey)));

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage(nextLanguage) {
        localStorage.setItem(storageKey, nextLanguage);
        setLanguageState(nextLanguage);
      },
      t(key) {
        return dictionaries[language][key];
      },
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useI18n must be used inside LanguageProvider.");
  }

  return value;
}

function normalizeLanguage(value: string | null): AppLanguage {
  return value === "ru" ? "ru" : "en";
}
