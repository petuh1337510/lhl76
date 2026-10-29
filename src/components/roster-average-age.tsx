"use client";
import { useEffect, useState } from "react";
import { averageAge } from "@/lib/average-age";

export function RosterAverageAge({ players }: { players: { birthDate: string }[] }) {
  const [today, setToday] = useState("");
  useEffect(() => {
    const update = () => setToday(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const age = today ? averageAge(players.map(player => player.birthDate), today) : null;
  return <p style={{ margin: "0 0 20px", color: "#58708a", fontSize: 14, lineHeight: 1.5 }} title="По полным годам игроков заявки на текущую дату. Игроки без даты рождения не учитываются.">
    Средний возраст игроков команды: <span style={{ color: "#071d3f", fontWeight: 400, fontVariantNumeric: "tabular-nums" }}>{!today ? "…" : age === null ? "нет данных" : age.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
  </p>;
}
