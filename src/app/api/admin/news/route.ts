import { newsVideoSource, vkNewsVideo } from "@/lib/news-video";
import { getVkNewsPreview } from "@/lib/vk-news-video";
import { withAdmin } from "@/lib/admin-guard";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { invalidateHomeEditorial } from "@/lib/home-editorial";

export const dynamic = "force-dynamic";

async function handleGET() {
  const items = await prisma.news.findMany({ orderBy: [{ publishedAt: "desc" }, { title: "asc" }] });
  return NextResponse.json({ items });
}

async function handlePOST(request: NextRequest) {
  const body = await request.json();
  if (body.videoUrl !== undefined && body.videoUrl !== "" && body.videoUrl !== null && !newsVideoSource(body.videoUrl)) {
    return NextResponse.json({ error: "Укажите ссылку на клип/видео VK, YouTube, Rutube или загрузите видеофайл" }, { status: 400 });
  }
  if (!body.title?.trim() || !body.excerpt?.trim()) {
    return NextResponse.json({ error: "Заполните заголовок и короткое описание" }, { status: 400 });
  }
  const baseSlug = String(body.title)
    .toLocaleLowerCase("ru")
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "news";
  const isPublished = body.status === "PUBLISHED";
  const autoCover = !body.imageUrl?.trim() && vkNewsVideo(body.videoUrl) ? (await getVkNewsPreview(body.videoUrl))?.thumbnail : null;
  const item = await prisma.news.create({
    data: {
      slug: `${baseSlug}-${randomUUID().slice(0, 6)}`,
      title: body.title.trim(),
      excerpt: body.excerpt.trim(),
      body: body.body?.trim() || null,
      category: body.category?.trim() || "Новости",
      imageUrl: body.imageUrl?.trim() || autoCover || null,
      videoUrl: body.videoUrl?.trim() || null,
      gallery: Array.isArray(body.gallery) ? body.gallery.filter((item: unknown) => typeof item === "string") : [],
      isPublished,
      publishedAt: isPublished ? new Date() : null,
    },
  });
  invalidateHomeEditorial();
  return NextResponse.json(item, { status: 201 });
}

async function handlePATCH(request: NextRequest) {
  const body = await request.json();
  if (body.videoUrl !== undefined && body.videoUrl !== "" && body.videoUrl !== null && !newsVideoSource(body.videoUrl)) {
    return NextResponse.json({ error: "Укажите ссылку на клип/видео VK, YouTube, Rutube или загрузите видеофайл" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "Новость не выбрана" }, { status: 400 });
  const current = await prisma.news.findUnique({ where: { id: body.id } });
  if (!current) return NextResponse.json({ error: "Новость не найдена" }, { status: 404 });
  const isPublished = typeof body.isPublished === "boolean"
    ? body.isPublished
    : body.status
      ? body.status === "PUBLISHED"
      : current.isPublished;
  const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : current.videoUrl;
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : current.imageUrl;
  const autoCover = !imageUrl && vkNewsVideo(videoUrl) ? (await getVkNewsPreview(videoUrl!))?.thumbnail : null;
  const item = await prisma.news.update({
    where: { id: current.id },
    data: {
      isPublished,
      publishedAt: isPublished ? current.publishedAt ?? new Date() : null,
      ...(typeof body.title === "string" ? { title: body.title.trim() } : {}),
      ...(typeof body.category === "string" ? { category: body.category.trim() || "Новости" } : {}),
      ...(typeof body.excerpt === "string" ? { excerpt: body.excerpt.trim() } : {}),
      ...(typeof body.body === "string" ? { body: body.body.trim() || null } : {}),
      ...(typeof body.imageUrl === "string" || autoCover ? { imageUrl: imageUrl || autoCover || null } : {}),
      ...(typeof body.videoUrl === "string" ? { videoUrl: body.videoUrl.trim() || null } : {}),
      ...(Array.isArray(body.gallery) ? { gallery: body.gallery.filter((item: unknown) => typeof item === "string") } : {}),
    },
  });
  invalidateHomeEditorial();
  return NextResponse.json(item);
}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
export const PATCH = withAdmin(handlePATCH);
