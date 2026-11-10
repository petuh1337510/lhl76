"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlbumImage } from "@/components/album-image";
import styles from "./album-viewer.module.css";

export function AlbumViewer({ photos, title, direct, error }: { photos: string[]; title: string; direct: boolean; error: boolean }) {
  const [index, setIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<number | null>(null);
  const router = useRouter();
  useEffect(() => { setIndex(null); }, [photos]);
  const opened = index !== null;
  useEffect(() => {
    if (!opened) return;
    const node = dialog.current;
    node?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { node?.close(); document.body.style.overflow = overflow; };
  }, [opened]);
  const move = (step: number) => setIndex(current => current === null ? null : (current + step + photos.length) % photos.length);
  return <>
    {error ? <div className={styles.notice} role="status">Не удалось обновить альбом из VK. <button onClick={() => router.refresh()}>Повторить</button></div> : null}
    {!photos.length ? <p className={styles.notice}>В альбоме пока нет доступных фотографий.</p> : null}
    <section className={`shell ${styles.grid}`} aria-label="Фотографии альбома">{photos.map((photo, position) => <div key={`${photo}-${position}`} className={styles.tile}>
      <AlbumImage src={photo} alt={`${title}: фото ${position + 1}`} direct={direct} />
      <button className={styles.open} onClick={() => setIndex(position)} aria-label={`Открыть фото ${position + 1}`}>Открыть</button>
    </div>)}</section>
    <dialog ref={dialog} className={styles.dialog} aria-label={title} onCancel={() => setIndex(null)} onClick={event => { if (event.target === event.currentTarget) setIndex(null); }} onKeyDown={event => {
      if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
    }}>
      {index !== null ? <div className={styles.viewer} onTouchStart={event => { touchStart.current = event.changedTouches[0].clientX; }} onTouchEnd={event => {
        if (touchStart.current !== null) { const delta = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(delta) > 60) move(delta < 0 ? 1 : -1); }
        touchStart.current = null;
      }}>
        <header><span aria-live="polite">{index + 1} / {photos.length}</span><button autoFocus onClick={() => setIndex(null)} aria-label="Закрыть просмотр">Закрыть ×</button></header>
        <div className={styles.frame}><AlbumImage key={photos[index]} src={photos[index]} alt={`${title}: фото ${index + 1}`} direct={direct} eager /></div>
        <footer><button disabled={photos.length < 2} onClick={() => move(-1)} aria-label="Предыдущее фото">← Назад</button><button disabled={photos.length < 2} onClick={() => move(1)} aria-label="Следующее фото">Вперёд →</button></footer>
      </div> : null}
    </dialog>
  </>;
}
