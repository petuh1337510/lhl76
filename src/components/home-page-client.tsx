"use client";

import { UiIcon } from "@/components/ui-icon";
import {safeHref} from '@/lib/editorial-url';
import { HomeLeaders } from "@/components/home-leaders";

import { PublicImage } from "@/components/public-image";


import Link from "next/link";
import { getImageProps } from "next/image";
import {localMediaUrl} from '@/lib/local-media';
import { nearestHomeMatchIndex, visibleHomeMatches } from "@/lib/home-match-carousel";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { PublicSiteContext } from "@/lib/public-site-context";
import {
  PublicSiteHeader,
  PublicSiteFooter,
} from "@/components/public-site-header";

const fallbackDivisions = ["Любитель Плюс", "Любитель", "Старт", "Дебют"];
const divisionOrder = (name: string) => {
  const value = name.toLocaleLowerCase("ru");
  if (value.includes("плюс") || value.includes("plus") || value.includes("+")) return 0;
  if (value.includes("любитель")) return 1;
  if (value.includes("старт")) return 2;
  if (value.includes("дебют")) return 3;
  return 4;
};
const teamSlug = (name: string) =>
  ({ Танки: "tanki", Волки: "volki", Молот: "molot", Стрела: "strela" })[
    name
  ] ?? "tanki";
