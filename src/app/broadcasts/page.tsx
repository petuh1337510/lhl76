import { PublicImage } from "@/components/public-image";
import Link from "next/link";

import { PublicSiteFooter, PublicSiteHeader } from "@/components/public-site-header";
import { VK_CHANNEL_URL } from "@/lib/integrations/vk-video";
import { getPublicBroadcasts, type PublicBroadcast } from "@/lib/public-broadcasts";

export const dynamic = "force-dynamic";

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
            <PublicImage width={960} height={540} sizes="(max-width: 600px) 92vw, (max-width: 1000px) 45vw, 640px" src={item.imageUrl} alt="" />
            <i>▶</i>
          </a>
        ) : (
          <a href={item.videoUrl} target="_blank" rel="noreferrer" aria-label={`Смотреть ${item.title} в VK Видео (новая вкладка)`}><b>▶</b></a>
        )}
        {item.isLive ? <span>● ЛАЙВ</span> : null}
      </div>
      <time>{item.startsAt?.toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
      <h2>{item.title}</h2>
      {item.description ? <p>{item.description}</p> : null}
      {!embed ? <a className="watchLink" href={item.videoUrl} target="_blank" rel="noreferrer">Смотреть видео →</a> : null}
    </article>
  );
}

export default async function Broadcasts({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const query = await searchParams;
  const filter = query.filter === "live" || query.filter === "archive" ? query.filter : "all";
  const broadcasts = await getPublicBroadcasts();
  const items = broadcasts.filter((item) => filter === "all" || item.isLive === (filter === "live"));

  return (
    <>
      <PublicSiteHeader />
      <main className="publicBroadcasts">
        <section className="broadcastHero">
          <div className="shell">
            <span>ЛХЛ-76 · ВИДЕО</span>
            <h1>ТРАНСЛЯЦИИ</h1>
            <p>Прямые эфиры и записи матчей любительской хоккейной лиги.</p>
          </div>
        </section>
        <section className="shell broadcastContent">
          <nav className="broadcastFilters" aria-label="Фильтр трансляций">
            <Link aria-current={filter === "all" ? "page" : undefined} className={filter === "all" ? "active" : ""} href="/broadcasts">ВСЕ ВИДЕО</Link>
            <Link aria-current={filter === "live" ? "page" : undefined} className={filter === "live" ? "active live" : ""} href="/broadcasts?filter=live">● ЛАЙВ</Link>
            <Link aria-current={filter === "archive" ? "page" : undefined} className={filter === "archive" ? "active" : ""} href="/broadcasts?filter=archive">ЗАПИСИ</Link>
          </nav>
          <a className="broadcastChannelLink" href={VK_CHANNEL_URL} target="_blank" rel="noopener noreferrer">Канал ЛХЛ-76 в VK Видео ↗</a>
          <div className="broadcastGrid">
            {items.length ? items.map((item) => <BroadcastCard item={item} key={item.id} />) : (
              <div className="publicNewsEmpty">
                <b>{filter === "live" ? "Сейчас нет прямых эфиров" : filter === "archive" ? "Записей пока нет" : "Трансляций пока нет"}</b>
                <p>{filter === "live" ? "Посмотрите записи прошедших матчей или загляните позже." : filter === "archive" ? "Записи матчей появятся здесь после публикации." : "Новые эфиры и записи матчей появятся здесь после публикации."}</p>
                {filter !== "all" ? <Link href="/broadcasts">Показать все видео</Link> : null}
              </div>
            )}
          </div>
        </section>
      </main>
      <PublicSiteFooter />
    </>
  );
}
import {pageMetadata} from '@/lib/seo';
export const metadata=pageMetadata('Трансляции','Видеотрансляции и записи матчей ЛХЛ-76.','/broadcasts');
