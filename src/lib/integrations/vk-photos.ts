import { unstable_cache } from "next/cache";

const API_VERSION = "5.199";
const VK_ALBUM_SLUG = /^vk-photo-(\d+)-(\d+)$/;

type VkApiResult<T> = { response?: T; error?: { error_code: number; error_msg: string } };
type VkPhotoSize = { url: string; width: number; height: number };
type VkPhoto = { sizes?: VkPhotoSize[] };
type VkAlbum = {
  id: number;
  title: string;
  description?: string;
  created?: number;
  updated?: number;
  size?: number;
  thumb_src?: string;
};

export type VkPhotoAlbum = {
  title: string;
  description: string | null;
  photos: string[];
  coverUrl: string | null;
  eventDate: Date | null;
};

export function parseVkAlbumUrl(value: string) {
  let url: URL;
  try { url = new URL(value.trim()); } catch { return null; }
  if (!["vk.com", "www.vk.com", "m.vk.com", "vk.ru", "www.vk.ru", "m.vk.ru"].includes(url.hostname)) return null;
  const match = url.pathname.match(/^\/album(-?\d+)_(\d+)\/?$/);
  if (!match) return null;
  return { ownerId: Number(match[1]), albumId: Number(match[2]) };
}

export function vkAlbumSlug(ownerId: number, albumId: number) {
  return `vk-photo-${Math.abs(ownerId)}-${albumId}`;
}

export function parseVkAlbumSlug(slug: string) {
  const match = slug.match(VK_ALBUM_SLUG);
  return match ? { ownerId: -Number(match[1]), albumId: Number(match[2]) } : null;
}

async function vkMethod<T>(method: string, params: Record<string, string>, token: string): Promise<T> {
  const url = new URL(`https://api.vk.com/method/${method}`);
  const body = new URLSearchParams({ ...params, v: API_VERSION, access_token: token });
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`VK API: HTTP ${response.status}`);
  const result = (await response.json()) as VkApiResult<T>;
  if (result.error) throw new Error(`VK API: ошибка ${result.error.error_code}`);
  if (!result.response) throw new Error("VK API вернул пустой ответ");
  return result.response;
}

export async function loadVkPhotoAlbum(ownerId: number, albumId: number): Promise<VkPhotoAlbum> {
  const token = process.env.VK_API_ACCESS_TOKEN;
  if (!token) throw new Error("Для синхронизации фото нужен серверный токен VK_API_ACCESS_TOKEN");
  if (!Number.isSafeInteger(ownerId) || !Number.isSafeInteger(albumId) || albumId <= 0) {
    throw new Error("Некорректная ссылка на альбом VK");
  }
  const owner_id = String(ownerId);
  const album_id = String(albumId);
  const albums = await vkMethod<{ items: VkAlbum[] }>("photos.getAlbums", {
    owner_id, album_ids: album_id, need_covers: "1", photo_sizes: "1",
  }, token);
  const album = albums.items.find((item) => item.id === albumId);
  if (!album) throw new Error("Альбом VK не найден или недоступен");

  const photos: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await vkMethod<{ count: number; items: VkPhoto[] }>("photos.get", {
      owner_id, album_id, photo_sizes: "1", count: "1000", offset: String(offset),
    }, token);
    for (const photo of page.items) {
      const size = photo.sizes?.filter((item) => item.url && item.width >= 640)
        .sort((a, b) => b.width * b.height - a.width * a.height)[0]
        ?? photo.sizes?.filter((item) => item.url).sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (size) photos.push(size.url);
    }
    if (offset + page.items.length >= page.count || page.items.length === 0) break;
  }
  return {
    title: album.title,
    description: album.description?.trim() || null,
    photos,
    coverUrl: album.thumb_src || photos[0] || null,
    eventDate: album.created ? new Date(album.created * 1000) : null,
  };
}

export const getCachedVkPhotoAlbum = unstable_cache(
  loadVkPhotoAlbum,
  ["vk-photo-album"],
  { revalidate: 3600 },
);
