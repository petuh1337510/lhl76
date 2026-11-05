import { withAdmin } from "@/lib/admin-guard";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prepareImage } from "@/lib/image-processing";
import {validFileSignature} from '@/lib/file-validation';
import { safeUploadStem } from "@/lib/upload-files";

const allowed: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

async function handlePOST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  const requestedKind = String(form.get("kind") || "general");
  const kind = ["teams", "players", "news", "documents", "media"].includes(requestedKind) ? requestedKind : "general";
  if (!(file instanceof File)) return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
  const extension = allowed[file.type];
  if (!extension) return NextResponse.json({ error: "Этот формат файла не поддерживается" }, { status: 400 });
  const isVideo = file.type.startsWith("video/");
  const isDocument = kind === "documents";
  const maxSize = isVideo ? 150 * 1024 * 1024 : isDocument ? 25 * 1024 * 1024 : 12 * 1024 * 1024;
  if (file.size > maxSize) return NextResponse.json({ error: isVideo ? "Видео больше 150 МБ" : isDocument ? "Документ больше 25 МБ" : "Изображение больше 12 МБ" }, { status: 400 });
  const directory = path.join(process.cwd(), "public", "uploads", kind);
  await mkdir(directory, { recursive: true });
  const id = randomUUID();
  const name = `${id}-original-${safeUploadStem(file.name)}${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  if(!buffer.length||(!file.type.startsWith('image/')&&(buffer.length<8||!validFileSignature(buffer,extension))))return NextResponse.json({error:'Содержимое файла не соответствует формату'},{status:400});
  let prepared: Awaited<ReturnType<typeof prepareImage>> = null;
  if (file.type.startsWith("image/")) {
    try { prepared = await prepareImage(buffer); }
    catch { return NextResponse.json({ error: "Изображение повреждено или превышает допустимое разрешение (40 Мп)" }, { status: 400 }); }
  }
  await writeFile(path.join(directory, name), buffer,{flag:'wx'});
  if (prepared) {
    await Promise.all([
      writeFile(path.join(directory, `${id}-display.webp`), prepared.display,{flag:'wx'}),
      writeFile(path.join(directory, `${id}-thumb.webp`), prepared.thumbnail,{flag:'wx'}),
    ]);
  }
  return NextResponse.json({
    url: `/uploads/${kind}/${prepared ? `${id}-display.webp` : encodeURIComponent(name)}`,
    originalUrl: `/uploads/${kind}/${encodeURIComponent(name)}`,
    thumbnailUrl: prepared ? `/uploads/${kind}/${id}-thumb.webp` : undefined,
    type: isVideo ? "video" : isDocument ? "document" : "image",
  });
}

export const POST = withAdmin(handlePOST);
