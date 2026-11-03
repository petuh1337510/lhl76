"use client";
import { AdminModal } from "../admin-modal";
import { PublicImage } from "@/components/public-image";

import { ChangeEvent, useEffect, useState } from "react";

type BannerVariant = "league"|"partner"|"match"|"broadcast"|"photo";
type Item = { id:string; title:string; subtitle:string; link:string; type:"banner"|"tile"; active:boolean; imageDesktop:string; imageMobile:string; style:string; sortOrder:number; variant:BannerVariant; eyebrow:string; buttonLabel:string; logoUrl:string; duration:number };
const blank = (type: Item["type"]): Item => ({ id:"", title:"", subtitle:"", link:"", type, active:true, imageDesktop:"", imageMobile:"", style:type === "tile" ? "navy" : "", sortOrder:0, variant:"league", eyebrow:"ЛХЛ-76", buttonLabel:"ПОДРОБНЕЕ", logoUrl:"", duration:6500 });
const withBannerSettings = (item: Item): Item => {
  // Optional database values must remain controlled text fields in the editor.
  item = { ...item, title:item.title ?? "", subtitle:item.subtitle ?? "", link:item.link ?? "" };
  if (item.type !== "banner") return { ...item, variant:"league", eyebrow:"", buttonLabel:"", logoUrl:"", duration:6500 };
  try {
    const settings = JSON.parse(item.style || "{}");
    return { ...item, variant:settings.variant || "league", eyebrow:settings.eyebrow || "ЛХЛ-76", buttonLabel:settings.buttonLabel || "ПОДРОБНЕЕ", logoUrl:settings.logoUrl || "", duration:Number(settings.duration) || 6500 };
  } catch { return { ...item, variant:"league", eyebrow:"ЛХЛ-76", buttonLabel:"ПОДРОБНЕЕ", logoUrl:"", duration:6500 }; }
};

