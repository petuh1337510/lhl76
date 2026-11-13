import "server-only";
import { unstable_cache } from "next/cache";
import { vkNewsVideo } from "./news-video";

export type VkNewsPreview = { embedUrl: string; thumbnail: string | null };
export function parseVkNewsPreview(data: unknown, source: string): VkNewsPreview | null {
  const video = vkNewsVideo(source);
  if (!video || !data || typeof data !== "object") return null;
  const response = (data as { response?: { html?: string; thumbnail_url?: string } }).response;
  if (typeof response?.html !== "string") return null;
  const src = response.html.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, "&");
  try {
    const embed = new URL(src || "");
    if (embed.protocol !== "https:" || !["vk.com", "vkvideo.ru"].includes(embed.hostname) || embed.username || embed.password || embed.port || embed.pathname !== "/video_ext.php" || embed.searchParams.get("oid") !== video.owner || embed.searchParams.get("id") !== video.id) return null;
    embed.searchParams.set("autoplay", "0");
    let thumbnail: string | null = null;
    if (typeof response.thumbnail_url === "string") {
      const image = new URL(response.thumbnail_url);
      if (image.protocol === "https:" && !image.username && !image.password && !image.port && /\.(userapi\.com|vkuserphoto\.ru)$/.test(image.hostname)) thumbnail = image.href;
    }
    return { embedUrl: embed.href, thumbnail };
  } catch { return null; }
}

const fetchPreview = unstable_cache(async (canonical: string) => {
  const endpoint = new URL("https://api.vk.com/method/video.getOembed");
  endpoint.search = new URLSearchParams({ url: canonical, maxwidth: "1080", maxheight: "1920", v: "5.199" }).toString();
  const result = await fetch(endpoint, { signal: AbortSignal.timeout(5000), redirect: "error", cache: "no-store" });
  if (!result.ok) throw new Error("VK preview unavailable");
  const preview = parseVkNewsPreview(await result.json(), canonical);
  if (!preview) throw new Error("VK embed unavailable");
  return preview;
}, ["vk-news-preview-v1"], { revalidate: 300 });

export async function getVkNewsPreview(source: string) {
  const video = vkNewsVideo(source);
  if (!video) return null;
  try { return await fetchPreview(video.canonical); } catch { return null; }
}
