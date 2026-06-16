import { Link } from "react-router-dom";
import type { Lesson } from "../data/mockLessons";
import { useI18n } from "../i18n/LanguageContext";

type LessonCardProps = {
  lesson: Lesson;
};

export function LessonCard({ lesson }: LessonCardProps) {
  const { t } = useI18n();

  return (
    <article className={`lesson-card lesson-card--${lesson.accent}`}>
      <div className="lesson-card__stickers">
        <span>{lesson.topic}</span>
        <span>{lesson.duration}</span>
      </div>
      <h3>{lesson.title}</h3>
      <p>{lesson.description}</p>
      <div className="lesson-card__footer">
        <span>{lesson.level}</span>
        <Link to={`/task/${lesson.id}`}>{t("open")}</Link>
      </div>
    </article>
  );
}
