"use client";

import { useEffect, useId, useRef, useState } from "react";
import { filterPenaltyReasons, resolvePenaltyReason } from "@/lib/penalty-reasons";
import styles from "./penalty-reason-input.module.css";

export function PenaltyReasonInput({ value, onChange }: {
  value: string; onChange: (code: string, reason: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const list = useRef<HTMLDivElement>(null);
  const options = filterPenaltyReasons(value);
  const select = (code: string, reason: string) => {
    onChange(code, reason);
    setOpen(false);
    setActive(-1);
  };
  useEffect(() => {
    if (open && active >= 0) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  return <div className={styles.field}>
    <label htmlFor={id}>Причина</label>
    <input id={id} role="combobox" autoComplete="off" value={value}
      aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`}
      aria-describedby={`${id}-hint`} aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
      placeholder="Начните вводить причину или код"
      onFocus={() => { setOpen(true); setActive(-1); }}
      onClick={() => setOpen(true)} onBlur={() => {
        setOpen(false);
        const result = resolvePenaltyReason(value);
        onChange(result.code, result.reason);
      }}
      onChange={event => {
        const text = event.target.value;
        onChange(resolvePenaltyReason(text).code, text);
        setOpen(true); setActive(-1);
      }}
      onKeyDown={event => {
        if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          if (options.length) setActive(index => event.key === "ArrowDown" ? Math.min(index + 1, options.length - 1) : index < 0 ? options.length - 1 : Math.max(index - 1, 0));
        }
        if (event.key === "Enter" && open) {
          event.preventDefault();
          if (active >= 0 && options[active]) select(options[active][0], options[active][1]);
          else { const result = resolvePenaltyReason(value); select(result.code, result.reason); }
        }
      }} />
    <div className={styles.suggestions}>
    {open && <div className={styles.dropdown}>
      <div ref={list} id={`${id}-list`} role="listbox" aria-label="Причины удаления" className={styles.list}>
        {options.map(([code, label], index) => <div key={code} id={`${id}-option-${index}`} role="option"
          aria-selected={index === active} className={styles.option}
          onMouseDown={event => event.preventDefault()} onClick={() => select(code, label)}>
          <span>{label}</span><small>{code}</small>
        </div>)}
      </div>
      {!options.length && <p className={styles.empty} role="status">Совпадений нет — будет использована введённая причина.</p>}
    </div>}
    </div>
    <small id={`${id}-hint`} className={styles.hint}>Выберите вариант из списка или введите свою причину.</small>
  </div>;
}
