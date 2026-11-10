import { withAdmin } from "@/lib/admin-guard";
import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { resolveVideoPreview } from "@/lib/video-preview";
import { getBroadcastCatalogue } from "@/lib/public-broadcasts";
import { broadcastMatchSelect, matchLabel } from "@/lib/broadcast-matches";
import { parseMoscowInput, vkVideoKey } from "@/lib/broadcast-status";
import { safeEditorialUrl } from "@/lib/editorial-url";
import { z } from "zod";

export const dynamic = "force-dynamic";
const schema = z.object({
  id: z.string().max(150).optional(),
  action: z.literal("refresh").optional(),
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(20000).optional(),
  videoUrl: z.string().max(2048).refine(value => Boolean(safeEditorialUrl(value))).optional(),
  imageUrl: z.string().max(2048).optional(),
  startsAt: z.string().max(16).optional(),
  endsAt: z.string().max(16).optional(),
  matchId: z.string().max(128).optional(),
  isPublished: z.boolean().optional(),
}).strict();
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function handleGET(request: NextRequest) {
  if (request.nextUrl.searchParams.has("matches")) {
    const date = request.nextUrl.searchParams.get("date") ?? "";
    if (date && !parseMoscowInput(date + "T00:00")) return bad("Некорректная дата.");
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
    const matches = await prisma.match.findMany({
      where: {
        startsAt: date ? { gte: new Date(date + "T00:00:00+03:00"), lt: new Date(new Date(date + "T00:00:00+03:00").getTime() + 86400000) }
          : { gte: new Date(Date.now() - 14 * 86400000), lte: new Date(Date.now() + 60 * 86400000) },
        ...(q ? { OR: [
          { homeTeamEntry: { team: { name: { contains: q, mode: "insensitive" as const } } } },
          { awayTeamEntry: { team: { name: { contains: q, mode: "insensitive" as const } } } },
        ] } : {}),
      }, select: broadcastMatchSelect, orderBy: { startsAt: "asc" }, take: 100,
    });
    return NextResponse.json({ items: matches.map(match => ({ id: match.id, label: matchLabel(match), startsAt: match.startsAt, status: match.status })) });
  }
  return NextResponse.json(await getBroadcastCatalogue());
}

async function save(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return bad("Проверьте название, ссылку, даты и поля формы.");
  const x = parsed.data;
  if (x.action === "refresh") {
    revalidateTag("vk-broadcasts");
    return handleGET(request);
  }
  const existing = x.id ? (await getBroadcastCatalogue()).items.find(item => item.id === x.id) : undefined;
  if (x.id && !existing) return bad("Трансляция не найдена. Обновите список.", 404);
  const title = x.title ?? existing?.title;
  const videoUrl = x.videoUrl ?? existing?.videoUrl;
  if (!title || !videoUrl) return bad("Укажите название и ссылку на видео.");
  if (existing?.source === "vk" && vkVideoKey(videoUrl) !== vkVideoKey(existing.videoUrl)) return bad("Для другого видео создайте отдельную карточку.");
  const startsAt = x.startsAt === undefined ? existing?.customStartsAt ?? null : x.startsAt ? parseMoscowInput(x.startsAt) : null;
  const endsAt = x.endsAt === undefined ? existing?.customEndsAt ?? null : x.endsAt ? parseMoscowInput(x.endsAt) : null;
  if ((x.startsAt && !startsAt) || (x.endsAt && !endsAt)) return bad("Некорректная дата или время. Укажите московское время.");
  const matchId = x.matchId === undefined ? existing?.matchId ?? null : x.matchId || null;
  const match = matchId ? await prisma.match.findUnique({ where: { id: matchId }, select: { startsAt: true } }) : null;
  if (matchId && !match) return bad("Матч не найден.");
  const effectiveStart = match ? match.startsAt : startsAt;
  if (endsAt && (!effectiveStart || endsAt <= effectiveStart)) return bad("Окончание должно быть позже начала матча.");
  const key = vkVideoKey(videoUrl);
  const duplicate = await prisma.broadcast.findFirst({ where: {
    ...(key ? { OR: [{ videoUrl: { endsWith: "video" + key } }, { videoUrl: { endsWith: "live" + key } }] } : { videoUrl }),
    ...(existing?.saved ? { id: { not: existing.id } } : {}),
  } });
  if (duplicate) return bad("Это видео уже добавлено. Отредактируйте существующую карточку.", 409);
  const isPublished = x.isPublished ?? existing?.isPublished ?? false;
  const imageUrl = x.imageUrl === undefined ? existing?.imageUrl ?? null : x.imageUrl.trim() || null;
  const data = {
    title, videoUrl, description: x.description === undefined ? existing?.description ?? null : x.description.trim() || null,
    imageUrl: imageUrl ?? (x.id ? null : await resolveVideoPreview(videoUrl)), startsAt, endsAt, matchId,
    isLive: false, isPublished, publishedAt: isPublished ? existing?.publishedAt ?? new Date() : null,
  };
  const item = existing?.saved
    ? await prisma.broadcast.update({ where: { id: existing.id }, data })
    : await prisma.broadcast.create({ data: { ...data,
      slug: existing?.slug ?? (key ? "vk-" + key : "broadcast-" + randomBytes(8).toString("hex")),
    } });
  return NextResponse.json({ item }, { status: existing?.saved ? 200 : 201 });
}
export const GET = withAdmin(handleGET);
export const POST = withAdmin(save);
export const PATCH = withAdmin(save);
