"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PublicImage } from "@/components/public-image";
import type { UploadType } from "@/lib/upload-files";
import styles from "./media-files.module.css";

type MediaFile = {
  key: string;
  kind: string;
  type: UploadType;
  title: string;
  size: number;
  totalBytes: number;
  date: string;
  datePrecision: "day" | "month";
  url: string;
  previewUrl: string | null;
  usedBy: { label: string; href: string }[];
  deletable: boolean;
  origin: "upload" | "archive";
};

const typeLabels: Record<UploadType, string> = { image: "Фото", document: "Документ", video: "Видео" };
const kindLabels: Record<string, string> = { teams: "Команды", players: "Игроки", news: "Новости", documents: "Документы", media: "Медиагалерея", general: "Прочее" };

function localDate(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

export default function MediaFilesPage() {
  const [items, setItems] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [kind, setKind] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minSize, setMinSize] = useState("");
  const [maxSize, setMaxSize] = useState("");
  const [order, setOrder] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(24);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/media-files", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Не удалось загрузить медиафайлы");
    setItems(data.items ?? []);
  }, []);

  useEffect(() => {
    refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Не удалось загрузить медиафайлы"))
      .finally(() => setLoading(false));
  }, [refresh]);

  const filtered = useMemo(() => {
    const query = name.trim().toLocaleLowerCase("ru");
    const minimum = minSize === "" ? null : Number(minSize) * 1024 * 1024;
    const maximum = maxSize === "" ? null : Number(maxSize) * 1024 * 1024;
    return items.filter((item) => {
      const day = localDate(item.date);
      const startsBeforeEnd = !dateTo || (item.datePrecision === "month" ? day.slice(0, 7) <= dateTo.slice(0, 7) : day <= dateTo);
      const endsAfterStart = !dateFrom || (item.datePrecision === "month" ? day.slice(0, 7) >= dateFrom.slice(0, 7) : day >= dateFrom);
      return (!type || item.type === type)
        && (!kind || item.kind === kind)
        && (!query || [item.title, item.url, ...item.usedBy.map((use) => use.label)].some((value) => value.toLocaleLowerCase("ru").includes(query)))
        && startsBeforeEnd
        && endsAfterStart
        && (minimum === null || item.size >= minimum)
        && (maximum === null || item.size <= maximum);
    }).sort((left, right) => {
      if (order === "oldest") return left.date.localeCompare(right.date) || left.key.localeCompare(right.key);
      if (order === "name") return left.title.localeCompare(right.title, "ru") || left.key.localeCompare(right.key);
      if (order === "size-desc") return right.size - left.size || right.date.localeCompare(left.date);
      if (order === "size-asc") return left.size - right.size || right.date.localeCompare(left.date);
      return right.date.localeCompare(left.date) || left.key.localeCompare(right.key);
    });
  }, [items, name, type, kind, dateFrom, dateTo, minSize, maxSize, order]);

  useEffect(() => { setVisibleCount(24); }, [name, type, kind, dateFrom, dateTo, minSize, maxSize, order]);

  async function remove(item: MediaFile) {
    if (!window.confirm(`Удалить «${item.title}»? Оригинал и созданные версии файла будут удалены.`)) return;
    setDeleting(item.key);
    setError("");
    try {
      const response = await fetch(`/api/admin/media-files?key=${encodeURIComponent(item.key)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось удалить файл");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить файл");
      await refresh().catch(() => undefined);
    } finally {
      setDeleting("");
    }
  }

  return <section className="adminContent divisionPage">
    <a className="backButton" href="/admin">← К панели управления</a>
    <div className="competitionHead"><div><span>КОНТЕНТ</span><h2>Медиафайлы</h2><p>Загруженные файлы и архивные фотографии игроков и команд. Используемые файлы защищены от удаления; архивные изображения доступны для просмотра.</p></div></div>

    <div className={styles.filters} aria-label="Фильтры медиафайлов">
      <label className={styles.name}>Название или файл<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Поиск по названию" type="search" /></label>
      <label>Тип<select value={type} onChange={(event) => setType(event.target.value)}><option value="">Все файлы</option><option value="image">Фото</option><option value="document">Документы</option><option value="video">Видео</option></select></label>
      <label>Раздел<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="">Все разделы</option>{Object.entries(kindLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>Дата от<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
      <label>Дата до<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
      <label>Размер от, МБ<input type="number" min="0" step="0.1" value={minSize} onChange={(event) => setMinSize(event.target.value)} placeholder="0" /></label>
      <label>Размер до, МБ<input type="number" min="0" step="0.1" value={maxSize} onChange={(event) => setMaxSize(event.target.value)} placeholder="Любой" /></label>
      <label>Порядок<select value={order} onChange={(event) => setOrder(event.target.value)}><option value="newest">Новые сначала</option><option value="oldest">Старые сначала</option><option value="name">По названию</option><option value="size-desc">Сначала большие</option><option value="size-asc">Сначала маленькие</option></select></label>
      <button type="button" onClick={() => { setName(""); setType(""); setKind(""); setDateFrom(""); setDateTo(""); setMinSize(""); setMaxSize(""); setOrder("newest"); }}>Сбросить</button>
    </div>

    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.summary}>{loading ? "Загрузка…" : `Найдено ${filtered.length} из ${items.length} · показано ${Math.min(visibleCount, filtered.length)}`}</div>
    <div className={styles.list}>
      {!loading && !filtered.length && <p className={styles.empty}>По выбранным фильтрам файлов нет.</p>}
      {filtered.slice(0, visibleCount).map((item) => <article className={styles.item} key={item.key}>
        <div className={styles.preview}>{item.previewUrl ? <PublicImage src={item.previewUrl} alt="" width={80} height={80} sizes="80px" unoptimized={item.origin === "upload"} /> : <span aria-hidden="true">{item.type === "document" ? "▤" : "▶"}</span>}</div>
        <div className={styles.details}>
          <strong>{item.title}</strong>
          <small>{typeLabels[item.type]} · {kindLabels[item.kind] ?? item.kind} · {item.origin === "archive" ? "Архив · " : ""}{new Date(item.date).toLocaleDateString("ru-RU", item.datePrecision === "month" ? { month: "long", year: "numeric" } : undefined)} · {formatSize(item.size)}</small>
          <small className={styles.path}>{item.url}</small>
          {item.usedBy.length ? <div className={styles.uses}>Используется: {item.usedBy.map((use, index) => <span key={`${use.href}-${use.label}`}>{index > 0 ? ", " : ""}<a href={use.href}>{use.label}</a></span>)}</div> : <div className={styles.unused}>Не используется в материалах сайта</div>}
        </div>
        <div className={styles.actions}><a href={item.url} target="_blank" rel="noopener noreferrer">Открыть</a><button type="button" disabled={!item.deletable || Boolean(item.usedBy.length) || Boolean(deleting)} onClick={() => void remove(item)} title={item.origin === "archive" ? "Архивные изображения нельзя удалить из этой вкладки" : item.usedBy.length ? "Сначала уберите файл из материалов сайта" : "Удалить файл и его версии"}>{deleting === item.key ? "Удаление…" : "Удалить"}</button></div>
      </article>)}
    </div>
    {visibleCount < filtered.length && <button className={styles.more} type="button" onClick={() => setVisibleCount((count) => count + 24)}>Показать ещё</button>}
  </section>;
}
