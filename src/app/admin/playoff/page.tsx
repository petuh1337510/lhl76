'use client';
import {Suspense,useEffect,useState,FormEvent} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {PlayoffBracket} from '@/components/playoff-bracket';
import type {PlayoffView} from '@/lib/playoff-service';
import styles from '../competitions/page.module.css';
type ExistingMatch={id:string;homeTeamEntryId:string;awayTeamEntryId:string;homeScore:number;awayScore:number;startsAt:string|null;resultType:string;homeTeamEntry:{team:{name:string}};awayTeamEntry:{team:{name:string}}};
type Data={context:{seasonId:string;competitionId:string;divisionId:string;season:string;competition:string;division:string};teams:{id:string;name:string}[];playoffs:PlayoffView[];availableMatches:ExistingMatch[]};
export default function Page(){return <Suspense fallback={<p>Загрузка плей-офф…</p>}><Editor/></Suspense>}
function Editor(){
  const params=useSearchParams();const context={seasonId:params.get('seasonId')||'',competitionId:params.get('competitionId')||'',divisionId:params.get('divisionId')||''};
  const key=new URLSearchParams(context).toString();
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{if(!context.divisionId||!context.competitionId||!context.seasonId){setLoading(false);return}const controller=new AbortController();setLoading(true);fetch('/api/admin/playoff?'+key,{cache:'no-store',signal:controller.signal}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.error);setData(body)}).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[key,context.divisionId,context.competitionId,context.seasonId,revision]);
  async function action(body:Record<string,unknown>){if(busy||loading)return;setBusy(true);setError('');setMessage('');try{const r=await fetch('/api/admin/playoff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...context,...body})});const result=await r.json();if(!r.ok)throw Error(result.error||'Не удалось сохранить');setMessage(result.slug?'Матч создан. Откройте его протокол в серии; дату и арену можно назначить в календаре.':'Изменения сохранены.');setRevision(v=>v+1)}catch(e){setError(e instanceof Error?e.message:'Ошибка')}finally{setBusy(false)}}
  const current=data&&new URLSearchParams({seasonId:data.context.seasonId,competitionId:data.context.competitionId,divisionId:data.context.divisionId}).toString()===key?data:null;
  return <main className="adminShell"><section className={`adminContent divisionPage ${styles.page}`}>
    <Link href={'/admin/competitions?'+new URLSearchParams({seasonId:context.seasonId,competitionId:context.competitionId})}>← К соревнованию</Link><h1>Плей-офф</h1>
    {current&&<p>{current.context.season} · {current.context.competition} · {current.context.division}</p>}
    {!context.divisionId&&<p>Откройте плей-офф из блока дивизиона в соревновании.</p>}
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}<button disabled={busy||loading} onClick={()=>{setError('');setRevision(v=>v+1)}}>Обновить</button>{loading&&<p role="status">Загрузка…</p>}
    {current&&<fieldset className={styles.workspace} disabled={busy||loading}>
      <p>Результаты плей-офф не меняют таблицу регулярного этапа. Голы, передачи и другая статистика игроков входят в общую статистику дивизиона.</p>
      {!current.playoffs.length?<Setup key={key} data={current} action={action}/>:current.playoffs.map(p=><section key={p.id}>
        <div className={styles.actions}><strong>{p.published?'Опубликовано под таблицей дивизиона':'Черновик — посетителям не виден'}</strong><button onClick={()=>{if(window.confirm(p.published?'Скрыть сетку с публичной страницы? Матчи и результаты сохранятся.':'Опубликовать сетку под таблицей выбранного дивизиона?'))action({action:'publish',id:p.id,revision:p.revision,published:!p.published})}}>{p.published?'Скрыть сетку':'Опубликовать сетку'}</button></div>
        {!p.published&&!p.rounds.some(r=>r.series.some(s=>s.matches.length))&&<details><summary>Участники и число побед</summary><Setup key={p.id+':'+p.revision} data={current} playoff={p} action={action}/></details>}
        <p>Матчи можно добавлять и в черновик. Созданные матчи доступны в календаре; публикация управляет только видимостью сетки. После создания матчей участники и формат защищены от изменения.</p>
        <PlayoffBracket playoff={p} admin busy={busy||loading} onTarget={(seriesId,target)=>{if(window.confirm(`Изменить формат этой серии: до ${target} побед? Результат серии и участники следующего раунда будут проверены и пересчитаны.`))void action({action:'target',id:p.id,revision:p.revision,seriesId,target})}} onMatch={seriesId=>action({action:'match',id:p.id,revision:p.revision,seriesId})} attachment={s=>s.home&&s.away&&!s.winner&&!s.conflict&&!s.matches.some(m=>!['FINAL','CANCELLED'].includes(m.status))?<AttachMatches key={s.id+':'+p.revision} matches={(current.availableMatches||[]).filter(m=>(m.homeTeamEntryId===s.home!.id&&m.awayTeamEntryId===s.away!.id)||(m.homeTeamEntryId===s.away!.id&&m.awayTeamEntryId===s.home!.id))} busy={busy||loading} submit={matchIds=>action({action:'attach',id:p.id,revision:p.revision,seriesId:s.id,matchIds})}/>:null}/>
      </section>)}
    </fieldset>}
  </section></main>
}
function AttachMatches({matches,busy,submit}:{matches:ExistingMatch[];busy:boolean;submit:(ids:string[])=>Promise<void>}){
  const [selected,setSelected]=useState<string[]>([]);
  return <details style={{marginTop:12}}><summary>Привязать существующие матчи</summary>
    <p>Только завершённые матчи плей-офф этих команд. Выберите все игры серии по хронологии. Протоколы и статистика сохранятся.</p>
    {!matches.length?<p>Подходящих непривязанных матчей нет.</p>:<>
      {matches.map(m=><label key={m.id} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:12}}><input type="checkbox" disabled={busy} checked={selected.includes(m.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,m.id]:ids.filter(id=>id!==m.id))}/><span>{m.startsAt?new Date(m.startsAt).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'}):'Дата не указана'} · {m.homeTeamEntry.team.name} — {m.awayTeamEntry.team.name} · {m.resultType==='TECHNICAL'?'Технический результат':`${m.homeScore}:${m.awayScore}`}</span></label>)}
      <button disabled={busy||!selected.length} onClick={()=>{if(window.confirm(`Привязать выбранные матчи (${selected.length}) к этой серии? Победитель и следующий раунд будут пересчитаны.`))void submit(selected)}}>Привязать выбранные ({selected.length})</button>
    </>}
  </details>
}
function Setup({data,playoff,action}:{data:Data;playoff?:PlayoffView;action:(body:Record<string,unknown>)=>Promise<void>}){
  const main=playoff?.rounds.filter(r=>r.series.every(s=>s.sourceOutcome==='WINNER'));
  const [size,setSize]=useState(main?.[0]?.series.length?main[0].series.length*2:4);
  const [slots,setSlots]=useState<(string|null)[]>(main?.[0]?.series.flatMap(s=>[s.home?.id||null,s.away?.id||null])||Array(4).fill(null));
  const [targets,setTargets]=useState(main?.map(r=>r.series[0].target)||[2,2]);
  const [bronze,setBronze]=useState(!!playoff?.rounds.some(r=>r.series.some(s=>s.sourceOutcome==='LOSER')));
  const [bronzeTarget,setBronzeTarget]=useState(playoff?.rounds.find(r=>r.series.some(s=>s.sourceOutcome==='LOSER'))?.series[0].target||1);
  const [seedError,setSeedError]=useState(''),[seeding,setSeeding]=useState(false);
  async function seed(){setSeeding(true);setSeedError('');try{const r=await fetch('/api/admin/standings?'+new URLSearchParams({seasonId:data.context.seasonId,competitionId:data.context.competitionId,divisionId:data.context.divisionId}),{cache:'no-store'});const body=await r.json();if(!r.ok)throw Error(body.error);const order=size===8?[0,7,3,4,1,6,2,5]:size===4?[0,3,1,2]:[0,1];setSlots(order.map(i=>body.rows[i]?.id||null))}catch(e){setSeedError(e instanceof Error?e.message:'Не удалось получить таблицу')}finally{setSeeding(false)}}
  function submit(e:FormEvent){e.preventDefault();action({action:playoff?'configure':'create',...(playoff?{id:playoff.id,revision:playoff.revision}:{bronze}),slots,targets,bronzeTarget})}
  return <form className={styles.card} onSubmit={submit}><h2>{playoff?'Настройки сетки':'Создать сетку плей-офф'}</h2>
    <label>Первый раунд<select disabled={!!playoff} value={size} onChange={e=>{const n=Number(e.target.value);setSize(n);setSlots(Array(n).fill(null));setTargets(Array(Math.log2(n)).fill(2));if(n===2)setBronze(false)}}><option value={8}>¼ финала — 8 мест</option><option value={4}>½ финала — 4 места</option><option value={2}>Финал — 2 места</option></select></label>
    <p>Каждые две команды образуют пару. Пустое место означает проход соперника без игры. Проверяйте посев перед публикацией.</p><button type="button" disabled={seeding} onClick={seed}>{seeding?'Загружаю…':'Предложить пары по текущей таблице'}</button>{seedError&&<p role="alert">{seedError}</p>}
    <div className={styles.grid}>{Array.from({length:size/2},(_,pair)=><section className={styles.card} key={pair}><h3>Пара {pair+1}</h3>{[0,1].map(side=>{const index=pair*2+side;return <label key={index}>{side===0?'Команда A':'Команда B'}<select aria-label={`Пара ${pair+1}, команда ${side===0?'A':'B'}`} value={slots[index]||''} onChange={e=>setSlots(v=>v.map((x,i)=>i===index?e.target.value||null:x))}><option value="">Без соперника</option>{data.teams.map(t=><option key={t.id} value={t.id} disabled={slots.includes(t.id)&&slots[index]!==t.id}>{t.name}</option>)}</select></label>})}</section>)}</div>
    {targets.map((target,i)=><label key={i}>{size/2**(i+1)===4?'¼ финала':size/2**(i+1)===2?'½ финала':'Финал'} — до скольки побед<select value={target} onChange={e=>setTargets(v=>v.map((n,j)=>i===j?Number(e.target.value):n))}>{[1,2,3,4].map(n=><option key={n} value={n}>{n}</option>)}</select></label>)}
    {size>2&&<><label><select aria-label="Третье место" disabled={!!playoff} value={bronze?'yes':'no'} onChange={e=>setBronze(e.target.value==='yes')}><option value="no">Без серии за третье место</option><option value="yes">Серия за третье место</option></select></label>{bronze&&<label>За третье место — до скольки побед<select value={bronzeTarget} onChange={e=>setBronzeTarget(Number(e.target.value))}>{[1,2,3,4].map(n=><option value={n} key={n}>{n}</option>)}</select></label>}</>}
    <div className={styles.actions}><button type="submit" disabled={seeding}>{playoff?'Сохранить параметры':'Создать черновик сетки'}</button></div>
  </form>
}
