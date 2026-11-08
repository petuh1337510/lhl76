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
};

function MediaLibrary({ id, onSelect }: { id: string; onSelect: (url: string) => void }) {
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ items: LibraryImage[]; hasMore: boolean } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => { search.current?.focus(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError("");
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ type: "image", name: query, page: String(page) });
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
  }, [query, page, retry]);

  return (
    <section id={id} className={styles.library} aria-label="Выбор изображения из медиафайлов">
      <input ref={search} type="search" aria-label="Поиск изображения" placeholder="Название или имя файла" value={query}
        onChange={event => { setQuery(event.target.value); setPage(1); }} />
      {error ? <div className={styles.feedback}><p role="alert">{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Повторить</button></div>
        : !result ? <p role="status">Загрузка изображений…</p>
        : result.items.length === 0 ? <p role="status">Изображения не найдены.</p>
        : <div className={styles.grid}>
          {result.items.map(item => <button className={styles.thumbnail} key={item.key} type="button" title={item.title} onClick={() => onSelect(item.url)}>
            <PublicImage src={item.previewUrl || item.url} width={144} height={96} sizes="144px" alt="" unoptimized />
            <span>{item.title}</span>
          </button>)}
        </div>}
      {(page > 1 || result?.hasMore) && <div className={styles.pagination}>
        <button type="button" disabled={page <= 1 || !result} onClick={() => setPage(page - 1)}>Назад</button>
        <span>Стр. {page}</span>
        <button type="button" disabled={!result?.hasMore} onClick={() => setPage(page + 1)}>Дальше</button>
      </div>}
    </section>
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
  const libraryButton = useRef<HTMLButtonElement>(null);
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
    setLibraryOpen(false);
    libraryButton.current?.focus();
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
        <button ref={libraryButton} type="button" disabled={loading} aria-expanded={libraryOpen} aria-controls={libraryOpen ? libraryId : undefined}
          onClick={() => setLibraryOpen(!libraryOpen)}>Из медиафайлов</button>
      </div>
      {libraryOpen && <MediaLibrary id={libraryId} onSelect={select} />}
      <small role={error ? "alert" : "status"}>{loading ? "Загрузка…" : error || "JPG, PNG, WEBP или GIF · до 12 МБ"}</small>
      {hint && <small>{hint}</small>}
    </div>
  );
}
