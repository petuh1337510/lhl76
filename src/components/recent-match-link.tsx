"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { DivisionTeam } from "@/lib/division-page";
import styles from "./recent-match-link.module.css";

type RecentMatch = DivisionTeam["form"][number];
const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" });
const timeFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

export function RecentMatchLink({ match, teamName, href, className }: {
  match: RecentMatch; teamName: string; href: string; className: string;
}) {
  const id = useId();
  const anchor = useRef<HTMLAnchorElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 340 });
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  const show = () => { cancelClose(); setOpen(true); };
  const hideSoon = () => { cancelClose(); closeTimer.current = setTimeout(() => setOpen(false), 120); };

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  useLayoutEffect(() => {
    if (!open || !anchor.current || !tooltip.current) return;
    const place = () => {
      if (!anchor.current || !tooltip.current) return;
      const trigger = anchor.current.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      const popupWidth = Math.min(340, width - 24);
      tooltip.current.style.width = `${popupWidth}px`;
      const popup = tooltip.current.getBoundingClientRect();
      const left = Math.max(12, Math.min(trigger.left + trigger.width / 2 - popup.width / 2, width - popup.width - 12));
      const top = trigger.top >= popup.height + 22 ? trigger.top - popup.height - 10 : Math.min(trigger.bottom + 10, height - popup.height - 12);
      setPosition({ left, top: Math.max(12, top), width: popupWidth });
    };
    place();
    const close = () => setOpen(false);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);

  const result = match.result === "w" ? "Победа" : match.result === "l" ? "Поражение" : "Ничья";
  const date = match.startsAt ? new Date(match.startsAt) : null;
  return <>
    <Link ref={anchor} prefetch={false} href={href} className={className}
      aria-label={match.matchTitle} aria-describedby={open ? id : undefined}
      onMouseEnter={show} onMouseLeave={hideSoon} onFocus={show} onBlur={() => setOpen(false)} onClick={() => setOpen(false)}>
      {match.result === "w" ? "В" : match.result === "l" ? "П" : "Н"}
    </Link>
    {open && createPortal(<div ref={tooltip} id={id} role="tooltip" className={styles.tooltip}
      style={position} onMouseEnter={cancelClose} onMouseLeave={hideSoon}>
      <div className={styles.date}>{date ? `${dateFormat.format(date)} · ${timeFormat.format(date)} мск` : "Дата матча не указана"}</div>
      <div className={styles.match}>
        <div className={styles.team}><small>Хозяева</small><strong>{match.homeName}</strong></div>
        <b className={styles.score}>{match.homeScore}<span>:</span>{match.awayScore}</b>
        <div className={styles.team}><small>Гости</small><strong>{match.awayName}</strong></div>
      </div>
      <div className={styles.outcome} data-result={match.result}><span />{result} · {teamName}</div>
      {match.technical && <p className={styles.technical}>Технический результат</p>}
      <div className={styles.footer}>Нажмите на кружок, чтобы открыть матч <span aria-hidden="true">→</span></div>
    </div>, document.body)}
  </>;
}
