import { NavLink } from "react-router-dom";
import { useI18n } from "../i18n/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";

export function Header() {
  const { t } = useI18n();
  const navItems = [
    { label: t("navLessons"), to: "/lessons" },
    { label: t("navTasks"), to: "/task/methods-1" },
    { label: t("navProgress"), to: "/progress" },
  ];

  return (
    <header className="site-header">
      <NavLink className="brand" to="/" aria-label={t("brandHomeLabel")}>
        <span className="brand-mark">RR</span>
        <span>{t("brand")}</span>
      </NavLink>

      <nav className="main-nav" aria-label={t("mainNavigation")}>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {item.label}
          </NavLink>
        ))}
        <a href="#login">{t("login")}</a>
        <LanguageToggle />
      </nav>
    </header>
  );
}
