"use client";
import { AdminModal } from "../admin-modal";
import { PublicImage } from "@/components/public-image";

import { ChangeEvent, useEffect, useState } from "react";

type Item = {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  imageUrl: string | null;
  startsAt: string | null;
  isLive: boolean;
  isPublished: boolean;
};

const blank = {
  id: "", title: "", description: "", videoUrl: "", imageUrl: "",
  startsAt: "", isLive: false, isPublished: true,
};

export default function BroadcastAdmin() {
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => fetch("/api/admin/broadcasts", { cache: "no-store" })
    .then((response) => response.json())
    .then((data) => setItems(data.items ?? []));

  useEffect(() => { refresh(); }, []);

  const loadPreview = async () => {
    if (!form.videoUrl || form.imageUrl || previewBusy) return;
    setPreviewBusy(true);
    try {
      const response = await fetch(`/api/admin/broadcasts/preview?url=${encodeURIComponent(form.videoUrl)}`);
      const data = await response.json();
      if (response.ok && data.imageUrl) setForm((current) => ({ ...current, imageUrl: data.imageUrl }));
    } finally {
      setPreviewBusy(false);
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const body = new FormData();
    body.set("file", file);
    body.set("kind", "media");
    const response = await fetch("/api/admin/upload", { method: "POST", body });
    const data = await response.json();
    if (response.ok) setForm((current) => ({ ...current, imageUrl: data.url }));
    else setError(data.error);
    setBusy(false);
  };

  const save = async () => {
    setBusy(true);
    setError("");
    const response = await fetch("/api/admin/broadcasts", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Ошибка сохранения");
    else { await refresh(); setOpen(false); setForm(blank); }
    setBusy(false);
  };

  const edit = (item: Item) => {
    setForm({
      id: item.id, title: item.title, description: item.description ?? "",
      videoUrl: item.videoUrl, imageUrl: item.imageUrl ?? "",
      startsAt: item.startsAt?.slice(0, 16) ?? "", isLive: item.isLive,
      isPublished: item.isPublished,
    });
    setOpen(true);
  };

  const toggle = async (item: Item) => {
    await fetch("/api/admin/broadcasts", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isPublished: !item.isPublished }),
    });
    refresh();
  };

  return (
    <section className="adminContent divisionPage broadcastAdmin">

      <div className="competitionHead">
        <div><h1>Трансляции</h1></div>
        <button onClick={() => { setForm(blank); setOpen(true); }}>+ ДОБАВИТЬ ВИДЕО</button>
      </div>

      {open ? (
        <AdminModal title={form.id ? "Редактировать трансляцию" : "Новая трансляция"} onClose={() => setOpen(false)} wide>
        <section className="mediaEditor">
          <header>
            <div><span>{form.id ? "РЕДАКТИРОВАНИЕ" : "НОВАЯ ТРАНСЛЯЦИЯ"}</span><h2>{form.title || "Без названия"}</h2></div>
            <button onClick={() => setOpen(false)}>Закрыть ×</button>
          </header>
          <div className="mediaEditorFields">
            <label>Название<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
            <label>Дата и время<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label>
            <label className="wide">
              Ссылка на YouTube, Rutube, VK Видео или файл
              <input value={form.videoUrl} onChange={(event) => setForm({ ...form, videoUrl: event.target.value, imageUrl: "" })} onBlur={loadPreview} placeholder="https://..." />
              <small className="broadcastPreviewHint">{previewBusy ? "Получаем обложку…" : "Обложка из VK Видео подгрузится автоматически."}</small>
            </label>
            <label className="wide">Описание<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            <label className="wide mediaUpload">Обложка<input type="file" accept="image/*" onChange={upload} /><span>{form.imageUrl ? "Заменить обложку" : "Выбрать изображение вручную"}</span></label>
            {form.imageUrl ? <PublicImage sizes="(max-width: 700px) 90vw, 320px" className="broadcastCoverPreview wide" src={form.imageUrl} alt="Предпросмотр обложки" /> : null}
            <label className="documentPublish"><input type="checkbox" checked={form.isLive} onChange={(event) => setForm({ ...form, isLive: event.target.checked })} /><span><b>Сейчас идёт ЛАЙВ</b><small>Показывать красную отметку прямого эфира.</small></span></label>
            <label className="documentPublish"><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} /><span><b>Опубликовать</b><small>Показывать трансляцию на сайте.</small></span></label>
            {error ? <p className="documentError">{error}</p> : null}
          </div>
          <footer><button onClick={() => setOpen(false)}>Отмена</button><button disabled={busy} onClick={save}>{busy ? "СОХРАНЯЮ…" : "СОХРАНИТЬ"}</button></footer>
        </section>
        </AdminModal>
      ) : null}

      <section className="mediaAdminGrid">
        {items.length ? items.map((item) => (
          <article key={item.id}>
            {item.imageUrl ? <PublicImage sizes="(max-width: 700px) 90vw, 320px" src={item.imageUrl} alt="" /> : <div>▶</div>}
            {item.isLive ? <span>● ЛАЙВ</span> : null}<h3>{item.title}</h3>
            <small>{item.isPublished ? "Опубликовано" : "Черновик"}</small>
            <footer><button onClick={() => edit(item)}>Изменить</button><button onClick={() => toggle(item)}>{item.isPublished ? "Снять" : "Опубликовать"}</button></footer>
          </article>
        )) : <p className="registryEmpty">Трансляций пока нет.</p>}
      </section>
    </section>
  );
}
