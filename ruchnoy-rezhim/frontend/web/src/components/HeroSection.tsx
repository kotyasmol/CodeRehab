import { Link } from "react-router-dom";
import { CodePreview } from "./CodePreview";

export function HeroSection() {
  return (
    <section className="hero-section">
      <div className="hero-copy">
        <h1>Включи ручной режим</h1>
        <p>
          Маленькие задания на C#, чтобы снова привыкнуть писать код
          самостоятельно
        </p>
        <Link className="primary-button" to="/lessons">
          Начать урок
        </Link>
      </div>

      <div className="hero-board" aria-label="Пример задания">
        <div className="board-tabs">
          <span>task.cs</span>
          <span>ручная сборка</span>
        </div>
        <CodePreview />
      </div>
    </section>
  );
}
