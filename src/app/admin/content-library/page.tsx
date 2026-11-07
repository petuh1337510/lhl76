"use client";
import { AdminModal } from "../admin-modal";

import { ChangeEvent, useEffect, useState } from "react";
import {safeHref} from '@/lib/editorial-url';

type DocumentItem = { id: string; title: string; category: string | null; fileUrl: string; publishedAt: string | null };

const emptyForm = { id: "", title: "", category: "Регламенты", fileUrl: "", isPublished: true };

export default function ContentLibrary() {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => fetch("/api/admin/documents", { cache: "no-store" }).then((response) => response.json()).then((data) => setItems(data.items ?? []));
  useEffect(() => { refresh().catch(() => setError("Не удалось загрузить документы")); }, []);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError("");
    const body = new FormData(); body.set("file", file); body.set("kind", "documents");
    const response = await fetch("/api/admin/upload", { method: "POST", body });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Не удалось загрузить файл");
    else setForm((value) => ({ ...value, fileUrl: data.url }));
    setBusy(false);
  };

  const save = async () => {
    setBusy(true); setError("");
    const response = await fetch("/api/admin/documents", { method: form.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Не удалось сохранить документ");
    else { await refresh(); setOpen(false); setForm(emptyForm); }
    setBusy(false);
  };

  const edit = (item: DocumentItem) => {
    setForm({ id: item.id, title: item.title, category: item.category ?? "Документы", fileUrl: item.fileUrl, isPublished: Boolean(item.publishedAt) });
    setOpen(true); setError("");
  };

  const toggle = async (item: DocumentItem) => {
    await fetch("/api/admin/documents", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, isPublished: !item.publishedAt }) });
    await refresh();
  };

  return <section className="adminContent divisionPage contentLibraryPage">

    <div className="competitionHead"><div><h1>Документы</h1></div><button onClick={() => { setForm(emptyForm); setOpen(true); }}>+ Добавить документ</button></div>
      {open ? <AdminModal title={form.id ? "Редактировать документ" : "Новый документ"} onClose={() => setOpen(false)}><section className="documentEditor"><header><div><span>{form.id ? "РЕДАКТИРОВАНИЕ" : "НОВЫЙ ДОКУМЕНТ"}</span><h2>{form.title || "Без названия"}</h2></div><button onClick={() => setOpen(false)}>Закрыть ×</button></header><div><label>Название<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Например: Регламент чемпионата"/></label><label>Категория<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Регламенты"/></label><label className="documentUpload">Файл PDF, Word или Excel<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={upload}/><span>{form.fileUrl ? `Файл загружен: ${form.fileUrl.split("/").pop()}` : "Выбрать файл"}</span></label><label className="documentPublish"><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })}/><span><b>Опубликовать на сайте</b><small>Документ сразу появится в публичном разделе.</small></span></label>{error ? <p className="documentError">{error}</p> : null}</div><footer><button onClick={() => setOpen(false)}>Отмена</button><button disabled={busy} onClick={save}>{busy ? "СОХРАНЯЮ…" : form.id ? "СОХРАНИТЬ" : "ДОБАВИТЬ ДОКУМЕНТ"}</button></footer></section></AdminModal> : null}
      <section className="libraryList documentList"><header><span>ДОКУМЕНТЫ</span><small>{items.length} материалов</small></header>{items.length ? items.map((item) => <article key={item.id}><div>▤</div><b>{item.title}<small>{item.category || "Без категории"}</small></b><span className={item.publishedAt ? "published" : "draft"}>{item.publishedAt ? "Опубликован" : "Черновик"}</span><a href={safeHref(item.fileUrl)} target="_blank" rel="noreferrer">Открыть</a><button onClick={() => edit(item)}>Изменить</button><button onClick={() => toggle(item)}>{item.publishedAt ? "Снять" : "Опубликовать"}</button></article>) : <p className="registryEmpty">Документов пока нет.</p>}</section>
  </section>;
}