export default function HomepageContent() {
  const [tab, setTab] = useState<Item["type"]>("banner");
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = () => fetch("/api/admin/homepage-content", { cache:"no-store" }).then((response) => response.json()).then((data) => setItems((data.items ?? []).map(withBannerSettings)));
  useEffect(() => { refresh(); }, []);

  const upload = async (event: ChangeEvent<HTMLInputElement>, field: "imageDesktop"|"imageMobile"|"logoUrl") => {
    const file = event.target.files?.[0]; if (!file || !editing) return;
    setBusy(true); const body = new FormData(); body.set("file", file); body.set("kind", "media");
    const response = await fetch("/api/admin/upload", { method:"POST", body }); const data = await response.json();
    if (response.ok) setEditing((current) => current ? { ...current, [field]:data.url } : current); else setError(data.error ?? "Не удалось загрузить изображение");
    setBusy(false);
  };
  const save = async () => {
    if (!editing) return; setBusy(true); setError("");
    const payload = editing.type === "banner" ? { ...editing, style:JSON.stringify({ variant:editing.variant, eyebrow:editing.eyebrow, buttonLabel:editing.buttonLabel, logoUrl:editing.logoUrl, duration:editing.duration }) } : editing;
    const response = await fetch("/api/admin/homepage-content", { method:editing.id ? "PATCH" : "POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
    const data = await response.json(); if (!response.ok) setError(data.error ?? "Ошибка сохранения"); else { await refresh(); setEditing(null); } setBusy(false);
  };
  const reorder = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= visible.length) return;
    setBusy(true); setError("");
    const reordered = [...visible];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const response = await fetch("/api/admin/homepage-content", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"reorder", orderIds:reordered.map((item) => item.id) }) });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Не удалось изменить порядок");
    await refresh(); setBusy(false);
  };
  const toggleActive = async (item: Item) => {
    setBusy(true); setError("");
    const response = await fetch("/api/admin/homepage-content", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"toggle-active", id:item.id, active:!item.active }) });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Не удалось изменить видимость");
    await refresh(); setBusy(false);
  };
  const remove = async (item: Item) => { if (!confirm(`Удалить «${item.title}»?`)) return; await fetch(`/api/admin/homepage-content?id=${item.id}`, { method:"DELETE" }); refresh(); };
  const visible = items.filter((item) => item.type === tab);

  return <main className="adminShell adminHomepage"><section className="adminContent divisionPage">
    <a className="backButton" href="/admin">← К панели управления</a>
    <div className="competitionHead"><div><span>КОНТЕНТ ГЛАВНОЙ СТРАНИЦЫ</span><h2>{tab === "banner" ? "Главный баннер" : "Промо-плитки"}</h2><p>Изменения после сохранения сразу появляются на главной.</p></div><button onClick={() => setEditing(blank(tab))}>+ ДОБАВИТЬ</button></div>
    <div className="matchAdminFilters"><button className={tab === "banner" ? "active" : ""} onClick={() => { setTab("banner"); setEditing(null); }}>Главный баннер</button><button className={tab === "tile" ? "active" : ""} onClick={() => { setTab("tile"); setEditing(null); }}>Промо-плитки</button></div>
    {editing ? <AdminModal title={editing.id ? "Редактировать материал" : "Новый материал"} onClose={() => setEditing(null)} wide><section className="adminForm homepageEditor">
      <h2>{editing.id ? "Редактировать материал" : "Новый материал"}</h2>
      <label>{editing.type === "banner" && editing.variant === "photo" ? "Название в админке (на баннере не показывается)" : "Заголовок"}<input value={editing.title} onChange={(event) => setEditing({...editing,title:event.target.value})}/></label>
      {editing.type !== "banner" || editing.variant !== "photo" ? <label>Короткий текст<input value={editing.subtitle} onChange={(event) => setEditing({...editing,subtitle:event.target.value})}/></label> : null}
      <label>Ссылка при клике<input value={editing.link} onChange={(event) => setEditing({...editing,link:event.target.value})} placeholder="/championship/current"/></label>
      {editing.type === "banner" ? <>
        <div className="homepageBannerSettings">
          <label>Тип слайда<select value={editing.variant} onChange={(event) => setEditing({...editing,variant:event.target.value as BannerVariant})}><option value="league">Лига / сезон</option><option value="partner">Партнёр</option><option value="match">Матч</option><option value="broadcast">Трансляция</option><option value="photo">Готовый фотобаннер (без текста)</option></select></label>
          {editing.variant !== "photo" ? <label>Надпись над заголовком<input value={editing.eyebrow} onChange={(event) => setEditing({...editing,eyebrow:event.target.value})} placeholder="ГЕНЕРАЛЬНЫЙ ПАРТНЁР"/></label> : null}
          {editing.variant !== "photo" ? <label>Текст кнопки<input value={editing.buttonLabel} onChange={(event) => setEditing({...editing,buttonLabel:event.target.value})} placeholder="ПОДРОБНЕЕ"/></label> : null}
          <label>Время показа<select value={editing.duration} onChange={(event) => setEditing({...editing,duration:Number(event.target.value)})}><option value={5000}>5 секунд</option><option value={6500}>6,5 секунды</option><option value={8000}>8 секунд</option><option value={10000}>10 секунд</option></select></label>
        </div>
        {editing.variant === "photo" ? <p className="homepagePhotoHint"><b>Чистый фотобаннер</b><span>На сайте будет показано только загруженное изображение — без текста и затемнения. Ссылка при клике необязательна. На телефоне широкое фото обрезается по краям, поэтому для точной композиции загрузите отдельный мобильный коллаж.</span></p> : <label className="homepageLogoUpload">Логотип партнёра или события<input type="file" accept="image/*" onChange={(event) => upload(event,"logoUrl")}/>{editing.logoUrl ? <PublicImage sizes="(max-width: 700px) 90vw, 320px" src={editing.logoUrl} alt=""/> : <small>Необязательно. Лучше использовать PNG или SVG на прозрачном фоне.</small>}</label>}
      </> : <label>Цвет плитки<select value={editing.style} onChange={(event) => setEditing({...editing,style:event.target.value})}><option value="navy">Синий</option><option value="red">Красный</option><option value="photo">С фотографией</option></select></label>}
      <label>Порядок<input type="number" value={editing.sortOrder} onChange={(event) => setEditing({...editing,sortOrder:Number(event.target.value)})}/></label>
      <div className="homepageImages">
        <label>Изображение для компьютера<input type="file" accept="image/*" onChange={(event) => upload(event,"imageDesktop")}/>{editing.imageDesktop ? <PublicImage sizes="(max-width: 700px) 90vw, 320px" src={editing.imageDesktop} alt=""/> : null}{editing.type === "banner" && editing.variant === "photo" ? <small>Рекомендуемый размер: 1920 × 600 px. Файл сохраняется без сжатия.</small> : null}</label>
        <label>Изображение для телефона<input type="file" accept="image/*" onChange={(event) => upload(event,"imageMobile")}/>{editing.imageMobile ? <PublicImage sizes="(max-width: 700px) 90vw, 320px" src={editing.imageMobile} alt=""/> : null}<small>{editing.type === "banner" && editing.variant === "photo" ? "Загрузите отдельный вертикальный коллаж, например 1080 × 1350 px. Без него на телефоне будет показан увеличенный фрагмент изображения для компьютера." : "Если не выбрать, используется изображение для компьютера."}</small></label>
      </div>
      <label className="documentPublish"><input type="checkbox" checked={editing.active} onChange={(event) => setEditing({...editing,active:event.target.checked})}/><span><b>Показывать на главной</b><small>{editing.type === "banner" ? "Можно включить несколько слайдов — они будут сменять друг друга." : "Плитку можно временно скрыть."}</small></span></label>
      {error ? <p className="documentError">{error}</p> : null}
      <footer><button onClick={() => setEditing(null)}>Отмена</button><button disabled={busy} onClick={save}>{busy ? "СОХРАНЯЮ…" : "Сохранить"}</button></footer>
    </section></AdminModal> : null}
    <section className="homeContentList"><header><span>МАТЕРИАЛЫ</span><small>{visible.length}</small></header>{visible.length ? visible.map((item, index) => <article key={item.id}>
      <div className={`homeContentPreview ${item.type === "banner" ? "isBanner" : "isTile"} ${item.imageDesktop ? "hasImage" : ""}`} style={item.imageDesktop ? {backgroundImage:`url(${item.imageDesktop})`} : undefined}><span>№ {index + 1}</span>{!item.imageDesktop ? <strong>{item.title}</strong> : null}</div>
      <div><h3>{item.title}</h3><p>{item.subtitle || "Без описания"} · {item.link || "ссылка не указана"}</p></div>
      <button disabled={busy} className={`homeContentVisibility ${item.active ? "published" : "draft"}`} onClick={() => toggleActive(item)}>{item.active ? "Показывается" : "Выключено"}</button>
      <div className="homeContentActions"><button disabled={busy || index === 0} onClick={() => reorder(index,-1)} aria-label={`Поднять ${item.title}`}>↑</button><button disabled={busy || index === visible.length - 1} onClick={() => reorder(index,1)} aria-label={`Опустить ${item.title}`}>↓</button><button onClick={() => setEditing(item)}>Редактировать</button><button onClick={() => remove(item)}>Удалить</button></div>
    </article>) : <p className="registryEmpty">Материалов пока нет. Пока используются стандартные тексты сайта.</p>}</section>
  </section></main>;
}
