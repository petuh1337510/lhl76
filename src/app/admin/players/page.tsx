"use client";
import { PublicImage } from "@/components/public-image";
import { FormEvent, useEffect, useState } from "react";

export default function PlayersList() {
  const [data, setData] = useState<any>({ items: [], page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1), [search, setSearch] = useState(""), [query, setQuery] = useState("");
  useEffect(() => { fetch(`/api/admin/players?page=${page}&search=${encodeURIComponent(query)}`).then(r => r.json()).then(setData); }, [page, query]);
  const submit = (event: FormEvent) => { event.preventDefault(); setPage(1); setQuery(search.trim()); };
  return <main className="adminShell"><section className="adminContent divisionPage"><div className="adminRegistryHead"><div><span>УЧАСТНИКИ</span><h1>Игроки</h1><p>Все игроки из общей базы · {data.total}</p></div><button onClick={()=>window.location.href="/admin/player?new=1"}>+ СОЗДАТЬ ИГРОКА</button></div><form className="adminRegistrySearch" onSubmit={submit}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по фамилии, имени или отчеству"/><button>НАЙТИ</button></form><section className="adminRegistry"><header><span>Игрок</span><span>Амплуа</span><span>Дата рождения</span><span>Заявок</span><i/></header>{data.items.map((player:any)=><article key={player.id}><div className="registryIdentity">{player.photoUrl?<PublicImage sizes="(max-width: 700px) 90vw, 320px" src={player.photoUrl} alt=""/>:<b>{player.lastName[0]}{player.firstName[0]}</b>}<span><strong>{player.lastName} {player.firstName}</strong><small>{player.patronymic||"Отчество не указано"}</small></span></div><span>{player.position||"—"}</span><span>{player.birthDate?new Date(player.birthDate).toLocaleDateString("ru-RU"):"—"}</span><span>{player._count.rosterEntries}</span><a href={`/admin/player?slug=${player.slug}`}>Открыть →</a></article>)}</section><div className="adminPagination"><button disabled={page<=1} onClick={()=>setPage(page-1)}>←</button><span>Страница {data.page} из {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(page+1)}>→</button></div></section></main>;
}
