'use client';
import { Suspense, useEffect, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import { canonicalDivisionName } from '@/lib/historical-division-names';
import { AdminModal } from '../admin-modal';

type Team={id:string;name:string;city:string|null};
type Division={id:string;name:string;teamEntries:{id:string;teamId:string;team:{name:string}}[];_count:{teamEntries:number;matches:number}};
type Competition={id:string;name:string;type:'CHAMPIONSHIP'|'TOURNAMENT';sortOrder:number;updatedAt:string;divisions:Division[]};
type Season={id:string;name:string;isActive:boolean;competitions:Competition[]};
type Mutate=(path:string,method:string,body:unknown,message:string)=>Promise<boolean>;
export default function Page(){return <Suspense fallback={<p>Загрузка соревнований…</p>}><Manager/></Suspense>}
function Manager(){
  const router=useRouter(),params=useSearchParams();
  const [seasons,setSeasons]=useState<Season[]>([]),[teams,setTeams]=useState<Team[]>([]),[names,setNames]=useState<string[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
  const seasonId=params?.get('seasonId'),competitionId=params?.get('competitionId'),creating=params?.get('create')==='1';
  const season=seasons.find(s=>s.id===seasonId)||(!seasonId?(seasons.find(s=>s.isActive)||seasons[0]):undefined);
  const competition=creating?undefined:season?.competitions.find(c=>c.id===competitionId);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);
    fetch('/api/admin/competitions',{cache:'no-store',signal:controller.signal}).then(async r=>{
      const data=await r.json();if(!r.ok)throw Error(data.error||'Не удалось загрузить соревнования');
      setSeasons(data.seasons);setTeams(data.teams);setNames(data.divisionNames);
    }).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[revision]);
  function navigate(id:string,child?:string){const q=new URLSearchParams({seasonId:id});if(child==='new')q.set('create','1');else if(child)q.set('competitionId',child);router.push('/admin/competitions?'+q);setError('');setNotice('')}
  const mutate:Mutate=async(path,method,body,message)=>{
    if(busy||loading)return false;setBusy(true);setError('');setNotice('');
    try{const r=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'Не удалось сохранить');setNotice(message);setRevision(v=>v+1);return true}
    catch(e){setError(e instanceof Error?e.message:'Ошибка запроса');return false}finally{setBusy(false)}
  };
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!season)return;const f=new FormData(e.currentTarget);
    const ok=await mutate('/api/admin/competitions',competition?'PATCH':'POST',{name:f.get('name'),sortOrder:competition?.sortOrder??0,...(competition?{id:competition.id,updatedAt:competition.updatedAt}:{seasonId:season.id,type:f.get('type')})},competition?'Настройки сохранены.':'Соревнование создано. Откройте его и добавьте дивизионы.');
    if(ok&&!competition)router.push('/admin/competitions?seasonId='+season.id);
  }
  async function remove(c:Competition){
    const confirmation=window.prompt(`Удалить «${c.name}»? Удаляются только пустое соревнование и пустые дивизионы. Команды, заявки и матчи удалять нельзя.\nДля подтверждения введите полное название:`);
    if(confirmation!==c.name)return;
    if(await mutate('/api/admin/competitions/manage','POST',{action:'delete',id:c.id,name:confirmation,updatedAt:c.updatedAt},'Пустое соревнование удалено.'))router.push('/admin/competitions?seasonId='+season!.id);
  }
  async function move(index:number,offset:number){if(!season)return;const list=[...season.competitions];[list[index],list[index+offset]]=[list[index+offset],list[index]];
    await mutate('/api/admin/competitions/manage','POST',{action:'reorder',seasonId:season.id,items:list.map(c=>({id:c.id,updatedAt:c.updatedAt}))},'Порядок соревнований сохранён.');
  }
  return <main className="adminShell"><section className={`adminContent divisionPage ${styles.page}`}>
    <header><h1>Соревнования</h1></header>
    <label className={styles.selector}>Сезон<select value={season?.id||''} disabled={busy||loading} onChange={e=>navigate(e.target.value)}><option value="" disabled>Выберите сезон</option>{seasons.map(s=><option key={s.id} value={s.id}>{s.name}{s.isActive?' · активный':''}</option>)}</select></label>
    {error&&<div role="alert" className={styles.error}>{error} <button disabled={busy||loading} onClick={()=>{setError('');setRevision(v=>v+1)}}>Обновить список</button></div>}{notice&&<p role="status">{notice}</p>}
    {loading&&<p role="status">Обновляю список…</p>}
    {!season?(!loading&&<p>Выберите существующий сезон.</p>):<fieldset className={styles.workspace} disabled={busy||loading}>
      {competition?<><button onClick={()=>navigate(season.id)}>← К соревнованиям сезона {season.name}</button>
        <form className={styles.card} onSubmit={save} key={(competition?.id||'new')+':'+(competition?.updatedAt||season.id)}>
          <h2>{competition?'Настройки соревнования':'Добавить соревнование'}</h2><p>Сезон: {season.name}</p>
          <label>Название<input name="name" required minLength={2} maxLength={120} defaultValue={competition?.name||''}/></label>
          {competition?<p>Тип: {competition.type==='CHAMPIONSHIP'?'Чемпионат':'Турнир'}.</p>:<label>Тип<select name="type" defaultValue="TOURNAMENT"><option value="TOURNAMENT">Турнир</option><option value="CHAMPIONSHIP" disabled={season.competitions.some(c=>c.type==='CHAMPIONSHIP')}>Чемпионат</option></select></label>}
          <div className={styles.actions}><button type="submit">Сохранить</button><button type="button" onClick={()=>navigate(season.id)}>Отмена</button></div>
        </form>
        {competition&&<>
          <section className={styles.card}><h2>Турнирные таблицы</h2><p>Таблицы дивизионов и действующие правила расчёта для сезона {season.name}, соревнования «{competition.name}».</p><a href={`/admin/standings?seasonId=${encodeURIComponent(season.id)}&competitionId=${encodeURIComponent(competition.id)}`}>ТУРНИРНЫЕ ТАБЛИЦЫ →</a></section>
          <DivisionPicker key={competition.id+':'+competition.divisions.length} competition={competition} names={names} mutate={mutate}/>
          {competition.divisions.map(d=><div key={d.id}><p><a href={`/admin/playoff?seasonId=${season.id}&competitionId=${competition.id}&divisionId=${d.id}`}>Плей-офф · {d.name} →</a></p><DivisionEditor key={d.id+':'+d.name} division={d} competition={competition} teams={teams} mutate={mutate}/></div>)}
          <section className={styles.card}><h2>Удаление соревнования</h2><p>Удалить можно только пустое соревнование. При наличии команд, заявок, матчей, таблиц или плей-офф удаление заблокировано.</p><button className={styles.danger} onClick={()=>remove(competition)}>Удалить соревнование</button></section>
        </>}
      </>:<><div className={styles.actions}><h2>Сезон {season.name}</h2><button onClick={()=>navigate(season.id,'new')}>+ Добавить соревнование</button></div>
        <p>Порядок карточек на сайте можно изменить кнопками «Раньше» и «Позже».</p>
        {competitionId&&<p role="alert">Соревнование не найдено в этом сезоне.</p>}
        <div className={styles.grid}>{season.competitions.map((c,index)=><article className={styles.card} key={c.id}><small>{c.type==='CHAMPIONSHIP'?'ЧЕМПИОНАТ':'ТУРНИР'}</small><h2>{c.name}</h2><p>Дивизионов: {c.divisions.length} · Команд: {c.divisions.reduce((n,d)=>n+d._count.teamEntries,0)} · Матчей: {c.divisions.reduce((n,d)=>n+d._count.matches,0)}</p><button onClick={()=>navigate(season.id,c.id)}>Открыть соревнование</button><div className={styles.actions}><button disabled={index===0} aria-label={`Раньше: ${c.name}`} onClick={()=>move(index,-1)}>↑ Раньше</button><button disabled={index===season.competitions.length-1} aria-label={`Позже: ${c.name}`} onClick={()=>move(index,1)}>↓ Позже</button></div></article>)}</div>
        {!season.competitions.length&&<p>В этом сезоне ещё нет соревнований.</p>}
      </>}
    </fieldset>}
    {creating&&season&&<AdminModal title="Добавить соревнование" onClose={()=>navigate(season.id)}><form className={`${styles.card} competitionModalForm`} onSubmit={save} key={`new:${season.id}`}>
      <h2>Добавить соревнование</h2><p>Сезон: {season.name}</p>
      {error&&<p role="alert" className={styles.error}>{error}</p>}
      <label>Название<input name="name" required minLength={2} maxLength={120}/></label>
      <label>Тип<select name="type" defaultValue="TOURNAMENT"><option value="TOURNAMENT">Турнир</option><option value="CHAMPIONSHIP" disabled={season.competitions.some(c=>c.type==='CHAMPIONSHIP')}>Чемпионат</option></select></label>
      <div className={`${styles.actions} competitionModalActions`}><button type="button" onClick={()=>navigate(season.id)}>Отмена</button><button type="submit" disabled={busy||loading}>Создать соревнование</button></div>
    </form></AdminModal>}
  </section></main>
}

