import { useI18n } from "../i18n/LanguageContext";

export function ProgressStrip() {
  const { t } = useI18n();
  const progressItems = [t("progressItemTasks"), t("progressItemStreak"), t("progressItemCode")];

  return (
    <section className="progress-strip" aria-label={t("currentProgress")}>
      {progressItems.map((item) => (
        <div key={item} className="progress-pill">
          {item}
        </div>
      ))}
    </section>
  );
}
