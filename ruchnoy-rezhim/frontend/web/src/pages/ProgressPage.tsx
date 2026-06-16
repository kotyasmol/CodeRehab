import { useI18n } from "../i18n/LanguageContext";

export function ProgressPage() {
  const { t } = useI18n();

  return (
    <section className="placeholder-page">
      <h1>{t("progressTitle")}</h1>
      <p>{t("progressBody")}</p>
    </section>
  );
}
