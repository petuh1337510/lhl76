import { withAdmin } from "@/lib/admin-guard";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { invalidateHomeEditorial } from "@/lib/home-editorial";

export const dynamic = "force-dynamic";

const clean = (value: unknown) => String(value ?? "").trim();

async function handleGET() {
  const items = await prisma.homepageContent.findMany({ orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json({ items });
}

async function handlePOST(request: NextRequest) {
  const body = await request.json();
  const title = clean(body.title);
  const type = body.type === "banner" ? "banner" : "tile";
  if (!title) return NextResponse.json({ error: "Укажите заголовок" }, { status: 400 });
  const item = await prisma.homepageContent.create({
    data: {
      type, title, subtitle: clean(body.subtitle) || null, link: clean(body.link) || null,
      imageDesktop: clean(body.imageDesktop) || null, imageMobile: clean(body.imageMobile) || null,
      style: clean(body.style) || null, active: Boolean(body.active), sortOrder: Number(body.sortOrder) || 0,
    },
  });
  invalidateHomeEditorial();
  return NextResponse.json({ item });
}

async function handlePATCH(request: NextRequest) {
  const body = await request.json();
  if (body.action === "reorder" && Array.isArray(body.orderIds)) {
    const orderIds: string[] = Array.from(new Set((body.orderIds as unknown[]).map((value) => clean(value)).filter((value) => value.length > 0)));
    if (!orderIds.length) return NextResponse.json({ error: "Не указан порядок материалов" }, { status: 400 });
    const existing = await prisma.homepageContent.findMany({ where: { id: { in: orderIds } }, select: { id: true } });
    if (existing.length !== orderIds.length) return NextResponse.json({ error: "Один из материалов не найден" }, { status: 404 });
    await prisma.$transaction(orderIds.map((id, index) => prisma.homepageContent.update({ where: { id }, data: { sortOrder: index + 1 } })));
    invalidateHomeEditorial();
    return NextResponse.json({ ok: true });
  }
  const id = clean(body.id);
  if (!id) return NextResponse.json({ error: "Материал не выбран" }, { status: 400 });
  const current = await prisma.homepageContent.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
  if (body.action === "toggle-active") {
    const item = await prisma.homepageContent.update({ where: { id }, data: { active: Boolean(body.active) } });
    invalidateHomeEditorial();
    return NextResponse.json({ item });
  }
  const type = body.type === "banner" ? "banner" : "tile";
  const item = await prisma.homepageContent.update({
    where: { id },
    data: {
      type, title: clean(body.title) || current.title, subtitle: clean(body.subtitle) || null,
      link: clean(body.link) || null, imageDesktop: clean(body.imageDesktop) || null,
      imageMobile: clean(body.imageMobile) || null, style: clean(body.style) || null,
      active: Boolean(body.active), sortOrder: Number(body.sortOrder) || 0,
    },
  });
  invalidateHomeEditorial();
  return NextResponse.json({ item });
}

async function handleDELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Материал не выбран" }, { status: 400 });
  await prisma.homepageContent.delete({ where: { id } });
  invalidateHomeEditorial();
  return NextResponse.json({ ok: true });
}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
export const PATCH = withAdmin(handlePATCH);
export const DELETE = withAdmin(handleDELETE);
