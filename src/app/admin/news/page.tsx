"use client";
import { AdminModal } from "../admin-modal";
import { PublicImage } from "@/components/public-image";

import { useEffect, useState } from "react";

type NewsItem = {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  body: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  gallery: unknown;
  publishedAt: string | null;
  isPublished: boolean;
};

type Draft = {
  id?: string;
  title: string;
  category: string;
  excerpt: string;
  body: string;
  status: "DRAFT" | "PUBLISHED";
  imageUrl: string;
  videoUrl: string;
  gallery: string[];
};

const emptyDraft: Draft = { title: "", category: "Новости", excerpt: "", body: "", status: "DRAFT", imageUrl: "", videoUrl: "", gallery: [] };
const galleryOf = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export default function NewsAdminPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");

  const load = () => fetch("/api/admin/news", { cache: "no-store" }).then((response) => response.json()).then((data) => setItems(data.items ?? []));
  useEffect(() => { load().catch(() => setError("Не удалось загрузить новости")); }, []);

  const edit = (item: NewsItem) => setDraft({
    id: item.id,
    title: item.title,
    category: item.category,
    excerpt: item.excerpt,
    body: item.body ?? "",
    status: item.isPublished ? "PUBLISHED" : "DRAFT",
    imageUrl: item.imageUrl ?? "",
    videoUrl: item.videoUrl ?? "",
    gallery: galleryOf(item.gallery),
  });

  const upload = async (file: File, target: "cover" | "video" | "gallery") => {
    setUploading(target); setError("");
    try {
      const form = new FormData(); form.append("file", file); form.append("kind", "news");
      const response = await fetch("/api/admin/upload", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось загрузить файл");
      setDraft((current) => current ? target === "cover" ? { ...current, imageUrl: result.url } : target === "video" ? { ...current, videoUrl: result.url } : { ...current, gallery: [...current.gallery, result.url] } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось загрузить файл"); }
    finally { setUploading(""); }
  };

  const uploadGallery = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) await upload(file, "gallery");
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/admin/news", { method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить новость");
      setDraft(null); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить новость"); }
    finally { setSaving(false); }
  };

  const toggle = async (item: NewsItem) => {
    const response = await fetch("/api/admin/news", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, isPublished: !item.isPublished }) });
    if (response.ok) await load();
  };

  return <main className="adminShell adminNews"><section className="adminContent divisionPage">
    <div className="competitionHead newsAdminHeading"><div><span>КОНТЕНТ САЙТА</span><h2>Новости</h2><p>Создавай публикации с полноценным текстом, обложкой, фотогалереей и видео. На сайте отображаются только опубликованные материалы.</p></div><button onClick={() => setDraft({ ...emptyDraft })}>+ СОЗДАТЬ НОВОСТЬ</button></div>
    {error ? <p className="formError">{error}</p> : null}

    {draft && <AdminModal title={draft.id ? "Редактировать новость" : "Новая новость"} onClose={() => setDraft(null)} wide><section className="newsEditor">
      <header><div><span>{draft.id ? "РЕДАКТИРОВАНИЕ" : "НОВАЯ ПУБЛИКАЦИЯ"}</span><h2>{draft.title || "Без названия"}</h2></div><button onClick={() => setDraft(null)}>Закрыть ×</button></header>
      <div className="newsEditorGrid"><div className="newsEditorFields">
        <label>Заголовок<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Например: Старт нового сезона ЛХЛ-76" /></label>
        <div><label>Категория<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option>Новости</option><option>Матчи</option><option>Лига</option><option>Сообщество</option></select></label><label>Статус<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Draft["status"] })}><option value="DRAFT">Черновик</option><option value="PUBLISHED">Опубликовано</option></select></label></div>
        <label>Короткий анонс<small>Показывается на карточке новости на главной.</small><textarea className="newsExcerpt" value={draft.excerpt} onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} placeholder="Кратко расскажи, о чём материал — 1–3 предложения." /></label>
        <label>Полный текст новости<small>Основной текст публикации. Абзацы сохраняются.</small><textarea className="newsBody" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="Напиши полный текст новости…" /></label>
      </div><aside className="newsMediaPanel">
        <section><h3>Обложка</h3><p>Главное изображение карточки и страницы новости.</p>{draft.imageUrl ? <div className="newsMediaPreview"><PublicImage sizes="(max-width: 700px) 90vw, 320px" src={draft.imageUrl} alt="Обложка"/><button onClick={() => setDraft({ ...draft, imageUrl: "" })}>Удалить</button></div> : null}<label className="newsFileButton">{uploading === "cover" ? "Загружаю…" : "Загрузить обложку"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0], "cover")}/></label></section>
        <section><h3>Фотографии в новости</h3><p>Можно выбрать несколько изображений.</p><div className="newsGalleryPreview">{draft.gallery.map((url, index) => <div key={`${url}-${index}`}><PublicImage sizes="(max-width: 700px) 90vw, 320px" src={url} alt=""/><button onClick={() => setDraft({ ...draft, gallery: draft.gallery.filter((_, item) => item !== index) })}>×</button></div>)}</div><label className="newsFileButton">{uploading === "gallery" ? "Загружаю…" : "+ Добавить фотографии"}<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => uploadGallery(event.target.files)}/></label></section>
        <section><h3>Видео</h3><p>Загрузи MP4, WEBM или MOV до 150 МБ либо вставь внешнюю ссылку.</p>{draft.videoUrl && draft.videoUrl.startsWith("/uploads/") ? <video className="newsVideoPreview" src={draft.videoUrl} controls /> : null}<input value={draft.videoUrl} onChange={(event) => setDraft({ ...draft, videoUrl: event.target.value })} placeholder="https://vkvideo.ru/… или YouTube"/><label className="newsFileButton secondary">{uploading === "video" ? "Загружаю…" : "Загрузить видеофайл"}<input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0], "video")}/></label>{draft.videoUrl ? <button className="newsRemoveMedia" onClick={() => setDraft({ ...draft, videoUrl: "" })}>Убрать видео</button> : null}</section>
      </aside></div>
      <footer><button onClick={() => setDraft(null)}>Отмена</button><button disabled={saving || Boolean(uploading)} onClick={save}>{saving ? "СОХРАНЯЮ…" : draft.status === "PUBLISHED" ? "СОХРАНИТЬ И ОПУБЛИКОВАТЬ" : "СОХРАНИТЬ ЧЕРНОВИК"}</button></footer>
    </section></AdminModal>}

    <section className="newsAdminList"><header><span>ПУБЛИКАЦИИ</span><small>{items.length} материалов</small></header>{items.length ? items.map((item) => <article key={item.id}>{item.imageUrl ? <div className="newsThumb hasImage"><PublicImage sizes="(max-width: 700px) 90vw, 320px" src={item.imageUrl} alt=""/></div> : <div className="newsThumb">ЛХЛ<br/>76</div>}<div><em>{item.category}</em><h3>{item.title}</h3><p>{item.excerpt}</p><small>{item.body ? "Полный текст" : "Только анонс"}{item.videoUrl ? " · Видео" : ""}{galleryOf(item.gallery).length ? ` · Фото: ${galleryOf(item.gallery).length}` : ""}</small></div><time>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("ru-RU") : "Не опубликована"}</time><span className={item.isPublished ? "published" : "draft"}>{item.isPublished ? "Опубликовано" : "Черновик"}</span><div className="newsRowActions"><button onClick={() => edit(item)}>Редактировать</button><button onClick={() => toggle(item)}>{item.isPublished ? "Снять" : "Опубликовать"}</button></div></article>) : <p className="registryEmpty">Новостей в базе пока нет. Создай первую публикацию кнопкой выше.</p>}</section>
  </section></main>;
}
