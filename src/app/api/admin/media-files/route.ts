import { NextRequest, NextResponse } from "next/server";
import path from "node:path";

import { withAdmin } from "@/lib/admin-guard";
import { readLegacyCardMedia } from "@/lib/legacy-card-media";
import { normalizeUploadKey, readUploadFamilies, removeUploadFamily } from "@/lib/upload-files";
import { findUploadUses } from "@/lib/upload-uses";
import { mediaPage } from "@/lib/media-page";

export const dynamic = "force-dynamic";

const uploadsRoot = () => path.join(process.cwd(), "public", "uploads");

async function handleGET(request: NextRequest) {
  const [families, uses, archive] = await Promise.all([readUploadFamilies(uploadsRoot()), findUploadUses(), readLegacyCardMedia()]);
  const items = families.map((family) => {
    const usedBy = uses.get(family.key) ?? [];
    return {
      ...family,
      title: usedBy.length && /^[0-9a-f-]{36}(?:-display|-thumb)?\./i.test(family.title) ? usedBy[0].label : family.title,
      usedBy,
      datePrecision: "day" as const,
      deletable: true,
      origin: "upload" as const,
    };
  });
  return NextResponse.json(mediaPage([...items, ...archive], request.nextUrl.searchParams));
}

async function handleDELETE(request: NextRequest) {
  const key = normalizeUploadKey(request.nextUrl.searchParams.get("key") ?? "");
  if (!key) return NextResponse.json({ error: "Недопустимый файл" }, { status: 400 });
  const uses = await findUploadUses();
  const usedBy = uses.get(key) ?? [];
  if (usedBy.length) return NextResponse.json({ error: "Файл используется на сайте. Сначала уберите его из указанных материалов.", usedBy }, { status: 409 });
  const removed = await removeUploadFamily(uploadsRoot(), key);
  if (!removed) return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export const GET = withAdmin(handleGET);
export const DELETE = withAdmin(handleDELETE);
