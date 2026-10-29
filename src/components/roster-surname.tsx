"use client";
import { useEffect, useRef } from "react";

/** Keep the full surname readable within its existing roster column. */
export function RosterSurname({ children }: { children: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let active = true;
    const fit = () => {
      if (!active) return;
      element.style.fontSize = "";
      element.style.whiteSpace = "nowrap";
      const maximum = parseFloat(getComputedStyle(element).fontSize);
      const available = element.clientWidth;
      if (!available) return;
      let size = maximum;
      while (element.scrollWidth > available && size > 16) {
        size -= 0.5;
        element.style.fontSize = `${size}px`;
      }
      if (element.scrollWidth > available) element.style.whiteSpace = "normal";
    };
    const observer = new ResizeObserver(fit);
    observer.observe(element.parentElement!);
    void document.fonts.ready.then(fit);
    fit();
    return () => { active = false; observer.disconnect(); };
  }, [children]);
  return <span ref={ref} style={{ maxWidth: "100%", lineHeight: 1.15 }}>{children}</span>;
}
