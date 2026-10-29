import { getCachedVkPhotoAlbum, parseVkAlbumSlug } from "@/lib/integrations/vk-photos";
import { prisma } from "@/lib/prisma";

const photosFromJson = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export async function getPublicMediaAlbums() {
  const albums = await prisma.mediaAlbum.findMany({
    where: { isPublished: true },
    orderBy: [{ eventDate: "desc" }, { publishedAt: "desc" }],
  });
  return Promise.all(albums.map(async (album) => {
    const ref = parseVkAlbumSlug(album.slug);
    let vk = null;
    if (ref && process.env.VK_API_ACCESS_TOKEN) {
      try { vk = await getCachedVkPhotoAlbum(ref.ownerId, ref.albumId); }
      catch (error) { console.error(`Не удалось обновить фотоальбом ${album.slug}:`, error); }
    }
    return {
      ...album,
      title: vk?.title ?? album.title,
      description: vk?.description ?? album.description,
      coverUrl: vk?.coverUrl ?? album.coverUrl,
      photos: vk?.photos.length ? vk.photos : photosFromJson(album.photos),
    };
  }));
}

export async function getPublicMediaAlbum(slug: string) {
  const albums = await getPublicMediaAlbums();
  return albums.find((album) => album.slug === slug) ?? null;
}
