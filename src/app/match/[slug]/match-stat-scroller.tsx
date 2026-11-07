"use client";

import { ReactNode, useRef } from "react";

export function MatchStatScroller({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ x: number; y: number; scrollLeft: number } | null>(null);

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
      <div className="matchStatViewport" ref={viewportRef}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (touch && viewportRef.current) touchRef.current = { x: touch.clientX, y: touch.clientY, scrollLeft: viewportRef.current.scrollLeft };
        }}
        onTouchMove={(event) => {
          const start = touchRef.current;
          const touch = event.touches[0];
          if (!start || !touch || !viewportRef.current) return;
          const dx = touch.clientX - start.x;
          if (Math.abs(dx) > Math.abs(touch.clientY - start.y)) viewportRef.current.scrollLeft = start.scrollLeft - dx;
        }}
        onTouchEnd={() => { touchRef.current = null; }}
        onTouchCancel={() => { touchRef.current = null; }}
      >{children}</div>
    </div>
  );
}
