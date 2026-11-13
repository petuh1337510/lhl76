import { safeEditorialUrl } from "./editorial-url";

export function vkNewsVideo(value: unknown) {
  if (typeof value !== "string" || !safeEditorialUrl(value)) return null;
  try {
    const url = new URL(value);
    if (!["vk.ru", "www.vk.ru", "vk.com", "www.vk.com", "vkvideo.ru", "www.vkvideo.ru"].includes(url.hostname)) return null;
    const match = url.pathname.match(/^\/(clip|video)(-?\d+)_(\d+)\/?$/);
    return match ? { clip: match[1] === "clip", owner: match[2], id: match[3], canonical: `https://vk.com/video${match[2]}_${match[3]}` } : null;
  } catch { return null; }
}

export function newsVideoSource(value: unknown): { kind: "vk" | "embed" | "file"; url: string; clip: boolean } | null {
  if (typeof value !== "string" || !safeEditorialUrl(value)) return null;
  const vk = vkNewsVideo(value);
  if (vk) return { kind: "vk", url: value, clip: vk.clip };
  if (/^\/uploads\/.+\.(mp4|webm|mov)$/i.test(value)) return { kind: "file", url: value, clip: false };
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (["youtube.com", "youtu.be"].includes(host)) {
      const id = host === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return { kind: "embed", url: `https://www.youtube.com/embed/${id}`, clip: false };
    }
    if (host === "rutube.ru") {
      const id = url.pathname.match(/^\/video\/(?:private\/)?([a-f0-9]{32})\/?$/)?.[1];
      if (id) return { kind: "embed", url: `https://rutube.ru/play/embed/${id}`, clip: false };
    }
  } catch { /* Unsupported links are not media files. */ }
  return null;
}
