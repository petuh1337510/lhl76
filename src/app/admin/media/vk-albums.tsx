"use client";
import { useCallback, useEffect, useState } from "react";
import { AlbumImage } from "@/components/album-image";

type Album = { albumId: number; slug: string; title: string; coverUrl: string | null; count: number; isPublished: boolean; available: boolean | null };
export function VkAlbums() {
  const [items, setItems] = useState<Album[]>([]);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async (force = false) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/media/vk", force ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh" }) } : { cache: "no-store" });
      const data = await response.json();
      if (typeof data.configured === "boolean") setConfigured(data.configured);
      if (Array.isArray(data.items)) setItems(data.items);
      if (data.error) throw new Error(data.error);
      if (!response.ok) throw new Error("Не удалось загрузить альбомы.");
      setItems(data.items ?? []);
      if (force) setNotice("Список обновлён. Данные выбранных альбомов обновятся при следующем открытии.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось связаться с сервером."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const toggle = async (album: Album) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/media/vk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: album.slug, albumId: album.albumId, isPublished: !album.isPublished }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось сохранить выбор.");
      setItems(current => current.map(item => item.slug === album.slug ? { ...item, isPublished: !album.isPublished } : item));
      setNotice(album.isPublished ? "Альбом снят с публикации." : "Альбом опубликован.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось связаться с сервером."); }
    finally { setBusy(false); }
  };
  return <section aria-label="Альбомы группы ЛХЛ-76">
    <div className="mediaVkImport"><div><span>ФОТО ИЗ ВКОНТАКТЕ</span><h2>Альбомы ЛХЛ-76</h2><p>Выберите альбомы для раздела «Фото». Содержимое обновляется примерно раз в час. Фотографии загружаются из VK, копии на сайте не сохраняются.</p><a href="https://vk.ru/lhl76" target="_blank" rel="noreferrer">Открыть группу VK ↗</a></div><button disabled={busy} onClick={() => void load(true)}>{busy ? "Загрузка…" : "Обновить сейчас"}</button></div>
    {error ? <p className="documentError" role="alert">{error} <button disabled={busy} onClick={() => void load()}>Повторить</button></p> : null}
    {notice ? <p className="adminNotice" role="status">{notice}</p> : null}
    <div className="mediaAdminGrid" aria-busy={busy}>{items.map(album => <article key={album.slug}>
      {album.coverUrl ? <AlbumImage src={album.coverUrl} alt="" direct /> : <div>ЛХЛ-76</div>}
      <span>{album.count} фото · VK</span><h3>{album.title}</h3>
      <small>{album.available === null ? "Доступ к VK не проверен" : album.available ? album.isPublished ? "Опубликован" : "Не опубликован" : "Недоступен в VK — скрыт на сайте"}</small>
      <footer><label><input type="checkbox" checked={album.isPublished} disabled={busy || (!album.isPublished && (!configured || !album.available))} onChange={() => void toggle(album)} /> Показывать на сайте</label></footer>
    </article>)}</div>
    {!busy && !error && !items.length ? <p className="registryEmpty">В группе пока нет доступных альбомов.</p> : null}
  </section>;
}
