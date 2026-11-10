"use client";
import { useEffect, useState } from "react";
/** Boundary changes do not wait for the VK cache or a page reload. */
export function useBroadcastClock(serverTime?: number) {
  const [now, setNow] = useState(serverTime ?? 0);
  useEffect(() => {
    const anchor = performance.now();
    const origin = serverTime ?? Date.now();
    const tick = () => setNow(origin + performance.now() - anchor);
    tick();
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [serverTime]);
  return now;
}

/** The large homepage renders only at a status boundary, not every second. */
export function useBroadcastBoundaryClock(serverTime: number, items: Array<{ startsAt?: string | null; endsAt?: string | null }>) {
  const [now, setNow] = useState(serverTime);
  const boundaries = items.flatMap(item => [item.startsAt, item.endsAt]).filter(Boolean).join("|");
  useEffect(() => {
    const anchor = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      if (timer) clearTimeout(timer);
      const current = serverTime + performance.now() - anchor;
      setNow(current);
      const next = boundaries.split("|").map(value => Date.parse(value)).filter(value => value > current).sort((a, b) => a - b)[0];
      if (next) timer = setTimeout(tick, Math.min(next - current + 1, 2147483647));
    };
    tick();
    document.addEventListener("visibilitychange", tick);
    return () => { if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", tick); };
  }, [serverTime, boundaries]);
  return now;
}
