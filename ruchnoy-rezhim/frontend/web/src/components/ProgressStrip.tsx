const progressItems = ["7 заданий написано руками", "3 дня подряд", "C#"];

export function ProgressStrip() {
  return (
    <section className="progress-strip" aria-label="Текущий прогресс">
      {progressItems.map((item) => (
        <div key={item} className="progress-pill">
          {item}
        </div>
      ))}
    </section>
  );
}