function Mark({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  return (
    <span className={`mark ${logoUrl ? "hasLogo" : ""}`}>
      {logoUrl ? <PublicImage width={80} height={80} sizes="40px" src={logoUrl} alt="" /> : name.slice(0, 2).toUpperCase()}
    </span>
  );
}
function Title({
  text,
  href,
  link,
}: {
  text: string;
  href: string;
  link: string;
}) {
  return (
    <div className="sectionTitle">
      <h2>{text}</h2>
      <Link href={href}>{link}</Link>
    </div>
  );
}

type HomepageItem = { id:string; title:string; subtitle:string | null; link:string | null; type:string; imageDesktop:string | null; imageMobile:string | null; style:string | null };
type HeroVariant = "league"|"partner"|"match"|"broadcast"|"photo";
type HeroSlide = { id:string; title:string; subtitle:string; link:string; imageDesktop:string; imageMobile:string; variant:HeroVariant; eyebrow:string; buttonLabel:string; logoUrl?:string; duration:number; homeLogoUrl?:string | null; awayLogoUrl?:string | null; live?:boolean };

const heroSettings = (style: string | null) => {
  try { return JSON.parse(style || "{}"); } catch { return {}; }
};

function HomeHeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const current = slides[active] ?? slides[0];
  useEffect(() => { if (active >= slides.length) setActive(0); }, [active, slides.length]);
  useEffect(() => {
    if (paused || slides.length < 2 || !current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setActive((index) => (index + 1) % slides.length), current.duration);
    return () => window.clearTimeout(timer);
  }, [active, paused, slides.length, current]);
  if (!current) return null;
  const move = (step: number) => setActive((index) => (index + step + slides.length) % slides.length);
  const isPhotoOnly = current.variant === "photo";
  const desktop = getImageProps({ src: localMediaUrl(current.imageDesktop), alt: "", width: 1920, height: 820, sizes: "100vw", quality: 80, priority:active===0 }).props;
  const mobile = getImageProps({ src: localMediaUrl(current.imageMobile || current.imageDesktop), alt: "", width: 768, height: 1080, sizes: "100vw", quality: 80, priority:active===0 }).props;
  const style = {
    "--hero-desktop": `url(${current.imageDesktop})`,
    "--hero-mobile": `url(${current.imageMobile || current.imageDesktop})`,
    "--hero-duration": `${current.duration}ms`,
  } as CSSProperties;
  return <section
    className={`homeMediaHero heroVariant-${current.variant} ${current.live ? "isLive" : ""}`}
    style={style}
    onMouseEnter={() => setPaused(true)}
    onMouseLeave={() => setPaused(false)}
    onFocus={() => setPaused(true)}
    onBlur={() => setPaused(false)}
    onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
    onTouchEnd={(event) => { const start = touchStart.current; const end = event.changedTouches[0]?.clientX; if (start !== null && end !== undefined && Math.abs(end - start) > 45) move(end < start ? 1 : -1); touchStart.current = null; }}
    aria-roledescription="карусель"
    aria-label="Главные материалы ЛХЛ-76"
  >
    <picture className="homeHeroPicture" key={current.id}>
      <source media="(max-width: 600px)" srcSet={mobile.srcSet} sizes="100vw" />
      {/* The first slide is present in server HTML and discovered without JavaScript. */}
      <img {...desktop} alt="" loading="eager" fetchPriority={active === 0 ? "high" : "auto"} />
    </picture>
    {!isPhotoOnly ? <>
      <div className="homeMediaShade" />
      <div className="shell homeMediaContent" key={current.id}>
        <div className="homeMediaCopy">
          <span className="homeMediaEyebrow">{current.live ? <i /> : null}{current.eyebrow}</span>
          {current.logoUrl ? <PublicImage width={160} height={160} sizes="160px" className="homeMediaPartnerLogo" src={current.logoUrl} alt="" /> : null}
          <h1>{current.title}</h1>
          <p>{current.subtitle}</p>
          {current.link ? /^https?:\/\//.test(current.link)
            ? <a className="homeMediaButton" href={safeHref(current.link)} target="_blank" rel="noopener noreferrer">{current.buttonLabel}<b>→</b></a>
            : <Link className="homeMediaButton" href={safeHref(current.link)}>{current.buttonLabel}<b>→</b></Link>
            : null}
        </div>
        {current.homeLogoUrl || current.awayLogoUrl ? <div className="homeMediaTeams" aria-hidden="true">
          <span>{current.homeLogoUrl ? <PublicImage width={160} height={160} sizes="160px" src={current.homeLogoUrl} alt="" /> : "ЛХЛ"}</span><b>VS</b><span>{current.awayLogoUrl ? <PublicImage width={160} height={160} sizes="160px" src={current.awayLogoUrl} alt="" /> : "76"}</span>
        </div> : null}
      </div>
    </> : current.link && current.link !== "#" ? <Link className="homeMediaPhotoLink" href={safeHref(current.link)} aria-label={current.title || "Открыть материал"} /> : null}
    {slides.length > 1 ? <div className="homeMediaNavigation shell">
      <button onClick={() => move(-1)} aria-label="Предыдущий слайд"><UiIcon name="arrow-left" /></button>
      <div className="homeMediaDots">{slides.map((slide, index) => <button key={slide.id} onClick={() => setActive(index)} className={index === active ? "active" : ""} aria-label={`Слайд ${index + 1}: ${slide.title}`}><i /></button>)}</div>
      <span>{String(active + 1).padStart(2,"0")} / {String(slides.length).padStart(2,"0")}</span>
      <button onClick={() => move(1)} aria-label="Следующий слайд"><UiIcon name="arrow-right" /></button>
    </div> : null}
    {!paused && slides.length > 1 ? <div className="homeMediaProgress" key={`progress-${current.id}`} /> : null}
  </section>;
}

