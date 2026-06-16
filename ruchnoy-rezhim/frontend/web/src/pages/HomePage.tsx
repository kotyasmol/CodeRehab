import { useEffect, useState } from "react";
import { CodePreview } from "../components/CodePreview";
import { HeroSection } from "../components/HeroSection";
import { LessonCard } from "../components/LessonCard";
import { ProgressStrip } from "../components/ProgressStrip";
import { TopicTicker } from "../components/TopicTicker";
import { fetchLessons, type Lesson } from "../data/mockLessons";
import { useI18n } from "../i18n/LanguageContext";

export function HomePage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const { language, t } = useI18n();

  useEffect(() => {
    fetchLessons(language)
      .then((items) => setLessons(items.slice(0, 3)))
      .catch(() => setLessons([]));
  }, [language]);

  return (
    <>
      <HeroSection />
      <TopicTicker />

      <section className="home-section lessons-preview">
        <div className="section-heading">
          <h2>{t("homePracticeTitle")}</h2>
          <p>{t("homePracticeBody")}</p>
        </div>
        <div className="lesson-grid">
          {lessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </div>
      </section>

      <section className="home-section code-lab-section">
        <div>
          <h2>{t("smallStepsTitle")}</h2>
          <p>{t("smallStepsBody")}</p>
        </div>
        <CodePreview />
      </section>

      <ProgressStrip />
    </>
  );
}
