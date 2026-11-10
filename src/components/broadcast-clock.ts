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
