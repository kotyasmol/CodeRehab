import { Route, Routes } from "react-router-dom";
import { Header } from "../components/Header";
import { HomePage } from "../pages/HomePage";
import { LessonsPage } from "../pages/LessonsPage";
import { ProgressPage } from "../pages/ProgressPage";
import { TaskPage } from "../pages/TaskPage";

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lessons" element={<LessonsPage />} />
          <Route path="/task/:id" element={<TaskPage />} />
          <Route path="/progress" element={<ProgressPage />} />
        </Routes>
      </main>
    </div>
  );
}
