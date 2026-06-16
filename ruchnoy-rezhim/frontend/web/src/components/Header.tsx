import { NavLink } from "react-router-dom";

const navItems = [
  { label: "Уроки", to: "/lessons" },
  { label: "Задания", to: "/task/methods-1" },
  { label: "Прогресс", to: "/progress" },
];

export function Header() {
  return (
    <header className="site-header">
      <NavLink className="brand" to="/" aria-label="Ручной режим, на главную">
        <span className="brand-mark">RR</span>
        <span>Ручной режим</span>
      </NavLink>

      <nav className="main-nav" aria-label="Основная навигация">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {item.label}
          </NavLink>
        ))}
        <a href="#login">Войти</a>
      </nav>
    </header>
  );
}
