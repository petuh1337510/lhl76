"use client";
import { useCallback, useEffect, useState } from "react";

export default function SuspensionsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const load=useCallback(async(nextStatus:string) => {
    setLoading(true);
    const response = await fetch(`/api/admin/suspensions${nextStatus ? `?status=${nextStatus}` : ""}`, { cache: "no-store" });
    if (response.ok) setItems((await response.json()).items);
    setLoading(false);
  },[]);
  useEffect(() => { load(''); }, [load]);
  const changeStatus = (value: string) => { setStatus(value); load(value); };
  return <main className="adminShell"><section className="adminContent divisionPage">
    <div className="competitionHead"><div><h1>Дисквалификации</h1><p>Дисквалификация действует во всех командах игрока. Срок считают по матчам команды, в которой назначена санкция.</p></div></div>
    <div className="matchAdminFilters">
      {[['','Все'],['ACTIVE','Действующие'],['COMPLETED','Завершённые'],['CANCELLED','Отменённые']].map(([value,label])=><button key={value} className={status===value?"active":""} onClick={()=>changeStatus(value)}>{label}</button>)}
    </div>
    <section className="suspensionRegistry"><header><span>Игрок</span><span>Команда и соревнование</span><span>Срок</span><span>Причина</span><span>Статус</span></header>
      {loading?<p>Загрузка…</p>:items.length?items.map(item=>{const entry=item.rosterEntry,competition=entry.teamEntry.division.competition;return <article key={item.id}>
        <a href={`/admin/player?slug=${entry.player.slug}`}><b>{entry.player.lastName} {entry.player.firstName}</b><small>{entry.player.position||"Игрок"}</small></a>
        <div><b>{entry.teamEntry.team.name}</b><small>{competition.season.name} · {competition.name} · {entry.teamEntry.division.name}</small></div>
        <span>С {new Date(item.startsAt).toLocaleDateString("ru-RU")}{item.matchesCount?<small>{item.effectiveStatus === "ACTIVE" ? `Осталось ${item.remaining} из ${item.matchesCount}` : `${item.matchesCount} матч.`}</small>:null}</span>
        <div><b>{item.reason}</b>{item.note?<small>{item.note}</small>:null}</div>
        <em className={item.effectiveStatus.toLowerCase()}>{item.effectiveStatus==="ACTIVE"?"Действует":item.effectiveStatus==="COMPLETED"?"Завершена":"Отменена"}</em>
      </article>}):<p>Записей пока нет.</p>}
    </section>
  </section></main>;
}
