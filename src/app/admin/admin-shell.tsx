"use client";
import {usePathname} from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "@/components/ui-icon";
import AdminNav from "./admin-nav";

type AdminTheme = "dark" | "light";
const sectionNames: Record<string, string> = {
  admin: "Обзор", seasons: "Сезоны", competitions: "Соревнования", matches: "Матчи и календарь",
  teams: "Команды", team: "Команда", "team-roster": "Заявки команд", players: "Игроки",
  player: "Игрок", suspensions: "Дисквалификации", news: "Новости", media: "Медиагалерея", "media-files": "Медиафайлы",
  broadcasts: "Трансляции", laureates: "Лауреаты", venues: "Стадионы",
  "homepage-content": "Главная страница", "league-page": "О лиге", "content-library": "Документы",
  users: "Пользователи", audit: "Контроль данных", standings: "Турнирные таблицы",
  playoff: "Плей-офф", "match-protocol": "Протокол матча", division: "Дивизион",
};

export default function AdminShell({children, initialTheme}:{children:React.ReactNode;initialTheme:AdminTheme}) {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<AdminTheme>(initialTheme);
  const menuButton = useRef<HTMLButtonElement>(null);
  const selectTheme = (nextTheme: AdminTheme) => {
    setTheme(nextTheme);
    document.cookie = `lhl76_admin_theme=${nextTheme}; Path=/admin; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  };
  useEffect(() => { setMenuOpen(false); }, [path]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);
  const themeSwitch = <div className="adminThemeSwitch" role="group" aria-label="Тема оформления">
    <button type="button" aria-pressed={theme === "dark"} onClick={() => selectTheme("dark")}>Тёмная</button>
    <button type="button" aria-pressed={theme === "light"} onClick={() => selectTheme("light")}>Светлая</button>
  </div>;
  if(path==="/admin/login"||path==="/admin/setup") return <div className="adminUI adminAuthShell" data-theme={theme}><div className="adminAuthTheme">{themeSwitch}</div>{children}</div>;
  const currentSection = sectionNames[path.split("/").filter(Boolean).slice(-1)[0]] ?? "Панель управления";
  return <div className={`adminUI adminShell adminShellGlobal${menuOpen ? " adminMenuOpen" : ""}`} data-theme={theme}>
    <a className="adminSkip" href="#admin-content">Перейти к содержимому</a>
    <div className="adminMobileBar"><a href="/">ЛХЛ-76</a><button ref={menuButton} type="button" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen(!menuOpen)}><UiIcon name="menu" />{menuOpen ? "Закрыть меню" : "Меню админки"}</button></div>
    <AdminNav/><div className="adminPageHost" id="admin-content" tabIndex={-1}><div className="adminToolbar"><div className="adminToolbarContext"><span>ЛХЛ-76</span><b>{currentSection}</b></div><div className="adminToolbarActions">{themeSwitch}<a href="/" className="adminToolbarSite">Открыть сайт <span aria-hidden="true">↗</span></a></div></div>{children}</div>
  </div>;
}
