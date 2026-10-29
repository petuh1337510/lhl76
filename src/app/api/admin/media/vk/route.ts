import { withAdmin } from "@/lib/admin-guard";
import { NextRequest, NextResponse } from "next/server";

import { loadVkPhotoAlbum, parseVkAlbumUrl, vkAlbumSlug } from "@/lib/integrations/vk-photos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function handleGET() {
  return NextResponse.json({ configured: Boolean(process.env.VK_API_ACCESS_TOKEN) });
}

async function handlePOST(request: NextRequest) {
  const input = await request.json().catch(() => ({}));
  const url = String(input.url ?? "");
  const albumRef = parseVkAlbumUrl(url);
  if (!albumRef || albumRef.ownerId >= 0) {
    return NextResponse.json({ error: "Укажите ссылку на альбом сообщества VK вида https://vk.ru/album-123_456" }, { status: 400 });
  }
  if (!process.env.VK_API_ACCESS_TOKEN) {
    return NextResponse.json({ error: "Автоматическое подключение VK пока выключено: на сервере не задан VK_API_ACCESS_TOKEN" }, { status: 503 });
  }
  try {
    const album = await loadVkPhotoAlbum(albumRef.ownerId, albumRef.albumId);
    if (!album.photos.length) return NextResponse.json({ error: "В альбоме VK нет доступных фотографий" }, { status: 422 });
    const slug = vkAlbumSlug(albumRef.ownerId, albumRef.albumId);
    const current = await prisma.mediaAlbum.findUnique({ where: { slug } });
    const data = {
      title: album.title,
      description: album.description,
      coverUrl: album.coverUrl,
      photos: album.photos,
      eventDate: album.eventDate,
    };
    const item = current
      ? await prisma.mediaAlbum.update({ where: { slug }, data })
      : await prisma.mediaAlbum.create({
        data: { slug, ...data, isPublished: true, publishedAt: new Date() },
      });
    return NextResponse.json({ item, count: album.photos.length });
  } catch (error) {
    console.error('VK album request failed',error instanceof Error?error.name:'UnknownError');
    return NextResponse.json({ error: "Не удалось загрузить альбом VK. Проверьте ссылку и доступ к альбому." }, { status: 502 });
  }
}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
