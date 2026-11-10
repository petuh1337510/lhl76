"use client";

import { usePathname } from "next/navigation";
import { useAdminUser } from "./admin-session";

const groups = [
  { title: "СОРЕВНОВАНИЯ", links: [["Обзор", "/admin"], ["Сезоны", "/admin/seasons"], ["Соревнования", "/admin/competitions"], ["Матчи и календарь", "/admin/matches"]] },
  { title: "УЧАСТНИКИ", links: [["Команды", "/admin/teams"], ["Игроки", "/admin/players"], ["Дисквалификации", "/admin/suspensions"]] },
  { title: "КОНТЕНТ", links: [["Новости", "/admin/news"], ["Фото", "/admin/media"], ["Медиафайлы", "/admin/media-files"], ["Трансляции", "/admin/broadcasts"], ["Лауреаты", "/admin/laureates"], ["Стадионы", "/admin/venues"], ["Главная страница", "/admin/homepage-content"], ["О лиге", "/admin/league-page"], ["Документы", "/admin/content-library"]] },
  { title: "СИСТЕМА", links: [["Пользователи", "/admin/users"], ["Контроль данных", "/admin/audit"], ["Скорость сайта", "/admin/performance"]] },
];

export default function AdminNav() {
  const pathname = usePathname() ?? "";
  const role = useAdminUser()?.role ?? "";
  const visible=(title:string)=>role==="SUPER_ADMIN"||(role==="ADMIN"&&title!=="СИСТЕМА")||(role==="SECRETARY"&&title==="СОРЕВНОВАНИЯ");
  const isCurrent = (href: string) => pathname === href
    || (href === "/admin/competitions" && ["/admin/standings","/admin/playoff"].includes(pathname))
    || (href === "/admin/teams" && ["/admin/team", "/admin/team-roster"].includes(pathname))
    || (href === "/admin/players" && pathname === "/admin/player")
    || (href === "/admin/matches" && pathname === "/admin/match-protocol");
  return <aside className="adminSide adminSideGlobal" id="admin-navigation" aria-label="Разделы админки">
    <a className="adminBrand" href="/admin" aria-label="Обзор ЛХЛ-76"><span aria-hidden="true">ЛХЛ<br/><b>76</b></span><i>Панель лиги</i></a>
    {groups.filter(group=>visible(group.title)).map((group) => <section key={group.title}><small>{group.title}</small>{group.links.filter(([label])=>role!=="SECRETARY"||["Обзор","Матчи и календарь"].includes(label)).map(([label, href]) => <a key={href} className={`adminNavLink ${isCurrent(href) ? "active" : ""}`} aria-current={isCurrent(href) ? "page" : undefined} href={href}>{label}</a>)}</section>)}
    <button className="adminLogout" onClick={async()=>{await fetch("/api/admin/auth/logout",{method:"POST"});location.href="/admin/login"}}>Выйти</button>
  </aside>;
}
