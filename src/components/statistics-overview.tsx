"use client";
import Link from "next/link";
import { PublicImage } from "./public-image";
import { UiIcon } from "./ui-icon";
import { usePublicLocation } from "./use-public-url-state";
import { withReturn } from "@/lib/public-navigation";
import { statisticsCategories, categoryPlayers } from "@/lib/statistics-categories";
import type { DivisionPlayerStatistic } from "@/lib/division-page";
import styles from "./statistics-overview.module.css";

export function StatisticsOverview({ players }: { players: DivisionPlayerStatistic[] }) {
  const location = usePublicLocation();
  return <div className={styles.grid}>{statisticsCategories.map(category => {
    const [path, query] = location.split("?");
    const params = new URLSearchParams(query);
    params.set("tab", "statistics"); params.set("category", category.id); params.set("stats", "list");
    params.set("view", category.group === "goalkeepers" ? "goalkeepers" : "skaters");
    params.set("sort", category.metric); params.delete("statPage");
    const rows = categoryPlayers(players, category).slice(0, 5);
    return <section key={category.id} className={styles.card}>
      <h3><Link href={`${path}?${params}`} >{category.title}<UiIcon name="arrow-right" /></Link></h3>
      {rows.length ? <ol>{rows.map((player, index) => {
        const value = player[category.metric];
        return <li key={player.key} className={index === 0 ? styles.first : undefined}>
          <span className={styles.rank}>{index + 1}</span>
          <Link className={styles.player} href={withReturn(`/player/${player.slug}`, location)}>
            <PublicImage src={player.photoUrl || "/images/player-placeholder.svg"} width={160} height={212} sizes={index === 0 ? "76px" : "40px"} alt="" />
            <span><strong>{player.name}</strong><small>{player.teamName}</small></span>
          </Link>
          <span className={styles.value}><b>{value === null ? "—" : category.metric === "goalsAgainstAverage" ? value.toFixed(2) : category.metric === "savePercentage" ? value.toFixed(1) : value}</b>{index === 0 && <small>{category.unit}</small>}</span>
        </li>;
      })}</ol> : <p className={styles.empty}>{category.metric === "shutouts" ? "Пока нет подтверждённых сухих матчей." : "Статистика пока не заполнена."}</p>}
    </section>;
  })}</div>;
}
