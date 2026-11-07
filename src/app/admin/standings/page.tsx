'use client';
import Link from 'next/link';
import {Suspense,useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import styles from './page.module.css';
type Result={competition:{id:string;name:string;season:{id:string;name:string};divisions:{id:string;name:string}[]};division:{id:string;name:string}|null;rows:{id:string;rank:number;team:string;games:number;wins:number;draws:number;losses:number;goalsFor:number;goalsAgainst:number;points:number}[]};
export default function Page(){return <Suspense fallback={<p>Загрузка таблиц…</p>}><Tables/></Suspense>}
function Tables(){
  const params=useSearchParams(),router=useRouter();
  const seasonId=params.get('seasonId'),competitionId=params.get('competitionId'),divisionId=params.get('divisionId');
  const [data,setData]=useState<Result|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
  const query=new URLSearchParams();if(seasonId)query.set('seasonId',seasonId);if(competitionId)query.set('competitionId',competitionId);if(divisionId)query.set('divisionId',divisionId);
  const key=query.toString(),back='/admin/competitions?'+new URLSearchParams({...seasonId?{seasonId}:{},...competitionId?{competitionId}:{}});
  useEffect(()=>{
    if(!seasonId||!competitionId){setLoading(false);return}
    const controller=new AbortController();setLoading(true);setError('');
    fetch('/api/admin/standings?'+key,{cache:'no-store',signal:controller.signal}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.error||'Не удалось загрузить таблицу');setData(body)}).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[key,seasonId,competitionId,retry]);
  const current=data&&data.competition.id===competitionId&&data.competition.season.id===seasonId&&(!divisionId||data.division?.id===divisionId)?data:null;
  if(!seasonId||!competitionId)return <section className="adminContent divisionPage"><h1>Турнирные таблицы</h1><p>Откройте нужное соревнование в его сезоне, затем нажмите «Турнирные таблицы».</p><Link href="/admin/competitions">Выбрать соревнование →</Link></section>;
  return <main className="adminShell adminStandings"><section className={`adminContent divisionPage ${styles.page}`}>
    <Link className="backButton" href={back}>← К выбранному соревнованию</Link>
    <div className="competitionHead"><div>{current&&<span>СЕЗОН {current.competition.season.name} · {current.competition.name}</span>}<h1>Турнирные таблицы</h1><p>Автоматический расчёт по завершённым матчам этапов, учитываемых в таблице.</p></div></div>
    <details className={styles.rules}><summary>Правила расчёта таблиц</summary><p>Победа — 2 очка, ничья — 1, поражение — 0.</p><p>При равенстве очков: очки в личных встречах → разница шайб во всех матчах → разница шайб в личных встречах → забитые шайбы → победы → меньше штрафных минут.</p><p>Технический результат учитывается по указанному победителю, без добавления шайб. Матчи этапов, не учитываемых в таблице, не включаются.</p><p>Чтобы исправить результат, измените матч или его протокол.</p></details>
    {error&&<p role="alert">{error} <button onClick={()=>setRetry(v=>v+1)}>Повторить</button></p>}{loading&&<p role="status">Загрузка таблицы…</p>}
    {current&&<><div className="matchAdminFilters" aria-label="Дивизион">{current.competition.divisions.map(d=><button key={d.id} className={d.id===current.division?.id?'active':''} aria-pressed={d.id===current.division?.id} onClick={()=>{const q=new URLSearchParams(key);q.set('divisionId',d.id);router.push('/admin/standings?'+q)}}>{d.name}</button>)}</div>
      {current.division&&<p><Link href={'/admin/playoff?'+new URLSearchParams({seasonId:seasonId!,competitionId:competitionId!,divisionId:current.division.id})}>Настроить плей-офф дивизиона «{current.division.name}» →</Link></p>}
      {!current.division?<p>В этом соревновании пока нет дивизионов. Добавьте их в настройках соревнования.</p>:<><h2>{current.division.name}</h2>{!current.rows.length?<p>В дивизион ещё не добавлены команды.</p>:<div className={styles.scroll} tabIndex={0} role="region" aria-label={`Таблица дивизиона ${current.division.name}`}><table><thead><tr>{['#','Команда','С','В','Н','П','Ш','РШ','О'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{current.rows.map(r=><tr key={r.id}><td>{r.rank}</td><th scope="row">{r.team}</th><td>{r.games}</td><td>{r.wins}</td><td>{r.draws}</td><td>{r.losses}</td><td>{r.goalsFor}:{r.goalsAgainst}</td><td>{r.goalsFor-r.goalsAgainst}</td><td><strong>{r.points}</strong></td></tr>)}</tbody></table></div>}</>}
    </>}
  </section></main>;
}
