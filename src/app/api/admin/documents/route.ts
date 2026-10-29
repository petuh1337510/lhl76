import { withAdmin } from "@/lib/admin-guard";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function handleGET() {
  const items = await prisma.document.findMany({
    orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
  });
  return NextResponse.json({ items });
}

async function handlePOST(request: NextRequest) {
  const input = await request.json();
  const title = String(input.title ?? "").trim();
  const fileUrl = String(input.fileUrl ?? "").trim();
  if (!title || !fileUrl) {
    return NextResponse.json({ error: "Укажите название и загрузите файл" }, { status: 400 });
  }
  const item = await prisma.document.create({
    data: {
      title,
      fileUrl,
      category: String(input.category ?? "Документы").trim() || "Документы",
      publishedAt: input.isPublished ? new Date() : null,
    },
  });
  return NextResponse.json({ item }, { status: 201 });
}

async function handlePATCH(request: NextRequest) {
  const input = await request.json();
  const id = String(input.id ?? "");
  if (!id) return NextResponse.json({ error: "Документ не выбран" }, { status: 400 });
  const current = await prisma.document.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
  const title = String(input.title ?? current.title).trim();
  const fileUrl = String(input.fileUrl ?? current.fileUrl).trim();
  if (!title || !fileUrl) return NextResponse.json({ error: "Укажите название и файл" }, { status: 400 });
  const item = await prisma.document.update({
    where: { id },
    data: {
      title,
      fileUrl,
      category: String(input.category ?? current.category ?? "Документы").trim() || "Документы",
      publishedAt: input.isPublished === true ? current.publishedAt ?? new Date() : input.isPublished === false ? null : current.publishedAt,
    },
  });
  return NextResponse.json({ item });
}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
export const PATCH = withAdmin(handlePATCH);
