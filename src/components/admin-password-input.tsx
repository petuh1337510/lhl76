"use client";

import { useEffect, useId, useState } from "react";
import styles from "./admin-password-input.module.css";

export default function AdminPasswordInput({ label, value, onChange, minLength }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minLength: number;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  useEffect(() => { if (!value) setVisible(false); }, [value]);

  return <label htmlFor={id}>{label}
    <span className={styles.field}>
      <input id={id} type={visible ? "text" : "password"} minLength={minLength}
        autoComplete="new-password" autoCapitalize="none" spellCheck={false}
        value={value} onChange={event => onChange(event.target.value)} />
      <button type="button" className={styles.toggle} aria-controls={id}
        aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
        title={visible ? "Скрыть пароль" : "Показать пароль"}
        aria-pressed={visible} onClick={() => setVisible(current => !current)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="m3 3 18 18" />}
        </svg>
      </button>
    </span>
  </label>;
}
