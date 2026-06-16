import { useI18n, type AppLanguage } from "../i18n/LanguageContext";

const options: Array<{ label: string; value: AppLanguage }> = [
  { label: "ENG", value: "en" },
  { label: "RUS", value: "ru" },
];

export function LanguageToggle() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className="language-toggle" aria-label={t("languageLabel")}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={language === option.value ? "language-toggle__button language-toggle__button--active" : "language-toggle__button"}
          onClick={() => setLanguage(option.value)}
          aria-pressed={language === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
