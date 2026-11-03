"use client";

import { useEffect, useRef, type ReactNode } from "react";

type AdminModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
};

export function AdminModal({ title, onClose, children, wide = false }: AdminModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFirst = () => {
      const focusTarget = Array.from(panel.current?.querySelectorAll<HTMLElement>("input:not([type=hidden]), select, textarea, button:not(.adminModalClose)") || [])
        .find((element) => element.getClientRects().length > 0 && !element.hasAttribute("disabled"));
      (focusTarget || panel.current)?.focus();
    };
    const frame = requestAnimationFrame(focusFirst);
    const onFocusIn = (event: FocusEvent) => {
      if (panel.current && !panel.current.contains(event.target as Node)) focusFirst();
    };
    document.addEventListener("focusin", onFocusIn);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab" || !panel.current) return;
      const targets = Array.from(panel.current.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"))
        .filter((element) => element.getClientRects().length > 0);
      if (!targets.length) return;
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);

  return (
    <div className="adminModalBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close.current(); }}>
      <div ref={panel} className={`adminModalPanel${wide ? " adminModalPanelWide" : ""}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <button className="adminModalClose" type="button" onClick={() => onClose()} aria-label="Закрыть окно">×</button>
        {children}
      </div>
    </div>
  );
}
