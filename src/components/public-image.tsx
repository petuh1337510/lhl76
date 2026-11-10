"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import {localMediaUrl} from '@/lib/local-media';

/** One source asset, responsive derivatives. Existing CSS retains control of layout. */
export function PublicImage({ src, alt, width = 640, height = 480, sizes = "(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 400px", direct = false, ...props }: ImageProps & { direct?: boolean }) {
  const [failedSource, setFailedSource] = useState<ImageProps["src"] | null>(null);
  const failed = failedSource === src;
  const safeSource = failed ? "/images/player-placeholder.svg" : typeof src==='string' && !direct ? localMediaUrl(src) : src;
  const allowed = typeof safeSource !== "string" || safeSource.startsWith("/") || /^https:\/\/(?:www\.)?lhl-76\.ru\//.test(safeSource) || /^https:\/\/[^/]+\.(?:userapi\.com|vkuserphoto\.ru)\//.test(safeSource);
  return <Image {...props} src={safeSource} alt={alt} width={width} height={height} sizes={sizes}
    unoptimized={direct || props.unoptimized || !allowed || failed}
    data-image-state={failed ? "error" : "source"}
    onError={(event) => { if (!failed) console.warn("Не удалось загрузить изображение", typeof src === "string" ? src : "static image"); setFailedSource(src); props.onError?.(event); }} />;
}
