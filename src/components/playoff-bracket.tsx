'use client';
import Link from 'next/link';
import {useState} from 'react';
import type {ReactNode} from 'react';
import {PublicImage} from './public-image';
import type {PlayoffView} from '@/lib/playoff-service';
import styles from './playoff-bracket.module.css';
export function PlayoffBracket({playoff,admin=false,busy=false,onMatch,onTarget,attachment}:{playoff:PlayoffView;admin?:boolean;busy?:boolean;onMatch?:(id:string)=>void;onTarget?:(id:string,target:number)=>void;attachment?:(series:PlayoffView['rounds'][number]['series'][number])=>ReactNode}){
  const [opened,setOpened]=useState<string|null>(null);
  const groups=playoff.rounds.filter(r=>r.series.every(s=>s.sourceOutcome!=='LOSER')).map(r=>[r]);
  const bronze=playoff.rounds.filter(r=>r.series.some(s=>s.sourceOutcome==='LOSER'));
  if(groups.length)groups[groups.length-1].push(...bronze);
  return <section className={styles.board} aria-label="Сетка плей-офф"><header><h2>ПЛЕЙ-ОФФ ДИВИЗИОНА «{playoff.divisionName}»</h2></header>
    <div className={styles.rounds}>{groups.map(group=><div key={group[0].id} className={styles.round}>{group.map(round=><section key={round.id}><h3>{round.name}</h3>{round.series.map(s=><article className={styles.series} key={s.id} onMouseLeave={()=>setOpened(v=>v===s.id?null:v)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpened(v=>v===s.id?null:v)}} onKeyDown={e=>{if(e.key==='Escape'){setOpened(null);e.stopPropagation()}}}>
      <div className={styles.meta}><span>Пара {s.number} · {s.conflict?'Требует проверки':s.bye?'Проход без игры':s.winner?'Серия завершена':s.home&&s.away?'Серия':'Ожидание участников'}</span><span>До {s.target} {s.target===1?'победы':'побед'}</span></div>
      {[{team:s.home,wins:s.homeWins},{team:s.away,wins:s.awayWins}].map(({team,wins},i)=><div className={`${styles.team} ${team?.id===s.winner?styles.winner:''}`} key={i}>
        {team?.logo&&<span className={styles.logo}><PublicImage src={team.logo} alt="" sizes="36px"/></span>}<span>{team?.name||(i===0?s.homePlaceholder:s.awayPlaceholder)}</span>{s.matches.length?<button className={styles.score} aria-label={`Результаты матчей серии ${s.home?.name} — ${s.away?.name}`} aria-expanded={opened===s.id} onMouseEnter={()=>setOpened(s.id)} onClick={()=>setOpened(v=>v===s.id?null:s.id)}><b>{wins}</b></button>:<b>{wins}</b>}
      </div>)}
      {admin&&s.conflict&&<p role="alert">{s.conflict}</p>}
      {s.matches.length>0&&opened===s.id&&<div className={styles.results}><strong>Матчи серии</strong><ul className={styles.matches}>{s.matches.map(m=><li key={m.id}><Link href={admin?`/admin/match-protocol?slug=${m.slug}`:`/match/${m.slug}`}>Матч {m.number}{m.status==='FINAL'?(m.resultType==='TECHNICAL'?' · технический результат':` · ${m.homeScore}:${m.awayScore}`):m.status==='CANCELLED'?' · отменён':m.startsAt?` · ${new Date(m.startsAt).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'})}`:' · дата уточняется'}{m.status==='FINAL'&&<span style={{display:'block'}}>Победитель: {m.winnerName||'не определён'}</span>}</Link></li>)}</ul><button onClick={()=>setOpened(null)}>Закрыть</button></div>}
      {admin&&onTarget&&<label className={styles.format}>Побед для победы в серии <select aria-label={`Число побед: ${round.name}, пара ${s.number}`} disabled={busy} value={s.target} onChange={e=>onTarget(s.id,Number(e.target.value))}>{[1,2,3,4].map(n=><option value={n} key={n}>{n}</option>)}</select></label>}
      {admin&&onMatch&&<button disabled={busy||!!s.winner||!!s.conflict||!s.home||!s.away||s.matches.some(m=>!['FINAL','CANCELLED'].includes(m.status))} onClick={()=>onMatch(s.id)}>Добавить матч серии</button>}
      {admin&&attachment&&attachment(s)}
    </article>)}</section>)}</div>)}</div>
  </section>
}
