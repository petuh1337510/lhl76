"use client";

import { useEffect, useId, useState, type ComponentPropsWithoutRef } from "react";

export function useFormSuggestions(scope: "player" | "city", enabled = true) {
  const [values, setValues] = useState<Record<string, string[]>>({});
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch(`/api/admin/form-suggestions?scope=${scope}`, { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : {})
      .then(data => { if (!controller.signal.aborted) setValues(data); })
      .catch(() => {});
    return () => controller.abort();
  }, [scope, enabled]);
  return values;
}

export function SuggestedInput({ suggestions, ...input }: ComponentPropsWithoutRef<"input"> & { suggestions?: string[] }) {
  const id = useId();
  return <>
    <input {...input} list={suggestions?.length ? id : undefined} />
    {suggestions?.length ? <datalist id={id}>{suggestions.map(value => <option value={value} key={value} />)}</datalist> : null}
  </>;
}
