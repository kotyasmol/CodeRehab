import { Link } from "react-router-dom";
import { useI18n } from "../i18n/LanguageContext";
import { CodePreview } from "./CodePreview";

export function HeroSection() {
  const { t } = useI18n();

  return (
    <section className="hero-section">
      <div className="hero-copy">
        <h1>{t("switchHeroTitle")}</h1>
        <p>{t("switchHeroBody")}</p>
        <Link className="primary-button" to="/lessons">
          {t("startLesson")}
        </Link>
      </div>

      <div className="hero-board" aria-label={t("taskExample")}>
        <div className="board-tabs">
          <span>task.cs</span>
          <span>{t("manualBuild")}</span>
        </div>
        <CodePreview />
      </div>
    </section>
  );
}