function DivisionPicker({competition,names,mutate}:{competition:Competition;names:string[];mutate:Mutate}){
  const available=names.filter(n=>!competition.divisions.some(d=>canonicalDivisionName(d.name).toLocaleLowerCase('ru')===n.toLocaleLowerCase('ru')));
  const [selected,setSelected]=useState<string[]>([]);
  async function create(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=e.currentTarget;const name=String(new FormData(f).get('divisionName'));if(await mutate('/api/admin/competitions/divisions','POST',{competitionId:competition.id,name},'Новый дивизион создан.'))f.reset()}
  return <section className={styles.card}><h2>Добавить дивизионы</h2><p>Выберите один или несколько из истории лиги. «Плюс» и «Любитель+» объединены в списке под названием «Любитель Плюс».</p>
    <div className={styles.choices}>{available.map(n=><label key={n}><input type="checkbox" checked={selected.includes(n)} onChange={e=>setSelected(v=>e.target.checked?[...v,n]:v.filter(x=>x!==n))}/>{n}</label>)}</div>
    <button disabled={!selected.length} onClick={async()=>{if(await mutate('/api/admin/competitions/divisions','POST',{competitionId:competition.id,names:selected},'Дивизионы добавлены. Ниже можно выбрать команды.'))setSelected([])}}>Добавить выбранные ({selected.length})</button>
    <details className={styles.newDivision}><summary>Нужен новый дивизион, которого нет в списке?</summary><form onSubmit={create}><label>Название нового дивизиона<input name="divisionName" required minLength={2} maxLength={100}/></label><button type="submit">Создать дивизион</button></form></details>
  </section>
}

