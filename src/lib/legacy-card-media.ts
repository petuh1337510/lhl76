import { stat } from "node:fs/promises";
import path from "node:path";

import finalManifest from "@/lib/legacy-final-media-manifest.json";
import manifest from "@/lib/legacy-media-manifest.json";
import { prisma } from "@/lib/prisma";
import type { UploadUse } from "@/lib/upload-uses";

const mirrors: Record<string, string> = { ...finalManifest, ...manifest };

type LegacyCardMedia = {
  key: string;
  kind: "players" | "teams";
  type: "image";
  title: string;
  size: number;
  totalBytes: number;
  date: string;
  datePrecision: "month" | "day";
  url: string;
  previewUrl: string;
  usedBy: UploadUse[];
  deletable: false;
  origin: "archive";
};

function mirrorPath(source: string) {
  const file = source.startsWith("/legacy-media/") ? source : mirrors[source];
  return file && /^\/legacy-media\/[a-f0-9]{64}\.[a-z]+$/.test(file) ? file : null;
}

function sourceDate(source: string, fallback: Date) {
  const match = /\/wp-content\/uploads\/(20\d\d)\/(0[1-9]|1[0-2])\//.exec(source);
  return match
    ? { date: `${match[1]}-${match[2]}-01T00:00:00.000Z`, datePrecision: "month" as const }
    : { date: fallback.toISOString(), datePrecision: "day" as const };
}

/** Card media was imported into the archive before the upload manager existed. */
export async function readLegacyCardMedia(): Promise<LegacyCardMedia[]> {
  const [players, teams] = await Promise.all([
    prisma.player.findMany({ select: { firstName: true, lastName: true, slug: true, photoUrl: true, laureatePhotoUrl: true } }),
    prisma.team.findMany({ select: { name: true, slug: true, logoUrl: true, teamPhotoUrl: true } }),
  ]);
  const entries = new Map<string, { kind: "players" | "teams"; title: string; sources: string[]; usedBy: UploadUse[] }>();
  const add = (source: string | null, kind: "players" | "teams", title: string, use: UploadUse) => {
    if (!source || source.startsWith("/uploads/")) return;
    const file = mirrorPath(source);
    if (!file) return;
    const entry = entries.get(file) ?? { kind, title, sources: [], usedBy: [] };
    if (!entry.sources.includes(source)) entry.sources.push(source);
    if (!entry.usedBy.some((existing) => existing.href === use.href)) entry.usedBy.push(use);
    entries.set(file, entry);
  };
  for (const player of players) {
    const name = `${player.lastName} ${player.firstName}`.trim();
    const use = { label: `Игрок ${name}`, href: `/admin/player?slug=${encodeURIComponent(player.slug)}` };
    add(player.photoUrl, "players", `Фото игрока: ${name}`, use);
    add(player.laureatePhotoUrl, "players", `Фото лауреата: ${name}`, use);
  }
  for (const team of teams) {
    const use = { label: `Команда «${team.name}»`, href: `/admin/team?slug=${encodeURIComponent(team.slug)}` };
    add(team.logoUrl, "teams", `Логотип команды: ${team.name}`, use);
    add(team.teamPhotoUrl, "teams", `Фото команды: ${team.name}`, use);
  }
  const result = await Promise.all([...entries].map(async ([file, entry]) => {
    try {
      const info = await stat(path.join(process.cwd(), "public", file));
      if (!info.isFile()) return null;
      const { date, datePrecision } = sourceDate(entry.sources.find((source) => source.includes("/wp-content/uploads/")) ?? entry.sources[0], info.mtime);
      return {
        key: `archive/${path.basename(file)}`,
        kind: entry.kind,
        type: "image" as const,
        title: entry.title,
        size: info.size,
        totalBytes: info.size,
        date,
        datePrecision,
        url: file,
        previewUrl: file,
        usedBy: entry.usedBy,
        deletable: false as const,
        origin: "archive" as const,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }));
  return result.filter((item): item is LegacyCardMedia => item !== null);
}
