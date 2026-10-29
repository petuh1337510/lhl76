import { withAdmin } from "@/lib/admin-guard";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const clean = (value: unknown, max = 1000) => String(value ?? "").trim().slice(0, max);

function personData(body: Record<string, unknown>) {
  const photoUrl = clean(body.photoUrl, 500);
  const email = clean(body.email, 200);
  return {
    name: clean(body.name, 120),
    role: clean(body.role, 180),
    description: clean(body.description, 1200) || null,
    photoUrl: photoUrl && (/^\/(?!\/)/.test(photoUrl) || /^https:\/\//i.test(photoUrl)) ? photoUrl : null,
    phone: clean(body.phone, 80) || null,
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    active: Boolean(body.active),
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
  };
}

async function handleGET() {
  const [page, people] = await Promise.all([
    prisma.leaguePage.findUnique({ where: { id: "about" } }),
    prisma.leaguePerson.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);
  return NextResponse.json({ page, people });
}

async function handlePOST(request: NextRequest) {
  const body = await request.json();
  const data = personData(body);
  if (!data.name || !data.role) return NextResponse.json({ error: "Укажите имя и роль" }, { status: 400 });
  const person = await prisma.leaguePerson.create({ data });
  return NextResponse.json({ person });
}

async function handlePATCH(request: NextRequest) {
  const body = await request.json();
  if (body.action === "intro") {
    const headline = clean(body.headline, 160);
    const intro = clean(body.intro, 900);
    if (!headline || !intro) return NextResponse.json({ error: "Заполните заголовок и вводный текст" }, { status: 400 });
    const page = await prisma.leaguePage.upsert({
      where: { id: "about" },
      update: { headline, intro },
      create: { id: "about", headline, intro },
    });
    return NextResponse.json({ page });
  }
  if (body.action === "reorder" && Array.isArray(body.orderIds)) {
    const orderIds = Array.from(new Set((body.orderIds as unknown[]).map((value) => clean(value, 100)).filter(Boolean)));
    const existing = await prisma.leaguePerson.findMany({ where: { id: { in: orderIds } }, select: { id: true } });
    if (!orderIds.length || existing.length !== orderIds.length) return NextResponse.json({ error: "Порядок карточек не сохранён" }, { status: 400 });
    await prisma.$transaction(orderIds.map((id, index) => prisma.leaguePerson.update({ where: { id }, data: { sortOrder: index + 1 } })));
    return NextResponse.json({ ok: true });
  }
  const id = clean(body.id, 100);
  if (!id) return NextResponse.json({ error: "Человек не выбран" }, { status: 400 });
  const current = await prisma.leaguePerson.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Карточка не найдена" }, { status: 404 });
  if (body.action === "toggle") {
    const person = await prisma.leaguePerson.update({ where: { id }, data: { active: Boolean(body.active) } });
    return NextResponse.json({ person });
  }
  const data = personData(body);
  if (!data.name || !data.role) return NextResponse.json({ error: "Укажите имя и роль" }, { status: 400 });
  const person = await prisma.leaguePerson.update({ where: { id }, data });
  return NextResponse.json({ person });
}

async function handleDELETE(request: NextRequest) {
  const id = clean(request.nextUrl.searchParams.get("id"), 100);
  if (!id) return NextResponse.json({ error: "Человек не выбран" }, { status: 400 });
  const current = await prisma.leaguePerson.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Карточка не найдена" }, { status: 404 });
  await prisma.leaguePerson.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
export const PATCH = withAdmin(handlePATCH);
export const DELETE = withAdmin(handleDELETE);
