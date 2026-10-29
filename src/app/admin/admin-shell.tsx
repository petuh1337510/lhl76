"use client";
import {usePathname} from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "@/components/ui-icon";
import AdminNav from "./admin-nav";
export default function AdminShell({children}:{children:React.ReactNode}) {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { setMenuOpen(false); }, [path]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);
  if(path==="/admin/login"||path==="/admin/setup") return <div className="adminUI">{children}</div>;
  return <div className={`adminUI adminShell adminShellGlobal${menuOpen ? " adminMenuOpen" : ""}`}>
    <a className="adminSkip" href="#admin-content">Перейти к содержимому</a>
    <div className="adminMobileBar"><a href="/">ЛХЛ-76</a><button ref={menuButton} type="button" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen(!menuOpen)}><UiIcon name="menu" />{menuOpen ? "Закрыть меню" : "Меню админки"}</button></div>
    <AdminNav/><div className="adminPageHost" id="admin-content" tabIndex={-1}>{children}</div>
  </div>;
}
