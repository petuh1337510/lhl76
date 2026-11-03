"use client";
import { AdminModal } from "../admin-modal";
import { PublicImage } from "@/components/public-image";

import { ChangeEvent, useEffect, useState } from "react";

type Album = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  photos: unknown;
  eventDate: string | null;
  isPublished: boolean;
};

const blank = { id: "", title: "", description: "", eventDate: "", photos: [] as string[], coverUrl: "", isPublished: true };
const list = (value: unknown): string[] => Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
const vkUrl = (slug: string) => {
  const match = slug.match(/^vk-photo-(\d+)-(\d+)$/);
  return match ? `https://vk.com/album-${match[1]}_${match[2]}` : null;
};

export default function MediaAdmin() {
  const [items, setItems] = useState<Album[]>([]);
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [albumUrl, setAlbumUrl] = useState("");
  const [vkConfigured, setVkConfigured] = useState<boolean | null>(null);

  const refresh = () => fetch("/api/admin/media", { cache: "no-store" })
    .then((response) => response.json())
    .then((data) => setItems(data.items ?? []));
  useEffect(() => {
    void refresh();
    void fetch("/api/admin/media/vk", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setVkConfigured(Boolean(data.configured)))
      .catch(() => setVkConfigured(false));
  }, []);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    setError("");
    const urls: string[] = [];
    for (const file of files) {
      const body = new FormData();
      body.set("file", file);
      body.set("kind", "media");
      const response = await fetch("/api/admin/upload", { method: "POST", body });
      const data = await response.json();
      if (response.ok) urls.push(data.url);
      else setError(data.error ?? "Ошибка загрузки");
    }
    setForm((value) => ({ ...value, photos: [...value.photos, ...urls], coverUrl: value.coverUrl || urls[0] || "" }));
    setBusy(false);
  };

  const save = async () => {
    setBusy(true);
    setError("");
    const response = await fetch("/api/admin/media", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Не удалось сохранить альбом");
    else { await refresh(); setOpen(false); setForm(blank); }
    setBusy(false);
  };

  const importVk = async (url: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/media/vk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось загрузить альбом VK");
      await refresh();
      setAlbumUrl("");
      setNotice(`${data.item.title}: загружено ${data.count} фото. Альбом опубликован.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка загрузки VK");
    } finally { setBusy(false); }
  };

  const edit = (item: Album) => {
    setForm({ id: item.id, title: item.title, description: item.description ?? "", eventDate: item.eventDate?.slice(0, 10) ?? "", photos: list(item.photos), coverUrl: item.coverUrl ?? "", isPublished: item.isPublished });
    setOpen(true);
  };
  const toggle = async (item: Album) => {
    await fetch("/api/admin/media", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isPublished: !item.isPublished }),
    });
    await refresh();
  };

  return <section className="adminContent divisionPage mediaAdmin">
    <a className="backButton" href="/admin">← К панели управления</a>
    <div className="competitionHead"><div><span>КОНТЕНТ САЙТА</span><h2>Медиагалерея</h2><p>Фотоальбомы лиги — из VK или загруженные вручную.</p></div><button onClick={() => { setForm(blank); setOpen(true); }}>+ НОВЫЙ АЛЬБОМ</button></div>

    <section className="mediaVkImport">
      <div><span>ИМПОРТ ИЗ ВКОНТАКТЕ</span><h3>Подключить фотоальбом</h3><p>Вставьте ссылку вида vk.ru/album-123_456. Снимки на сайте обновляются автоматически раз в час; если VK недоступен, остаётся сохранённая копия.</p>{vkConfigured === false ? <p className="mediaVkWarning">Подключение пока недоступно: на сервере не настроен токен VK. Сама ссылка подходит.</p> : null}</div>
      <form onSubmit={(event) => { event.preventDefault(); void importVk(albumUrl); }}>
        <input type="url" value={albumUrl} onChange={(event) => setAlbumUrl(event.target.value)} placeholder="https://vk.ru/album-123_456" aria-label="Ссылка на альбом ВКонтакте" required />
        <button disabled={busy || vkConfigured !== true || !albumUrl.trim()}>{busy ? "Загружаю…" : "ДОБАВИТЬ ИЗ ВК"}</button>
      </form>
    </section>
    {error ? <p className="documentError">{error}</p> : null}
    {notice ? <p className="adminNotice">{notice}</p> : null}

    {open ? <AdminModal title={form.id ? "Редактировать альбом" : "Новый альбом"} onClose={() => setOpen(false)} wide><section className="mediaEditor">
      <header><div><span>{form.id ? "РЕДАКТИРОВАНИЕ" : "НОВЫЙ АЛЬБОМ"}</span><h2>{form.title || "Без названия"}</h2></div><button onClick={() => setOpen(false)}>Закрыть ×</button></header>
      <div className="mediaEditorFields">
        <label>Название<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>Дата события<input type="date" value={form.eventDate} onChange={(event) => setForm({ ...form, eventDate: event.target.value })} /></label>
        <label className="wide">Описание<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <label className="wide mediaUpload">Фотографии<input type="file" accept="image/*" multiple onChange={upload} /><span>{busy ? "Загрузка…" : "Выбрать несколько фотографий"}</span></label>
        <div className="wide mediaPreview">{form.photos.map((photo, index) => <div className={form.coverUrl === photo ? "cover" : ""} key={`${photo}-${index}`}><PublicImage sizes="(max-width: 700px) 90vw, 320px" src={photo} alt="" /><button onClick={() => setForm({ ...form, coverUrl: photo })}>Обложка</button><button onClick={() => setForm({ ...form, photos: form.photos.filter((_, i) => i !== index), coverUrl: form.coverUrl === photo ? form.photos.find((_, i) => i !== index) ?? "" : form.coverUrl })}>×</button></div>)}</div>
        <label className="wide documentPublish"><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} /><span><b>Опубликовать альбом</b><small>Альбом станет доступен в медиагалерее сайта.</small></span></label>
      </div>
      <footer><button onClick={() => setOpen(false)}>Отмена</button><button disabled={busy} onClick={save}>{busy ? "СОХРАНЯЮ…" : "СОХРАНИТЬ АЛЬБОМ"}</button></footer>
    </section></AdminModal> : null}

    <section className="mediaAdminGrid">{items.length ? items.map((item) => {
      const source = vkUrl(item.slug);
      return <article key={item.id}>
        {item.coverUrl ? <PublicImage sizes="(max-width: 700px) 90vw, 320px" src={item.coverUrl} alt="" /> : <div>ЛХЛ-76</div>}
        <span>{list(item.photos).length} фото{source ? " · VK" : ""}</span>
        <h3>{item.title}</h3><small>{item.isPublished ? "Опубликован" : "Черновик"}</small>
        <footer><button onClick={() => edit(item)}>Изменить</button>{source ? <button disabled={busy} onClick={() => void importVk(source)}>Обновить из VK</button> : null}<button onClick={() => void toggle(item)}>{item.isPublished ? "Снять" : "Опубликовать"}</button></footer>
      </article>;
    }) : <p className="registryEmpty">Альбомов пока нет. Подключите VK-альбом или создайте его вручную.</p>}</section>
  </section>;
}
