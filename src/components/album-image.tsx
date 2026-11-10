"use client";
import Image from "next/image";
import { useState } from "react";
import { localMediaUrl } from "@/lib/local-media";

/** VK files go straight to the visitor, bypassing both image proxies and disk caches. */
export function AlbumImage({ src, alt, direct = false, eager = false, retry = true }: { src: string; alt: string; direct?: boolean; eager?: boolean; retry?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = failedSource === src;
  const [attempt, setAttempt] = useState(0);
  if (failed) return <div role="status" className="albumImageError"><p>Фотография временно недоступна</p>{retry ? <button type="button" onClick={event => { event.preventDefault(); event.stopPropagation(); setAttempt(attempt + 1); setFailedSource(null); }}>Повторить</button> : null}</div>;
  return <Image key={`${src}-${attempt}`} src={direct ? src : localMediaUrl(src)} alt={alt} width={1600} height={1100} unoptimized loading={eager ? "eager" : "lazy"} referrerPolicy={direct ? "no-referrer" : undefined} onError={() => setFailedSource(src)} />;
}
