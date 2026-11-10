"use client";

import { PublicImage } from "@/components/public-image";


import Link from "next/link";
import { UiIcon } from "@/components/ui-icon";
import { createContext, useContext, useEffect, useRef } from "react";
import { usePublicLocation } from "@/components/use-public-url-state";
import type { PublicSiteContext } from "@/lib/public-site-context";
import styles from "./public-admin-return.module.css";

const fallback = {
  championshipHref: "/championship/current",
  calendarHref: "/championship/current?tab=calendar",
  playersHref: "/championship/current?tab=statistics",
};
const vkUrl = "https://vk.ru/lhl76";

const SiteContext = createContext<PublicSiteContext | null>(null);
const AdminNameContext = createContext<string | null>(null);
export function PublicSiteProvider({ context, adminName = null, children }: { context: PublicSiteContext | null; adminName?: string | null; children: React.ReactNode }) {
  return <SiteContext.Provider value={context}><AdminNameContext.Provider value={adminName}>{children}</AdminNameContext.Provider></SiteContext.Provider>;
}
function usePublicSiteContext() { return useContext(SiteContext); }

export function PublicSiteHeader() {
  const header = useRef<HTMLElement>(null);
  const location = usePublicLocation();
  useEffect(() => {
    const root = header.current;
    if (!root) return;
    root.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(menu => menu.open = false);
    const current = new URL(location, window.location.origin);
    root.querySelectorAll<HTMLAnchorElement>("nav a, .mobileMenu a").forEach(link => {
      const target = new URL(link.href);
      const active = target.pathname === current.pathname && (target.searchParams.get("tab") || "table") === (current.searchParams.get("tab") || "table");
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    const close = (event: PointerEvent) => {
      if (!root.contains(event.target as Node)) root.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(menu => menu.open = false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [location]);
  const context = usePublicSiteContext();
  const adminName = useContext(AdminNameContext);
  const championshipHref = context?.championshipHref ?? fallback.championshipHref;
  const calendarHref = context?.calendarHref ?? fallback.calendarHref;
  const tournaments = context?.tournaments.filter(t=>!/памяти.*(локо|локомотив)/i.test(t.name)) ?? [];
  return <header ref={header} className="siteHeader siteHeaderLeague"
    onClick={event => { if ((event.target as Element).closest("a")) header.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(menu => menu.open = false); }}
    onKeyDown={event => {
      if (event.key !== "Escape") return;
      const mobile = header.current?.querySelector<HTMLDetailsElement>("details[open]");
      if (mobile) { mobile.open = false; mobile.querySelector<HTMLElement>("summary")?.focus(); }
      const dropdown = (event.target as Element).closest<HTMLElement>(".siteDropdown");
      if (dropdown) { dropdown.dataset.dismissed = "true"; dropdown.querySelector<HTMLElement>("a")?.focus(); }
    }}
    onPointerOver={event => { const dropdown = (event.target as Element).closest<HTMLElement>(".siteDropdown"); if (dropdown) delete dropdown.dataset.dismissed; }}
    onBlur={event => { const dropdown = (event.target as Element).closest<HTMLElement>(".siteDropdown"); if (dropdown && !dropdown.contains(event.relatedTarget as Node)) delete dropdown.dataset.dismissed; }}
  >
    <div className="leagueMasthead"><div className={`leagueMastheadInner${adminName ? ` ${styles.signedIn}` : ""}`}>
      <Link className="leagueBrand" href="/"><PublicImage width={160} height={160} sizes="160px" priority src="/images/lhl76-logo.jpg" alt="ЛХЛ-76" /><span>Любительская<br />хоккейная лига<br />Ярославль</span></Link>
      <div className="leagueMotto"><b>Хоккей объединяет!</b><i /></div>
      <div className="leagueSocial" aria-label="Социальные сети"><a href={vkUrl} target="_blank" rel="noopener noreferrer" aria-label="ВКонтакте"><UiIcon name="vk" /></a></div>
      {adminName && <a className={styles.returnLink} href="/admin" aria-label={`Вернуться в админку. Вы вошли как ${adminName}`}>
        <span title={adminName}>{adminName}</span><strong>В админку <span aria-hidden="true">↗</span></strong>
      </a>}
      <details className="mobileMenu"><summary aria-label="Открыть меню"><UiIcon name="menu" /></summary><div><Link href="/about">О нас</Link><Link href="/documents">Документы</Link><Link href="/venues">Стадионы</Link><Link href={championshipHref}>Чемпионат</Link><Link href={calendarHref}>Календарь</Link><Link href="/tournaments">Турниры</Link><Link href="/teams">Команды</Link><Link href="/media">Фото</Link><Link href="/news">Новости</Link><Link href="/broadcasts">Трансляции</Link></div></details>
    </div></div>
    <div className="siteHeaderNav"><div className="siteHeaderInner">
      <nav aria-label="Главное меню">
        <span className="siteDropdown"><Link href="/about">Информация</Link><span className="siteDropdownMenu"><div><Link href="/about">О нас</Link><Link href="/documents">Документы</Link><Link href="/venues">Стадионы</Link></div></span></span>
        <span className="siteDropdown"><Link href={championshipHref}>Чемпионат</Link><span className="siteDropdownMenu"><div><Link href={championshipHref}>{context ? `Чемпионат ${context.season.name}` : 'Текущий чемпионат'}</Link>{context?.seasons.filter((season) => season.slug !== context.season.slug).map((season) => <Link href={season.href} key={season.slug}>Чемпионат {season.name}</Link>)}</div></span></span>
        <Link href={calendarHref}>Календарь</Link>
        {tournaments.length?<span className="siteDropdown"><Link href="/tournaments">Турниры</Link><span className="siteDropdownMenu"><div>{tournaments.map(t=><Link href={t.href} key={t.slug}>{t.name}</Link>)}</div></span></span>:<Link href="/tournaments">Турниры</Link>}
        <Link href="/media">Фото</Link>
        <span className="siteDropdown"><Link href="/news">Новости</Link><span className="siteDropdownMenu"><div><Link href="/news">Новости</Link><Link href="/broadcasts">Трансляции</Link></div></span></span>
      </nav>
      <Link className="headerSearch" href={context?.playersHref ?? fallback.playersHref} aria-label="Статистика игроков"><UiIcon name="search" /></Link>
    </div></div>
  </header>;
}

export function PublicSiteFooter({ global = false }: { global?: boolean }) {
  const context = usePublicSiteContext();
  const championshipHref = context?.championshipHref ?? fallback.championshipHref;
  const playersHref = context?.playersHref ?? fallback.playersHref;
  return <footer className={`siteFooter siteFooterModern${global ? "" : " inlineSiteFooter"}`}>
    <div className="siteFooterMain">
      <div className="siteFooterBrand">
        <Link href="/" aria-label="На главную ЛХЛ-76"><PublicImage width={160} height={160} sizes="160px" src="/images/lhl76-logo.jpg" alt="Логотип ЛХЛ-76" /><span>Любительская<br />хоккейная<br />лига<br />Ярославль</span></Link>
      </div>
      <nav className="siteFooterColumn" aria-label="О лиге">
        <strong>О лиге</strong>
        <Link href="/about">О ЛХЛ-76</Link>
        <Link href="/news">Новости</Link>
        <Link href="/documents">Документы</Link>
        <Link href="/venues">Стадионы</Link>
      </nav>
      <nav className="siteFooterColumn" aria-label="Соревнования">
        <strong>Соревнования</strong>
        <Link href={championshipHref}>Чемпионат</Link>
        <Link href={context?.calendarHref ?? fallback.calendarHref}>Календарь</Link>
        <Link href="/tournaments">Турниры</Link>
        <Link href="/teams">Команды</Link>
      </nav>
      <nav className="siteFooterColumn" aria-label="Медиа и статистика">
        <strong>Медиа и статистика</strong>
        <Link href={playersHref}>Игроки</Link>
        <Link href="/media">Фото</Link>
        <Link href="/broadcasts">Трансляции</Link>
        <Link href="/laureates">Лауреаты</Link>
      </nav>
      <div className="siteFooterSocial">
        <strong>На связи</strong>
        <div><a href={vkUrl} target="_blank" rel="noopener noreferrer" aria-label="Сообщество ЛХЛ-76 ВКонтакте"><UiIcon name="vk" /></a></div>
      </div>
    </div>
    <div className="siteFooterBottom"><small>© {new Date().getFullYear()} ЛХЛ-76. Все права защищены.</small><span>Ярославль · Россия</span></div>
  </footer>;
}
