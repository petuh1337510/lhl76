"use client";

import { useEffect, useId, useRef, useState } from "react";

import { PublicImage } from "@/components/public-image";
import { SEARCH_DEBOUNCE_MS } from "@/lib/player-search";
import styles from "./media-upload.module.css";

type LibraryImage = {
  key: string;
  title: string;
  url: string;
  previewUrl: string | null;
  date: string;
  datePrecision: "day" | "month";
  size: number;
};

type LibraryPage = { items: LibraryImage[]; total: number; pageSize: number; hasMore: boolean };

function MediaLibrary({ id, label, onClose, onSelect }: { id: string; label: string; onClose: () => void; onSelect: (url: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState("newest");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<LibraryPage | null>(null);
  const [selected, setSelected] = useState<LibraryImage | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const panel = dialog.current;
    if (!panel) return;
    panel.showModal();
    search.current?.focus();
    return () => panel.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ type: "image", name: query, order, page: String(page) });
      try {
        const response = await fetch(`/api/admin/media-files?${params}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Не удалось загрузить медиафайлы");
        const data = await response.json();
        if (!controller.signal.aborted) setResult(data);
      } catch {
        if (!controller.signal.aborted) setError("Не удалось загрузить медиафайлы.");
      }
    }, query ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, order, page, retry]);

  function resetResults(nextPage: number) {
    setPage(nextPage);
    setSelected(null);
    setResult(null);
    setError("");
  }

  function close() {
    dialog.current?.close();
    onClose();
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : null;
  const dateLabel = selected && new Date(selected.date).toLocaleDateString("ru-RU", {
    timeZone: "Europe/Moscow",
    ...(selected.datePrecision === "month" ? { month: "long", year: "numeric" } : { dateStyle: "medium" }),
  });
  const sizeLabel = selected && (selected.size < 1024 * 1024
    ? `${Math.max(1, Math.round(selected.size / 1024))} КБ`
    : `${(selected.size / (1024 * 1024)).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`);

  return (
    <dialog ref={dialog} id={id} className={styles.library} aria-labelledby={`${id}-title`}
      onCancel={event => { event.preventDefault(); close(); }}
      onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className={styles.libraryPanel}>
        <div className={styles.libraryHead}>
          <div><h2 id={`${id}-title`}>Медиафайлы</h2><p>{label}</p></div>
          <button className={styles.close} type="button" aria-label="Закрыть медиафайлы" onClick={close}>×</button>
        </div>
        <div className={styles.filters}>
          <label>Поиск
            <input ref={search} type="search" placeholder="Название или имя файла" value={query}
              onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }}
              onChange={event => { setQuery(event.target.value); resetResults(1); }} />
          </label>
          <label>Сортировка
            <select value={order} onChange={event => { setOrder(event.target.value); resetResults(1); }}>
              <option value="newest">По дате: новые сначала</option>
              <option value="oldest">По дате: старые сначала</option>
              <option value="name">По названию: А–Я</option>
              <option value="size-desc">По размеру: от больших</option>
              <option value="size-asc">По размеру: от маленьких</option>
            </select>
          </label>
        </div>
        <div className={styles.browser}>
          <div className={styles.results} aria-busy={!result && !error}>
            {error ? <div className={styles.feedback}><p role="alert">{error}</p><button type="button" onClick={() => { resetResults(page); setRetry(value => value + 1); }}>Повторить</button></div>
              : !result ? <p className={styles.feedback} role="status">Загрузка изображений…</p>
              : !result.items.length ? <p className={styles.feedback} role="status">Изображения не найдены.</p>
              : <div className={styles.grid}>
                {result.items.map(item => (
                  <button className={styles.thumbnail} key={item.key} type="button" title={item.title}
                    aria-pressed={selected?.key === item.key} onClick={() => setSelected(item)}>
                    <span className={styles.thumbFrame}>
                      <PublicImage src={item.previewUrl || item.url} width={160} height={120} sizes="(max-width: 520px) 42vw, 160px" alt=""
                        unoptimized={Boolean(item.previewUrl && item.previewUrl !== item.url)} />
                    </span>
                    <span className={styles.thumbTitle}>{item.title}</span>
                  </button>
                ))}
              </div>}
          </div>
          <div className={styles.inspector} data-selected={Boolean(selected)}>
            {selected ? <>
              <div className={styles.largePreview}>
                <PublicImage key={selected.key} src={selected.url} width={640} height={480} sizes="(max-width: 680px) 45vw, 320px" alt={selected.title} loading="eager" />
              </div>
              <div className={styles.details} aria-live="polite">
                <strong>{selected.title}</strong>
                <span>{dateLabel} · {sizeLabel}</span>
              </div>
            </> : <p>Нажмите на миниатюру, чтобы рассмотреть изображение.</p>}
          </div>
        </div>
        <div className={styles.libraryFoot}>
          <nav className={styles.pagination} aria-label="Страницы изображений">
            <button type="button" aria-label="Предыдущая страница" disabled={page <= 1 || (!result && !error)} onClick={() => resetResults(page - 1)}>‹</button>
            <span>Стр. {page}{totalPages !== null ? ` из ${totalPages}` : ""}</span>
            <button type="button" aria-label="Следующая страница" disabled={!result?.hasMore} onClick={() => resetResults(page + 1)}>›</button>
          </nav>
          <button className={styles.confirm} type="button" disabled={!selected}
            onClick={() => { if (selected) { onSelect(selected.url); close(); } }}>Выбрать изображение</button>
        </div>
      </div>
    </dialog>
  );
}

type MediaUploadProps = {
  label: string;
  value?: string;
  kind: "teams" | "players" | "media";
  hint?: string;
  widePreview?: boolean;
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
};

export function usePendingMediaUploads() {
  const [count, setCount] = useState(0);
  return {
    uploadsPending: count > 0,
    trackUpload: (uploading: boolean) => setCount(current => current + (uploading ? 1 : -1)),
  };
}

export default function MediaUpload({ label, value, kind, hint, widePreview, onChange, onUploadingChange }: MediaUploadProps) {
  const libraryId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadRequest = useRef<AbortController | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => uploadRequest.current?.abort(), []);

  async function upload(file?: File) {
    if (!file || uploadRequest.current) return;
    const controller = new AbortController();
    uploadRequest.current = controller;
    setLoading(true);
    setLibraryOpen(false);
    setError("");
    onUploadingChange?.(true);
    const body = new FormData();
    body.append("file", file);
    body.append("kind", kind);
    try {
      const response = await fetch("/api/admin/upload", { method: "POST", body, signal: controller.signal });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (response.ok) onChange(result.url);
      else setError(result.error || "Не удалось загрузить файл.");
    } catch {
      if (!controller.signal.aborted) setError("Не удалось загрузить файл. Попробуйте ещё раз.");
    } finally {
      uploadRequest.current = null;
      if (!controller.signal.aborted) setLoading(false);
      onUploadingChange?.(false);
    }
  }

  function select(url: string) {
    onChange(url);
    setError("");
  }

  return (
    <div className={`mediaUpload ${styles.field}`} role="group" aria-label={label} aria-busy={loading}>
      <span>{label}</span>
      {value && <a className={widePreview ? styles.widePreview : styles.preview} href={value} target="_blank" rel="noopener noreferrer" aria-label={`Открыть: ${label}`}>
        <PublicImage src={value} sizes={widePreview ? "(max-width: 700px) 90vw, 420px" : "56px"} alt="" />
      </a>}
      <div className={styles.actions}>
        <input ref={fileInput} hidden type="file" aria-label={label} disabled={loading} accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={event => { void upload(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
        <button type="button" disabled={loading} onClick={() => fileInput.current?.click()}>С устройства</button>
        <button type="button" disabled={loading} aria-haspopup="dialog" aria-controls={libraryOpen ? libraryId : undefined}
          onClick={() => setLibraryOpen(true)}>Из медиафайлов</button>
      </div>
      {libraryOpen && <MediaLibrary id={libraryId} label={label} onClose={() => setLibraryOpen(false)} onSelect={select} />}
      <small role={error ? "alert" : "status"}>{loading ? "Загрузка…" : error || "JPG, PNG, WEBP или GIF · до 12 МБ"}</small>
      {hint && <small>{hint}</small>}
    </div>
  );
}