function PromoTiles({ items }: { items: HomepageItem[] }) {
  const [offset, setOffset] = useState(0);
  const fallbackTiles = [
    {
      className: "promoDosaaf",
      eyebrow: "ПАРТНЁР ЛИГИ",
      title: (
        <>
          ДОСААФ
          <br />
          РОССИИ
        </>
      ),
      copy: "Официальный партнёр ЛХЛ-76",
      href: "https://www.dosaaf.ru/",
    },
    {
      className: "promoVk",
      eyebrow: "СООБЩЕСТВО",
      title: (
        <>
          НАША
          <br />
          ГРУППА VK
        </>
      ),
      copy: "Новости, фото и общение болельщиков",
      href: "https://vk.ru/lhl76",
    },
    {
      className: "promoGallery",
      eyebrow: "МЕДИАГАЛЕРЕЯ",
      title: (
        <>
          ЭМОЦИИ
          <br />
          НА ЛЬДУ
        </>
      ),
      copy: "Фотографии матчей и турниров",
      href: "/media",
    },
  ];
  const tiles = items.length ? items.map((item) => ({
    className: item.style === "red" ? "promoDosaaf" : item.style === "photo" ? "promoGallery" : "promoVk",
    eyebrow: "ЛХЛ-76",
    title: item.title,
    copy: item.subtitle ?? "",
    href: item.link ?? "#",
    imageDesktop: item.imageDesktop,
  })) : fallbackTiles;
  const visible = tiles.length === 1 ? [tiles[0]] : [tiles[offset], tiles[(offset + 1) % tiles.length]];
  return (
    <section className="homePromo" aria-label="Партнёры и материалы лиги">
      <div className="shell homePromoInner">
        <div className="homePromoTrack">
          {visible.map((tile, tileIndex) => (
            <Link
              className={`homePromoTile ${tile.className}`}
              href={tile.href}
              key={`${String(tile.title)}-${tileIndex}`}
              style={("imageDesktop" in tile && tile.imageDesktop) ? { isolation: "isolate" } : undefined}
            >
              {"imageDesktop" in tile && tile.imageDesktop ? <PublicImage className="homePromoImage" src={tile.imageDesktop} alt="" width={800} height={400} sizes="(max-width: 800px) 90vw, 50vw" /> : null}
              <small>{tile.eyebrow}</small>
              <h3>{tile.title}</h3>
              <span>
                {tile.copy} <b>→</b>
              </span>
            </Link>
          ))}
        </div>
        <div className="homePromoControls">
          <button
            aria-label="Предыдущая плитка"
            onClick={() =>
              setOffset((offset + tiles.length - 1) % tiles.length)
            }
          >
            ‹
          </button>
          <span>
            {offset + 1} / {tiles.length}
          </span>
          <button
            aria-label="Следующая плитка"
            onClick={() => setOffset((offset + 1) % tiles.length)}
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}

export default function Home({ initialMatches, initialSummary, initialNow }: { initialMatches: any[]; initialSummary: any; initialNow: string }) {
  const [division, setDivision] = useState("Все");
  const [leadersDivision, setLeadersDivision] = useState("Любитель Плюс");
  const [standingsDivision, setStandingsDivision] = useState("Любитель Плюс");
  const [offset, setOffset] = useState(0);
  const [slideDirection, setSlideDirection] = useState<-1 | 0 | 1>(0);
  const [slideAnimating, setSlideAnimating] = useState(false);
  const [now, setNow] = useState(() => Date.parse(initialNow));
  const matchTouchStart = useRef<number | null>(null);
  const slideFrame = useRef<number | null>(null);
  const [contentState, setContentState] = useState<"loading" | "ready" | "error">(initialSummary ? "ready" : "error");
  const [databaseMatches, setDatabaseMatches] = useState<any[]>(initialMatches);
  const [homeSummary, setHomeSummary] = useState<{
    context: PublicSiteContext;
    divisions: Array<{ name: string; slug: string; href: string; teams: any[]; leaders: any[] }>;
    news: Array<{ id: string; slug: string; title: string; excerpt: string; category: string; imageUrl: string | null; publishedAt: string | null }>;
    broadcasts: Array<{ id: string; slug: string; title: string; description: string | null; videoUrl: string; imageUrl: string | null; startsAt: string | null; isLive: boolean }>;
    homepageContent: HomepageItem[];
    laureates: Array<{ id:string; category:string; title:string; name:string; teamName:string | null; season:string | null; imageUrl:string | null; link:string | null }>;
  } | null>(initialSummary);
  const hasLive = databaseMatches.some((match) => match.status === "LIVE");
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let pending = false;
    let controller: AbortController | undefined;
    let lastSummaryRefresh = Date.now();
    const refresh = async () => {
      if (document.visibilityState !== "visible" || pending) return;
      pending = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 15000);
      const refreshSummary = Date.now() - lastSummaryRefresh >= 300_000 || !initialSummary;
      try {
      const [items, summary] = await Promise.all([
      fetch("/api/public/home-matches", { cache: "no-store", signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error("Матчи временно недоступны");
        return response.json();
      }),
      fetch(refreshSummary ? "/api/public/home-summary" : "/api/public/home-summary?live=1", { cache: "no-store", signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error("Данные главной временно недоступны");
        return response.json();
      }),
    ]);
      if (active) {
        setDatabaseMatches(items);
        setNow(Date.now());
        if (summary) {
          setHomeSummary((current) => ({ ...current, ...summary }));
          if (refreshSummary) lastSummaryRefresh = Date.now();
        }
        setContentState("ready");
        setRefreshFailed(false);
        const firstDivision = summary?.divisions?.slice().sort((a:any,b:any)=>divisionOrder(a.name)-divisionOrder(b.name))[0]?.name;
        if (firstDivision) {
          setLeadersDivision((current) => summary.divisions.some((item: any) => item.name === current) ? current : firstDivision);
          setStandingsDivision((current) => summary.divisions.some((item: any) => item.name === current) ? current : firstDivision);
        }
      }
      } catch { if (active) { setRefreshFailed(true); setContentState("error"); } }
      finally { clearTimeout(timeout); pending = false; }
    };
    if (retry || !initialSummary) void refresh();
    const timer = setInterval(refresh, hasLive ? 10_000 : 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [hasLive, initialSummary, retry]);
  const sourceMatches = databaseMatches;
  const divisions = (homeSummary?.divisions.map((item) => item.name) ?? fallbackDivisions).sort((a, b) => divisionOrder(a) - divisionOrder(b));
  const context = homeSummary?.context;
  const homepageItems = homeSummary?.homepageContent ?? [];
  const heroContent = homepageItems.filter((item) => item.type === "banner");
  const selectedLeaders = homeSummary?.divisions.find((item) => item.name === leadersDivision)?.leaders ?? [];
  const selectedStanding = homeSummary?.divisions.find((item) => item.name === standingsDivision);
  const divisionHref = (name: string, tab?: "calendar" | "statistics") => {
    const href = homeSummary?.divisions.find((item) => item.name === name)?.href ?? context?.championshipHref ?? "/championship/current";
    return tab ? `${href}?tab=${tab}` : href;
  };
  const games = sourceMatches.filter(
    (match: any) => division === "Все" || match.division === division,
  );
  const shown = visibleHomeMatches(games, nearestHomeMatchIndex(games, now) + offset);
  const trackMatches = shown.length ? [
    ...visibleHomeMatches(games, nearestHomeMatchIndex(games, now) + offset - 1, 1),
    ...shown,
    ...visibleHomeMatches(games, nearestHomeMatchIndex(games, now) + offset + shown.length, 1),
  ] : [];
  const featureMatch = sourceMatches.find((match: any) => match.status === "LIVE" || match.status === "SCHEDULED") ?? sourceMatches[nearestHomeMatchIndex(sourceMatches, now)];
  const heroSlides: HeroSlide[] = heroContent.map((item) => {
    const settings = heroSettings(item.style);
    const allowedVariants = ["league","partner","match","broadcast","photo"];
    const variant = allowedVariants.includes(settings.variant) ? settings.variant as HeroVariant : "league";
    const compactSeason = /^\d{4}\/\d{2}$/.test(item.title);
    return {
      id:item.id,
      title:compactSeason ? `СЕЗОН ${item.title}` : item.title,
      subtitle:item.subtitle ?? "Больше, чем хоккей",
      link:item.link || (variant === "photo" || variant === "partner" ? "" : context?.calendarHref ?? "/championship/current?tab=calendar"),
      imageDesktop:item.imageDesktop ?? "/images/optimized/hero-hockey-258d60f1efb5.webp",
      imageMobile:item.imageMobile ?? item.imageDesktop ?? "/images/optimized/hero-hockey-258d60f1efb5.webp",
      variant,
      eyebrow:settings.eyebrow || (variant === "partner" ? "ПАРТНЁР ЛИГИ" : "ЛХЛ-76 · ЯРОСЛАВЛЬ"),
      buttonLabel:settings.buttonLabel || "ПОДРОБНЕЕ",
      logoUrl:settings.logoUrl || undefined,
      duration:Math.max(4000,Math.min(12000,Number(settings.duration) || 6500)),
    };
  });
  if (featureMatch && heroSlides.length < 3) heroSlides.push({
    id:`match-${featureMatch.slug}`,
    title:`${featureMatch.home} — ${featureMatch.away}`,
    subtitle:`${featureMatch.date} · ${featureMatch.time} · ${featureMatch.venue}`,
    link:`/match/${featureMatch.slug}`,
    imageDesktop:"/images/optimized/hero-hockey-258d60f1efb5.webp", imageMobile:"/images/optimized/hero-hockey-258d60f1efb5.webp", variant:"match",
    eyebrow:featureMatch.status === "LIVE" ? "МАТЧ ИДЁТ СЕЙЧАС" : "БЛИЖАЙШИЙ МАТЧ",
    buttonLabel:featureMatch.status === "LIVE" ? "ОТКРЫТЬ ОНЛАЙН" : "ОТКРЫТЬ МАТЧ",
    duration:7000, homeLogoUrl:featureMatch.homeLogoUrl, awayLogoUrl:featureMatch.awayLogoUrl, live:featureMatch.status === "LIVE",
  });
  const featureBroadcast = homeSummary?.broadcasts?.find((item) => item.isLive);
  if (featureBroadcast && heroSlides.length < 3) heroSlides.push({
    id:`broadcast-${featureBroadcast.id}`, title:featureBroadcast.title, subtitle:featureBroadcast.description ?? "Смотрите матчи ЛХЛ-76 в прямом эфире и в записи", link:"/broadcasts?filter=live", imageDesktop:featureBroadcast.imageUrl ?? "/images/optimized/hero-hockey-258d60f1efb5.webp", imageMobile:featureBroadcast.imageUrl ?? "/images/optimized/hero-hockey-258d60f1efb5.webp", variant:"broadcast", eyebrow:featureBroadcast.isLive ? "ПРЯМОЙ ЭФИР" : "ТРАНСЛЯЦИЯ ЛХЛ-76", buttonLabel:featureBroadcast.isLive ? "СМОТРЕТЬ ЭФИР" : "СМОТРЕТЬ ВИДЕО", duration:7500, live:featureBroadcast.isLive,
  });
  const move = (amount: number) => {
    if (games.length < 2 || slideDirection !== 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOffset((current) => (current + amount + games.length) % games.length);
      return;
    }
    setSlideDirection(amount > 0 ? 1 : -1);
    slideFrame.current = window.requestAnimationFrame(() => {
      slideFrame.current = window.requestAnimationFrame(() => setSlideAnimating(true));
    });
  };
  useEffect(() => () => { if (slideFrame.current !== null) window.cancelAnimationFrame(slideFrame.current); }, []);

  return (
    <>
      <PublicSiteHeader />
      <main className="homePage">
        {refreshFailed && <div className="publicRefreshNotice" role="status"><span>Не удалось обновить данные. Ранее загруженные материалы сохранены.</span><button onClick={() => { setRefreshFailed(false); setRetry(value => value + 1); }}>Повторить</button></div>}
        {contentState === "loading" && !heroSlides.length
          ? <section className="homeMediaHero homeMediaHeroLoading" aria-label="Загружаем главные материалы"><i /><i /><i /></section>
          : <HomeHeroCarousel slides={heroSlides} />}

        <section className="matchSection" id="matches">
          <div className="shell section">
            <Title
              text="МАТЧИ"
              href={context?.calendarHref ?? "/championship/current?tab=calendar"}
              link="ВСЕ МАТЧИ →"
            />
            <div className="divisionFilters">
              {["Все", ...divisions].map((item) => (
                <button
                  onClick={() => {
                    setDivision(item);
                    setOffset(0);
                    if (slideFrame.current !== null) window.cancelAnimationFrame(slideFrame.current);
                    setSlideDirection(0);
                    setSlideAnimating(false);
                  }}
                  className={division === item ? "active" : ""}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="matchCarousel">
              {games.length > 1 ? <button
                onClick={() => move(-1)}
                className="slideArrow left"
                aria-label="Предыдущие матчи"
              >
                ‹
              </button> : null}
              <div className="matchCarouselViewport">
              <div
                className={`matchGrid modern ${slideAnimating ? "isAnimating" : ""} ${shown.length ? "" : "isEmpty"}`}
                data-direction={slideAnimating ? slideDirection : 0}
                onTransitionEnd={(event) => {
                  if (event.target !== event.currentTarget || event.propertyName !== "transform" || slideDirection === 0) return;
                  setOffset((current) => (current + slideDirection + games.length) % games.length);
                  setSlideAnimating(false);
                  setSlideDirection(0);
                }}
                onTouchStart={(event) => { matchTouchStart.current = event.touches[0]?.clientX ?? null; }}
                onTouchEnd={(event) => {
                  const start = matchTouchStart.current;
                  const end = event.changedTouches[0]?.clientX;
                  if (start !== null && end !== undefined && Math.abs(end - start) > 45) move(end < start ? 1 : -1);
                  matchTouchStart.current = null;
                }}
                onTouchCancel={() => { matchTouchStart.current = null; }}
              >
                {trackMatches.map((match: any, index) => {
                  const live = match.status === "LIVE";
                  const final = match.status === "FINAL" || match.status === "ЗАВЕРШЕН";
                  const scheduled = !live && !final;
                  const awaitingResult = scheduled && match.startsAt && new Date(match.startsAt).getTime() < Date.now();
                  const href = `/match/${match.slug ?? (index === 0 ? "tanki-volki-2026-09-28" : `league-match-${index + 1}`)}`;
                  const [homeScore, awayScore] = String(match.score ?? "").split(":").map((value) => Number(value.trim()));
                  const homeWinner = final && (match.homeWinner === true || (Number.isFinite(homeScore) && Number.isFinite(awayScore) && homeScore > awayScore));
                  const awayWinner = final && (match.awayWinner === true || (Number.isFinite(homeScore) && Number.isFinite(awayScore) && awayScore > homeScore));
                  return (
                    <article
                      className={`match ${live ? "isLive" : final ? "isFinal" : "isScheduled"} ${match.isPlayoff ? "playoffMatch" : ""}`}
                      key={`${match.slug ?? match.home + match.away}-${index}`}
                    >
                      <header>
                        <div className="homeMatchMeta"><time>{match.date} · {match.time}</time><span className={live ? "liveBadge" : final ? "finalBadge" : "scheduledBadge"}>{live ? "● ЛАЙВ" : final ? "ЗАВЕРШЁН" : awaitingResult ? "БЕЗ РЕЗУЛЬТАТА" : "СКОРО"}</span></div>
                        <em>
                          {match.division}
                          {match.isPlayoff ? " · ПЛЕЙ-ОФФ" : ""}
                        </em>
                      </header>
                      <p className="venue">{match.venue}</p>
                      <div className="scorebox">
                        <div className={homeWinner ? "winner" : awayWinner ? "loser" : ""}>
                          <Link
                            href={`/team/${match.homeSlug ?? teamSlug(match.home)}`}
                          >
                            <Mark name={match.home} logoUrl={match.homeLogoUrl} />
                            <strong>{match.home}</strong>
                          </Link>
                        </div>
                        <Link
                          className="matchScore"
                          href={href}
                          aria-label={`Открыть матч ${match.home} — ${match.away}`}
                        >
                          {scheduled ? <span className="versus">VS</span> : match.score ?? "0 : 0"}
                        </Link>
                        <div className={awayWinner ? "winner" : homeWinner ? "loser" : ""}>
                          <Link
                            href={`/team/${match.awaySlug ?? teamSlug(match.away)}`}
                          >
                            <Mark name={match.away} logoUrl={match.awayLogoUrl} />
                            <strong>{match.away}</strong>
                          </Link>
                        </div>
                      </div>
                      <Link className="matchDetails" href={href}>
                        <span>{live ? "Открыть матч-центр" : final ? "Протокол матча" : awaitingResult ? "Карточка матча" : "Превью матча"}</span><b>→</b>
                      </Link>
                    </article>
                  );
                })}
                {!shown.length ? <div className="homeSectionEmpty">
                  <b>{contentState === "loading" ? "Загружаем матчи…" : contentState === "error" ? "Матчи временно недоступны" : "Матчей пока нет"}</b>
                  <span>{contentState === "error" ? "Проверьте подключение к базе данных." : "Расписание появится после публикации матчей."}</span>
                </div> : null}
              </div>
              </div>
              {games.length > 1 ? <button
                onClick={() => move(1)}
                className="slideArrow right"
                aria-label="Следующие матчи"
              >
                ›
              </button> : null}
            </div>
          </div>
        </section>

        <section className="shell section homeBand homeBandWhite">
          <Title
            text="ТУРНИРНЫЕ ТАБЛИЦЫ"
            href={context?.championshipHref ?? "/championship/current"}
            link="ВСЕ ТАБЛИЦЫ →"
          />
          <div className="tabs standingTabs" aria-label="Выбор дивизиона">
            {divisions.map((item) => <button onClick={() => setStandingsDivision(item)} className={standingsDivision === item ? "active" : ""} key={item}>{item}</button>)}
          </div>
          <div className="standingGrid">
            {selectedStanding ? (
              <article className="standing standingFeatured">
                <h3>{selectedStanding.name}</h3>
                <div className="tableHead">
                  <span>РАНГ</span>
                  <span>КОМАНДА</span>
                  <span>С</span>
                  <span>В</span>
                  <span>Н</span>
                  <span>П</span>
                  <span>Ш</span>
                  <span>О</span>
                  <span>ПОСЛЕДНИЕ ИГРЫ</span>
                </div>
                {selectedStanding.teams.map((team, rank) => (
                  <div className="row" key={team.id}>
                    <span>{team.rank ?? rank + 1}</span>
                    <Link href={`/team/${team.slug}`}>
                      <Mark name={team.name} logoUrl={team.logoUrl} />
                      {team.name}
                    </Link>
                    <span>{team.games}</span>
                    <span>{team.wins}</span>
                    <span>{team.draws}</span>
                    <span>{team.losses}</span>
                    <span>{team.goalsFor}–{team.goalsAgainst}</span>
                    <strong>{team.points}</strong>
                    <i>
                      {team.form.slice(-5).map((game: any, gameIndex: number) => (
                        <Link
                          href={`/match/${game.matchSlug}`}
                          className={game.result === "w" ? "win" : game.result === "l" ? "loss" : "draw"}
                          aria-label="Открыть последний матч"
                          key={`${game.matchSlug}-${gameIndex}`}
                        >
                          {game.result === "w" ? "В" : game.result === "l" ? "П" : "Н"}
                        </Link>
                      ))}
                    </i>
                  </div>
                ))}
                <Link href={divisionHref(selectedStanding.name)}>
                  ОТКРЫТЬ РАЗДЕЛ ДИВИЗИОНА →
                </Link>
              </article>
            ) : <div className="homeSectionEmpty light"><b>{contentState === "loading" ? "Загружаем таблицу…" : "Таблица временно недоступна"}</b><span>Данные появятся после подключения активного сезона.</span></div>}
          </div>
        </section>

        <section className="leaders homeBandGray">
          <div className="shell section">
            <Title
              text="ЛУЧШИЕ ИГРОКИ"
              href={divisionHref(leadersDivision, "statistics")}
              link="ВСЯ СТАТИСТИКА →"
            />
            <div className="tabs">
              {divisions.map((item) => (
                <button
                  onClick={() => setLeadersDivision(item)}
                  className={leadersDivision === item ? "active" : ""}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
            <p className="leadersContext">{leadersDivision} · сезон {context?.season.name ?? "—"}</p>
            <HomeLeaders players={selectedLeaders} teams={homeSummary?.divisions.find(item => item.name === leadersDivision)?.teams ?? []} href={divisionHref(leadersDivision, "statistics")} />
          </div>
        </section>

        <section className="shell section homeBand homeBandWhite" id="news">
          <Title text="НОВОСТИ ЛИГИ" href="/news" link="ВСЕ НОВОСТИ →" />
          <div className="newsGrid">
            {(homeSummary?.news ?? []).map((news, index) => (
              <Link
                className={`news ${index === 0 ? "featured" : ""}`}
                href={`/news/${news.slug}`}
                key={news.id}
              >
                <div className={`newsImage n${index}`}>
                  {news.imageUrl ? <PublicImage className="homeNewsImage" src={news.imageUrl} alt="" width={960} height={540} sizes={index === 0 ? "(max-width: 800px) 92vw, 50vw" : "(max-width: 600px) 92vw, 30vw"} /> : null}
                  <span>{news.category}</span>
                </div>
                <time>{news.publishedAt ? new Date(news.publishedAt).toLocaleDateString("ru-RU") : ""}</time>
                <h3>{news.title}</h3>
                <p>{news.excerpt}</p>
                <b>Читать новость →</b>
              </Link>
            ))}
            {homeSummary && homeSummary.news.length === 0 ? <p className="homeContentEmpty">Опубликованных новостей пока нет.</p> : null}
            {contentState === "error" ? <p className="homeContentEmpty">Новости временно недоступны.</p> : null}
          </div>
        </section>

        <PromoTiles items={homepageItems.filter((item) => item.type === "tile")} />

        {(homeSummary?.laureates ?? []).length ? <section className="homeLaureates">
          <div className="shell section">
            <div className="sectionTitle"><div><small>ГОРДОСТЬ ЛИГИ</small><h2>ЛАУРЕАТЫ</h2></div><Link href="/laureates">ВСЕ ЛАУРЕАТЫ →</Link></div>
            <div className="homeLaureateGrid">{homeSummary!.laureates.map((item) => {
              const content = <>
                <div>{item.imageUrl?<PublicImage width={960} height={540} sizes="(max-width: 600px) 92vw, (max-width: 1000px) 45vw, 640px" src={item.imageUrl} alt=""/>:<span>{item.name.slice(0,1)}</span>}<i>★</i></div>
                <small>{item.category}{item.season?` · ${item.season}`:""}</small><h3>{item.name}</h3><b>{item.title}</b>{item.teamName?<p>{item.teamName}</p>:null}
              </>;
              return item.link
                ? <Link className="homeLaureateCard" href={safeHref(item.link)} key={item.id}>{content}</Link>
                : <article className="homeLaureateCard" key={item.id}>{content}</article>;
            })}</div>
          </div>
        </section>:null}

        {(homeSummary?.broadcasts ?? []).length > 0 ? <section className="homeBroadcasts" id="broadcasts">
          <div className="shell section">
            <Title text="ТРАНСЛЯЦИИ" href="/broadcasts" link="ВСЕ ВИДЕО →" />
            <div className="homeBroadcastGrid">
                {homeSummary!.broadcasts.map((broadcast) => (
                  <a
                    className={`homeBroadcastCard ${broadcast.isLive ? "isLive" : ""}`}
                    href={broadcast.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    key={broadcast.id}
                  >
                    <div className="homeBroadcastVisual">
                      {broadcast.imageUrl ? <PublicImage width={960} height={540} sizes="(max-width: 600px) 92vw, (max-width: 1000px) 45vw, 640px" src={broadcast.imageUrl} alt="" /> : <span className="homeBroadcastFallback">ЛХЛ-76</span>}
                      <i aria-hidden="true">▶</i>
                      {broadcast.isLive ? <b>● ЛАЙВ</b> : null}
                    </div>
                    <time>{broadcast.startsAt ? new Date(broadcast.startsAt).toLocaleString("ru-RU", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }) : "ВИДЕО ЛИГИ"}</time>
                    <h3>{broadcast.title}</h3>
                  </a>
                ))}
            </div>
          </div>
        </section> : null}
      </main>
      <PublicSiteFooter />
    </>
  );
}
