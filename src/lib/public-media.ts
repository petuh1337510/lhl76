import { getCachedVkCommunityAlbums, getCachedVkPhotoAlbum, parseVkAlbumSlug } from "@/lib/integrations/vk-photos";
import { prisma } from "@/lib/prisma";
import type { MediaAlbum } from "@prisma/client";

const photosFromJson = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

async function resolveAlbum(album: MediaAlbum, catalogue: Awaited<ReturnType<typeof getCachedVkCommunityAlbums>> | null) {
  const ref = parseVkAlbumSlug(album.slug);
  const fallback = { ...album, photos: photosFromJson(album.photos), vkError: Boolean(ref), vkUrl: ref ? `https://vk.ru/album${ref.ownerId}_${ref.albumId}` : null };
  if (!ref) return { ...fallback, vkError: false };
  // Only a complete, successful catalogue may hide a missing album.
  if (catalogue && (ref.ownerId !== catalogue.ownerId || !catalogue.albums.some(item => item.id === ref.albumId))) return null;
  try {
    const vk = await getCachedVkPhotoAlbum(ref.ownerId, ref.albumId);
    if (vk === null) return null;
    // Empty arrays and cleared descriptions are authoritative updates too.
    return { ...fallback, ...vk, eventDate: vk.eventDate ? new Date(vk.eventDate) : null, vkError: false };
  } catch { return fallback; }
}

async function catalogueOrNull() {
  try { return await getCachedVkCommunityAlbums(); } catch { return null; }
}

export async function getPublicMediaAlbums() {
  const albums = await prisma.mediaAlbum.findMany({ where: { isPublished: true }, orderBy: [{ eventDate: "desc" }, { publishedAt: "desc" }] });
  const catalogue = albums.some(album => parseVkAlbumSlug(album.slug)) ? await catalogueOrNull() : null;
  const resolved = [];
  for (const album of albums) {
    const item = await resolveAlbum(album, catalogue);
    if (item) resolved.push(item);
  }
  return resolved.sort((a, b) => (b.eventDate?.getTime() ?? 0) - (a.eventDate?.getTime() ?? 0));
}

export async function getPublicMediaAlbum(slug: string) {
  const album = await prisma.mediaAlbum.findUnique({ where: { slug } });
  if (!album?.isPublished) return null;
  return resolveAlbum(album, parseVkAlbumSlug(slug) ? await catalogueOrNull() : null);
}
