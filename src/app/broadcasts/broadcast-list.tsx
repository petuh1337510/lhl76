"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PublicImage } from "@/components/public-image";
import { useBroadcastClock } from "@/components/broadcast-clock";
import { broadcastTiming, broadcastStatusLabel } from "@/lib/broadcast-status";
import type { PublicBroadcast } from "@/lib/public-broadcasts";

function embedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname === "youtu.be") return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    if (parsed.hostname.includes("rutube.ru")) {
      const match = parsed.pathname.match(/video\/(?:private\/)?([^/]+)/);
      return match ? `https://rutube.ru/play/embed/${match[1]}` : null;
    }
  } catch {}
  return null;
}

function BroadcastCard({ item }: { item: PublicBroadcast }) {
  const embed = embedUrl(item.videoUrl);
  return (
    <article className={item.isLive ? "live" : ""}>
      <div className="broadcastFrame">
        {embed ? (
          <iframe src={embed} title={item.title} loading="lazy" allowFullScreen />
        ) : item.imageUrl ? (
          <a href={item.videoUrl} target="_blank" rel="noreferrer" aria-label={`Смотреть ${item.title} в VK Видео (новая вкладка)`}>
            <PublicImage width={960} height={540} sizes="(max-width: 600px) 92vw, (max-width: 1000px) 45vw, 640px" src={item.imageUrl} alt="" direct referrerPolicy="no-referrer" />
            <i>▶</i>
          </a>
        ) : (
          <a href={item.videoUrl} target="_blank" rel="noreferrer" aria-label={`Смотреть ${item.title} в VK Видео (новая вкладка)`}><b>▶</b></a>
        )}
        <span data-status={item.status}>{broadcastStatusLabel[item.status]}</span>
      </div>
      <time>{(item.startsAt ?? item.publishedAt)?.toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" })}</time>
      <h2>{item.title}</h2>
      {item.description ? <p>{item.description}</p> : null}
      {!embed ? <a className="watchLink" href={item.videoUrl} target="_blank" rel="noreferrer">Смотреть видео →</a> : null}
    </article>
  );
}


export function BroadcastList({ initialItems, filter, channelUrl, serverTime }: { initialItems: PublicBroadcast[]; filter: string; channelUrl: string; serverTime: number }) {
  const router = useRouter();
  const now = useBroadcastClock(serverTime);
  const [shown, setShown] = useState(24);
  useEffect(() => { setShown(24); }, [filter]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) router.refresh(); };
    const timer = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [router]);
  const items = initialItems.map(item => now ? { ...item, ...broadcastTiming({ ...item,
    match: item.matchStatus ? { startsAt: item.startsAt, status: item.matchStatus } : null }, now) } : item)
    .filter(item => filter === "all" || item.status === filter);
  return <>
          <nav className="broadcastFilters" aria-label="Фильтр трансляций">
            <Link aria-current={filter === "all" ? "page" : undefined} className={filter === "all" ? "active" : ""} href="/broadcasts">ВСЕ ВИДЕО</Link>
            <Link aria-current={filter === "live" ? "page" : undefined} className={filter === "live" ? "active live" : ""} href="/broadcasts?filter=live">● ЛАЙВ</Link>
            <Link aria-current={filter === "archive" ? "page" : undefined} className={filter === "archive" ? "active" : ""} href="/broadcasts?filter=archive">ЗАПИСИ</Link>
            <Link aria-current={filter === "upcoming" ? "page" : undefined} className={filter === "upcoming" ? "active" : ""} href="/broadcasts?filter=upcoming">СКОРО</Link>
          </nav>
          <a className="broadcastChannelLink" href={channelUrl} target="_blank" rel="noopener noreferrer">Канал ЛХЛ-76 в VK Видео ↗</a>
          <div className="broadcastGrid">
            {items.length ? items.slice(0, shown).map((item) => <BroadcastCard item={item} key={item.id} />) : (
              <div className="publicNewsEmpty">
                <b>{filter === "live" ? "Сейчас нет прямых эфиров" : filter === "archive" ? "Записей пока нет" : filter === "upcoming" ? "Предстоящих трансляций пока нет" : "Трансляций пока нет"}</b>
                <p>{filter === "live" ? "Посмотрите записи прошедших матчей или загляните позже." : filter === "archive" ? "Записи матчей появятся здесь после публикации." : "Новые эфиры и записи матчей появятся здесь после публикации."}</p>
                {filter !== "all" ? <Link href="/broadcasts">Показать все видео</Link> : null}
              </div>
            )}
          </div>

    {items.length > shown ? <button className="broadcastLoadMore" onClick={() => setShown(value => value + 24)}>Показать ещё</button> : null}
  </>;
}
