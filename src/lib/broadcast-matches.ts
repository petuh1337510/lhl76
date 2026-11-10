import { prisma } from "@/lib/prisma";
export const broadcastMatchSelect = {
  id: true, startsAt: true, status: true,
  homeTeamEntry: { select: { team: { select: { name: true } } } },
  awayTeamEntry: { select: { team: { select: { name: true } } } },
  division: { select: { name: true, competition: { select: { name: true, season: { select: { name: true } } } } } },
} as const;
export type BroadcastMatch = Awaited<ReturnType<typeof getBroadcastMatches>>[number];
export function getBroadcastMatches(ids: string[] = []) {
  return prisma.match.findMany({
    where: { OR: [{ id: { in: ids } }, { startsAt: { gte: new Date(Date.now() - 120 * 86400000), lte: new Date(Date.now() + 120 * 86400000) } }] },
    select: broadcastMatchSelect, orderBy: { startsAt: "desc" },
  });
}
export function matchLabel(match: BroadcastMatch) {
  return `${match.homeTeamEntry.team.name} — ${match.awayTeamEntry.team.name} · ${match.division.competition.season.name} · ${match.division.competition.name} · ${match.division.name}`;
}
const normalize = (value: string) => value.toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]/g, "");
/** Only an unambiguous pair of teams on the explicit video title date may be linked automatically. */
export function suggestBroadcastMatch(title: string, matches: BroadcastMatch[]) {
  const parts = title.match(/^(.+?)\s+[-–—]\s+(.+?)\s*\|\s*(\d{2})\.(\d{2})\.(\d{4})\s*$/);
  if (!parts) return null;
  const [, home, away, day, month, year] = parts;
  const date = `${year}-${month}-${day}`;
  const candidates = matches.filter(match => match.startsAt &&
    new Date(match.startsAt.getTime() + 3 * 3600000).toISOString().slice(0, 10) === date &&
    normalize(match.homeTeamEntry.team.name) === normalize(home) && normalize(match.awayTeamEntry.team.name) === normalize(away));
  return candidates.length === 1 ? candidates[0] : null;
}
