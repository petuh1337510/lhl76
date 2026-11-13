"use client";
import { useState } from "react";
import { newsVideoSource } from "@/lib/news-video";
import { safeEditorialUrl } from "@/lib/editorial-url";
import { PublicImage } from "./public-image";
import styles from "./news-video.module.css";

export function NewsVideo({ source, title, poster }: { source: string; title: string; poster?: string | null }) {
  const video = newsVideoSource(source);
  const [embed, setEmbed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const play = async () => {
    if (!video || loading) return;
    if (video.kind === "embed") { setEmbed(video.url); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/public/news-video?url=${encodeURIComponent(source)}`, { signal: AbortSignal.timeout(8000) });
      const result = await response.json();
      if (!response.ok || !result.embedUrl) throw new Error("Плеер сейчас недоступен. Откройте ролик в VK.");
      setEmbed(result.embedUrl);
    } catch { setError("Плеер сейчас недоступен. Откройте ролик в VK."); }
    finally { setLoading(false); }
  };
  return <div className={`${styles.player} ${video?.clip ? styles.vertical : ""}`}>
    {video ? <div className={styles.frame}>
      {video.kind === "file" ? <video src={video.url} controls preload="metadata" /> : embed ? <iframe src={embed} title={title} allow="fullscreen; encrypted-media; picture-in-picture" allowFullScreen /> : <>
        {poster ? <PublicImage direct className={styles.poster} src={poster} alt="" width={420} height={746} /> : null}
        <button type="button" className={styles.play} disabled={loading} onClick={play}>{loading ? "Загрузка плеера…" : "▶ Смотреть видео"}</button>
      </>}
    </div> : <p>Встроенный просмотр этой ссылки недоступен.</p>}
    {error ? <p role="status" className={styles.message}>{error}</p> : null}
    {safeEditorialUrl(source) && video?.kind !== "file" ? <a className={styles.external} href={source} target="_blank" rel="noopener noreferrer">{video?.kind === "vk" ? "Смотреть в VK ↗" : "Открыть видео ↗"}</a> : null}
  </div>;
}
