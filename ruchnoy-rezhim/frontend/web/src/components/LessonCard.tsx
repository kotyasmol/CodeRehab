import { Link } from "react-router-dom";
import type { Lesson } from "../data/mockLessons";

type LessonCardProps = {
  lesson: Lesson;
};

export function LessonCard({ lesson }: LessonCardProps) {
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
        <Link to={`/task/${lesson.id}`}>Открыть</Link>
      </div>
    </article>
  );
}
