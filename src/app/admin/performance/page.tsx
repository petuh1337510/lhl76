"use client";
import { useEffect, useState } from "react";
import type { TelemetryRecord } from "@/lib/telemetry-store";
type Data = {metrics: {route: string; metric: string; count: number; p75: number}[]; traces: TelemetryRecord[]; slowMs: number};
export default function PerformancePage() {
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState("");
  const load = () => {setError(""); return fetch("/api/admin/performance", {cache: "no-store"}).then(async response => {if (!response.ok) throw Error(); setData(await response.json());}).catch(() => setError("Не удалось загрузить метрики"));};
  useEffect(() => {void load();}, []);
  return <section className="adminContent divisionPage"><h1>Скорость сайта</h1><p>Измерения за последние 24 часа в пределах доступного журнала. Адреса обезличены; сообщения ошибок, личные данные и секреты не сохраняются.</p><button onClick={() => void load()}>Обновить</button>{error && <p role="alert">{error}</p>}{!data && !error && <p role="status">Загрузка…</p>}{data && <>
    <h2>Реальные посетители</h2><p>LCP: хорошо до 2500 мс; INP: до 200 мс; CLS: до 0,1. p75 — значение, в которое укладываются 75% полученных измерений. ERROR — число сообщений об ошибках.</p>
    <table><thead><tr><th>Страница</th><th>Метрика</th><th>Измерений</th><th>p75</th></tr></thead><tbody>{data.metrics.map(row => <tr key={`${row.route}:${row.metric}`}><td>{row.route}</td><td>{row.metric}</td><td>{row.count}</td><td>{row.metric === "ERROR" ? "—" : `${row.p75}${row.metric === "CLS" ? "" : " мс"}`}</td></tr>)}</tbody></table>{!data.metrics.length && <p>Измерения появятся после посещения страниц.</p>}
    <h2>Серверные трассы</h2><p>Операции дольше {data.slowMs} мс отмечены как медленные. Одинаковый Trace связывает запрос, обращения к базе и внешним API.</p>
    <table><thead><tr><th>Время</th><th>Операция</th><th>Страница</th><th>Длительность</th><th>Trace / Span / Parent</th></tr></thead><tbody>{data.traces.slice().reverse().map((row, i) => <tr key={`${row.spanId}:${i}`}><td>{new Date(row.at).toLocaleTimeString("ru", {timeZone: "Europe/Moscow"})}</td><td>{row.name}{row.failed ? " · ошибка" : ""}</td><td>{row.route}</td><td>{(row.duration ?? 0) >= data.slowMs ? "Медленно · " : ""}{row.duration} мс</td><td><small>{row.traceId?.slice(0, 12)} / {row.spanId?.slice(0, 8)} / {row.parentId?.slice(0, 8) ?? "—"}</small></td></tr>)}</tbody></table>
  </>}</section>;
}
