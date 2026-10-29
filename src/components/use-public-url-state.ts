"use client";
import { usePathname, useSearchParams } from "next/navigation";
import type { SetStateAction, KeyboardEvent } from "react";
import { choice, pageNumber } from "@/lib/public-navigation";

let pending: { path: string; query: URLSearchParams } | null = null;
function update(key: string, value: (current: string | null) => string) {
  if (!pending || pending.path !== window.location.pathname) {
    pending = { path: window.location.pathname, query: new URLSearchParams(window.location.search) };
    queueMicrotask(() => {
      const next = pending;
      pending = null;
      if (!next || next.path !== window.location.pathname) return;
      const url = `${next.path}?${next.query.toString()}${window.location.hash}`;
      if (url !== window.location.pathname + window.location.search + window.location.hash) window.history.pushState(null, "", url);
    });
  }
  pending.query.set(key, value(pending.query.get(key)));
}
export function usePublicChoice<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const params = useSearchParams();
  const value = choice(params.get(key), fallback, allowed);
  const setValue = (next: SetStateAction<T>) => update(key, current => typeof next === "function" ? next(choice(current, fallback, allowed)) : next);
  return [value, setValue] as const;
}
export function usePublicPage(key: string, maximum: number) {
  const params = useSearchParams();
  const value = pageNumber(params.get(key), maximum);
  const setValue = (next: SetStateAction<number>) => update(key, current => String(pageNumber(String(typeof next === "function" ? next(pageNumber(current, maximum)) : next), maximum)));
  return [value, setValue] as const;
}
export function usePublicLocation() {
  const path = usePathname();
  const params = useSearchParams();
  return path + (params.size ? `?${params.toString()}` : "");
}

export function handleTabKeys(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="tab"]'));
  const current = tabs.indexOf(event.target as HTMLButtonElement);
  if (current < 0 || !tabs.length) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
}
