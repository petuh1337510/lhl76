import { lstat, readdir, unlink } from "node:fs/promises";
import path from "node:path";

export const uploadKinds = ["teams", "players", "news", "documents", "media", "general"] as const;
export type UploadKind = (typeof uploadKinds)[number];
export type UploadType = "image" | "document" | "video";

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const filePattern = new RegExp(`^(${uuid})(?:-(display|thumb)|-original-(.+))?\\.([a-z0-9]+)$`, "i");
const keyPattern = new RegExp(`^(${uploadKinds.join("|")})/(${uuid})$`, "i");
const imageExtensions = new Set(["jpg", "png", "webp", "gif"]);
const documentExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx"]);
const videoExtensions = new Set(["mp4", "webm", "mov"]);

export function normalizeUploadKey(key: string) {
  const match = keyPattern.exec(key);
  return match ? `${match[1].toLowerCase()}/${match[2].toLowerCase()}` : null;
}

export function safeUploadStem(fileName: string) {
  const base = fileName.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "";
  return base.normalize("NFKC")
    .replace(/[^\p{L}\p{N} _-]+/gu, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "file";
}

export function parseUploadFileName(name: string) {
  const match = filePattern.exec(name);
  if (!match) return null;
  const extension = match[4].toLowerCase();
  const type: UploadType | null = imageExtensions.has(extension) ? "image" : documentExtensions.has(extension) ? "document" : videoExtensions.has(extension) ? "video" : null;
  if (!type || (match[2] && extension !== "webp")) return null;
  return { id: match[1].toLowerCase(), role: match[2] ?? "original", title: match[3]?.replace(/-/g, " ") ?? null, type };
}

export function uploadFamilyKey(url: string) {
  try {
    const pathname = decodeURIComponent(new URL(url, "https://local.invalid").pathname);
    const match = /^\/uploads\/([^/]+)\/([^/]+)$/.exec(pathname);
    if (!match || !uploadKinds.includes(match[1] as UploadKind)) return null;
    const parsed = parseUploadFileName(match[2]);
    return parsed ? `${match[1]}/${parsed.id}` : null;
  } catch {
    return null;
  }
}

type UploadVariant = { name: string; size: number; modifiedAt: number; role: string; title: string | null; type: UploadType };
export type UploadFamily = {
  key: string;
  kind: UploadKind;
  type: UploadType;
  title: string;
  size: number;
  totalBytes: number;
  date: string;
  url: string;
  previewUrl: string | null;
};

export async function readUploadFamilies(root: string): Promise<UploadFamily[]> {
  const families = new Map<string, { kind: UploadKind; files: UploadVariant[] }>();
  for (const kind of uploadKinds) {
    const directory = path.join(root, kind);
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const parsed = parseUploadFileName(entry.name);
      if (!parsed) continue;
      const info = await lstat(path.join(directory, entry.name));
      if (!info.isFile()) continue;
      const key = `${kind}/${parsed.id}`;
      const family = families.get(key) ?? { kind, files: [] };
      family.files.push({ name: entry.name, size: info.size, modifiedAt: info.mtimeMs, role: parsed.role, title: parsed.title, type: parsed.type });
      families.set(key, family);
    }
  }
  return [...families].map(([key, family]) => {
    const original = family.files.find((file) => file.role === "original");
    const display = family.files.find((file) => file.role === "display");
    const thumbnail = family.files.find((file) => file.role === "thumb");
    const main = original ?? display ?? thumbnail!;
    const url = (file: UploadVariant) => `/uploads/${family.kind}/${encodeURIComponent(file.name)}`;
    return {
      key, kind: family.kind, type: main.type,
      title: original?.title ?? original?.name ?? main.name,
      size: main.size,
      totalBytes: family.files.reduce((sum, file) => sum + file.size, 0),
      date: new Date(main.modifiedAt).toISOString(),
      url: url(display ?? main),
      previewUrl: main.type === "image" ? url(thumbnail ?? display ?? main) : null,
    };
  }).sort((left, right) => right.date.localeCompare(left.date) || left.key.localeCompare(right.key));
}

export async function removeUploadFamily(root: string, key: string) {
  const normalized = normalizeUploadKey(key);
  if (!normalized) return false;
  const [kind, id] = normalized.split("/");
  const directory = path.join(root, kind);
  let names;
  try { names = await readdir(directory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
  const files = names.filter((name) => parseUploadFileName(name)?.id === id);
  if (!files.length) return false;
  for (const name of files) {
    const file = path.join(directory, name);
    if (!(await lstat(file)).isFile()) throw new Error("Upload family contains a non-file entry");
  }
  for (const name of files) await unlink(path.join(directory, name));
  return true;
}
