import { useEffect, useState } from "react";
import { LessonCard } from "../components/LessonCard";
import { fetchLessons, type Lesson } from "../data/mockLessons";

export function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchLessons()
      .then(setLessons)
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Backend недоступен");
      });
  }, []);

  return (
    <section className="placeholder-page lesson-catalog-page">
      <div className="section-heading">
        <div>
          <h1>Асинхронный backend</h1>
          <p>
            Десять задач из обычной рабочей жизни: один файл, одна проблема,
            ручное исправление без игрушечных алгоритмов.
          </p>
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