function DivisionEditor({division,competition,teams,mutate}:{division:Division;competition:Competition;teams:Team[];mutate:Mutate}){
  const [editing,setEditing]=useState(false),[search,setSearch]=useState(''),[selected,setSelected]=useState<string[]>([]);
  const available=teams.filter(t=>!division.teamEntries.some(e=>e.teamId===t.id));
  const visible=available.filter(t=>(t.name+' '+(t.city||'')).toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru')));
  async function rename(e:FormEvent<HTMLFormElement>){e.preventDefault();const name=new FormData(e.currentTarget).get('name');if(await mutate('/api/admin/competitions/divisions','PATCH',{competitionId:competition.id,id:division.id,name,previousName:division.name},'Название дивизиона сохранено только в этом соревновании.'))setEditing(false)}
  return <section className={styles.card} aria-label={`Дивизион ${division.name}`}>
    <div className={styles.actions}><h2>{division.name}</h2><button onClick={()=>setEditing(v=>!v)}>{editing?'Отменить переименование':'Изменить название'}</button></div>
    {editing&&<form onSubmit={rename}><label>Название дивизиона<input name="name" required minLength={2} maxLength={100} defaultValue={division.name}/></label><p>Изменится только название здесь. Заявки, матчи и прошлые сезоны сохранятся.</p><button type="submit">Сохранить название</button></form>}
    <p>Команд: {division.teamEntries.length} · Матчей: {division._count.matches}</p>
    {division.teamEntries.length?<ul className={styles.entries}>{division.teamEntries.map(e=><li key={e.id}><span>{e.team.name}</span><a href={`/admin/team-roster?entry=${e.id}`}>Открыть заявку →</a></li>)}</ul>:<p>Команд пока нет.</p>}
    <h3>Добавить команды в «{division.name}»</h3><label>Поиск команды<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Название или город"/></label>
    <div className={`${styles.choices} ${styles.teamChoices}`}>{visible.map(t=><label key={t.id}><input type="checkbox" checked={selected.includes(t.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,t.id]:v.filter(id=>id!==t.id))}/><span>{t.name}{t.city?` · ${t.city}`:''}</span></label>)}{!visible.length&&<p>Доступных команд по запросу нет.</p>}</div>
    <button disabled={!selected.length} onClick={async()=>{if(await mutate('/api/admin/competitions/manage','POST',{action:'teams',competitionId:competition.id,divisionId:division.id,teamIds:selected},'Команды добавлены. Составы из других сезонов не копировались.'))setSelected([])}}>Добавить команды ({selected.length})</button>
  </section>
}
