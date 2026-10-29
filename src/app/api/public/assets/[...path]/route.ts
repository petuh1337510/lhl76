import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const mime: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".pdf": "application/pdf", ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const segments = (await context.params).path;
  if (!segments.length || segments.some((part) => !/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9]+)?$/.test(part)) ||
      !(segments[0] === "uploads" || segments[0] === "images" && segments[1] === "optimized")) {
    return new Response(null, { status: 404 });
  }
  const type = mime[path.extname(segments.at(-1)!).toLowerCase()];
  if (!type) return new Response(null, { status: 404 });
  try {
    const root = await realpath(path.join(process.cwd(), "public"));
    const file = await realpath(path.join(root, ...segments));
    if (!file.startsWith(root + path.sep)) return new Response(null, { status: 404 });
    const info = await stat(file);
    if (!info.isFile()) return new Response(null, { status: 404 });
    const etag = `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const headers = new Headers({ "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "ETag": etag, "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes" });
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    let start = 0, end = info.size - 1;
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || !match[1] && !match[2]) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
      start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
      if (start > end || start >= info.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
      headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    }
    headers.set("Content-Length", String(end - start + 1));
    return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, { status: range ? 206 : 200, headers });
  } catch { return new Response(null, { status: 404 }); }
}
