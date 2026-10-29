"use client";

import { ReactNode, useRef } from "react";

export function MatchStatScroller({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);

  const move = (direction: -1 | 1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollBy({
      left: direction * Math.max(220, viewport.clientWidth * 0.72),
      behavior: "smooth",
    });
  };

  return (
    <div className="matchStatMobileShell">
      <div className="matchStatMobileControls" aria-label="Прокрутка полной таблицы">
        <button type="button" onClick={() => move(-1)} aria-label="Показать предыдущие столбцы">←</button>
        <span>Свайпните таблицу, чтобы увидеть все показатели</span>
        <button type="button" onClick={() => move(1)} aria-label="Показать следующие столбцы">→</button>
      </div>
      <div className="matchStatViewport" ref={viewportRef}>{children}</div>
    </div>
  );
}
