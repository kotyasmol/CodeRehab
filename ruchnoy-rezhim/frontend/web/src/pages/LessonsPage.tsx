import { useEffect, useState } from "react";
import { LessonCard } from "../components/LessonCard";
import { fetchLessons, type Lesson } from "../data/mockLessons";
import { useI18n } from "../i18n/LanguageContext";

export function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [error, setError] = useState("");
  const { language, t } = useI18n();

  useEffect(() => {
    fetchLessons(language)
      .then(setLessons)
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : t("backendUnavailable"));
      });
  }, [language, t]);

  return (
    <section className="placeholder-page lesson-catalog-page">
      <div className="section-heading">
        <div>
          <h1>{t("catalogTitle")}</h1>
          <p>{t("catalogIntro")}</p>
        </div>
      </div>
      {error && <p className="backend-error">{error}</p>}
      <div className="lesson-grid">
        {lessons.map((lesson) => (
          <LessonCard key={lesson.id} lesson={lesson} />
        ))}
      </div>
    </section>
  );
}
