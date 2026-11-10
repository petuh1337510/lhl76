import { withAdmin } from "@/lib/admin-guard";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getCachedVkCommunityAlbums, loadVkPhotoAlbum, parseVkAlbumSlug, vkAlbumSlug } from "@/lib/integrations/vk-photos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function catalogue() {
  const { ownerId, albums } = await getCachedVkCommunityAlbums();
  const saved = await prisma.mediaAlbum.findMany({ where: { slug: { startsWith: "vk-photo-" } } });
  const items = albums.map(album => {
    const slug = vkAlbumSlug(ownerId, album.id);
    const selected = saved.find(item => item.slug === slug);
    return { albumId: album.id, slug, title: album.title, coverUrl: album.thumb_src ?? null, count: album.size ?? 0, isPublished: selected?.isPublished ?? false, available: true };
  });
  for (const item of saved) {
    const ref = parseVkAlbumSlug(item.slug);
    if (ref?.ownerId === ownerId && !items.some(row => row.slug === item.slug)) {
      items.push({ albumId: ref.albumId, slug: item.slug, title: item.title, coverUrl: item.coverUrl, count: 0, isPublished: item.isPublished, available: false });
    }
  }
  return items;
}

async function savedCatalogue() {
  const saved = await prisma.mediaAlbum.findMany({ where: { slug: { startsWith: "vk-photo-" } } });
  return saved.flatMap(item => {
    const ref = parseVkAlbumSlug(item.slug);
    return ref ? [{ albumId: ref.albumId, slug: item.slug, title: item.title, coverUrl: item.coverUrl, count: Array.isArray(item.photos) ? item.photos.length : 0, isPublished: item.isPublished, available: null }] : [];
  });
}

async function handleGET() {
  if (!process.env.VK_API_ACCESS_TOKEN) return NextResponse.json({ configured: false, items: await savedCatalogue(), error: "На сервере не настроено подключение VK." });
  try { return NextResponse.json({ configured: true, items: await catalogue() }); }
  catch { return NextResponse.json({ configured: true, items: await savedCatalogue(), error: "Не удалось получить альбомы VK. Проверьте подключение или повторите позже." }, { status: 502 }); }
}

async function handlePOST(request: NextRequest) {
  const input = await request.json();
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  if (input.isPublished === false && typeof input.slug === "string" && parseVkAlbumSlug(input.slug)) {
    await prisma.mediaAlbum.updateMany({ where: { slug: input.slug }, data: { isPublished: false } });
    return NextResponse.json({ ok: true });
  }
  if (!process.env.VK_API_ACCESS_TOKEN) return NextResponse.json({ error: "На сервере не настроено подключение VK." }, { status: 503 });
  if (input.action === "refresh") {
    revalidateTag("vk-photos");
    return handleGET();
  }
  if (!Number.isSafeInteger(input.albumId) || input.albumId <= 0 || typeof input.isPublished !== "boolean") {
    return NextResponse.json({ error: "Выберите альбом и состояние публикации." }, { status: 400 });
  }
  try {
    const { ownerId, albums } = await getCachedVkCommunityAlbums();
    const slug = vkAlbumSlug(ownerId, input.albumId);
    if (!input.isPublished) {
      await prisma.mediaAlbum.updateMany({ where: { slug }, data: { isPublished: false } });
    } else {
      if (!albums.some(album => album.id === input.albumId)) return NextResponse.json({ error: "Альбом недоступен в группе ЛХЛ-76." }, { status: 404 });
      const album = await loadVkPhotoAlbum(ownerId, input.albumId);
      if (!album) return NextResponse.json({ error: "Альбом недоступен в VK." }, { status: 404 });
      await prisma.mediaAlbum.upsert({ where: { slug }, update: { ...album, isPublished: true, publishedAt: new Date() }, create: { slug, ...album, isPublished: true, publishedAt: new Date() } });
    }
    revalidateTag("vk-photos");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Не удалось обновить альбом. Проверьте доступ к VK и повторите попытку." }, { status: 502 });
  }
}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
