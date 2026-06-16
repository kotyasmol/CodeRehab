import { useEffect, useState } from "react";
import { CodePreview } from "../components/CodePreview";
import { HeroSection } from "../components/HeroSection";
import { LessonCard } from "../components/LessonCard";
import { ProgressStrip } from "../components/ProgressStrip";
import { TopicTicker } from "../components/TopicTicker";
import { fetchLessons, type Lesson } from "../data/mockLessons";

export function HomePage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);

  useEffect(() => {
    fetchLessons()
      .then((items) => setLessons(items.slice(0, 3)))
      .catch(() => setLessons([]));
  }, []);

  return (
    <>
      <HeroSection />
      <TopicTicker />

      <section className="home-section lessons-preview">
        <div className="section-heading">
          <h2>Тренировки на сегодня</h2>
          <p>Короткие задания без гонки и стыда за красные ошибки.</p>
        </div>
        <div className="lesson-grid">
          {lessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </div>
      </section>

      <section className="home-section code-lab-section">
        <div>
          <h2>Пиши маленькими шагами</h2>
          <p>
            Сначала сигнатура метода, потом условие, потом один тест. Так руки
            снова вспоминают синтаксис.
          </p>
        </div>
        <CodePreview />
      </section>

      <ProgressStrip />
    </>
  );
}
