import { getVkBroadcastCatalogue } from "@/lib/integrations/vk-video";
import { prisma } from "@/lib/prisma";
import { broadcastTiming, vkVideoKey } from "@/lib/broadcast-status";
import { getBroadcastMatches, matchLabel, suggestBroadcastMatch } from "@/lib/broadcast-matches";

export async function getBroadcastCatalogue() {
  const [saved, vk] = await Promise.all([
    prisma.broadcast.findMany({ orderBy: { createdAt: "desc" } }), getVkBroadcastCatalogue(),
  ]);
  const matches = await getBroadcastMatches(saved.flatMap(item => item.matchId ? [item.matchId] : []));
  const automatic = new Map(vk.items.map(item => [vkVideoKey(item.videoUrl), item]));
  const savedKeys = new Set(saved.map(item => vkVideoKey(item.videoUrl)).filter(Boolean));
  const merged = [
    ...saved.map(item => {
      const source = automatic.get(vkVideoKey(item.videoUrl));
      return { ...item, imageUrl: item.imageUrl ?? source?.imageUrl ?? null,
        startsAt: item.startsAt ?? source?.startsAt ?? null, publishedAt: source?.publishedAt ?? item.publishedAt,
        source: vkVideoKey(item.videoUrl) ? "vk" : "manual", saved: true };
    }),
    ...vk.items.filter(item => !savedKeys.has(vkVideoKey(item.videoUrl))).map(item => ({ ...item,
      endsAt: null, matchId: null, isPublished: true, source: "vk", saved: false })),
  ];
  const now = Date.now();
  const items = merged.map(item => {
    const match = item.matchId ? matches.find(match => match.id === item.matchId) : suggestBroadcastMatch(item.title, matches);
    const timing = broadcastTiming({ ...item, match }, now);
    return { ...item, ...timing, customStartsAt: item.startsAt, customEndsAt: item.endsAt,
      matchId: match?.id ?? null, matchStatus: match?.status ?? null,
      matchLabel: match ? matchLabel(match) : null, autoMatched: Boolean(match && !item.matchId),
      available: item.source === "vk" ? vk.available
        ? !vkVideoKey(item.videoUrl)?.startsWith(`${vk.ownerId}_`) || automatic.has(vkVideoKey(item.videoUrl))
        : null : true };
  });
  const priority = { live: 0, upcoming: 1, archive: 2 };
  items.sort((a, b) => priority[a.status] - priority[b.status] || (a.status === "upcoming"
    ? (a.startsAt?.getTime() ?? Infinity) - (b.startsAt?.getTime() ?? Infinity)
    : ((b.startsAt ?? b.publishedAt)?.getTime() ?? 0) - ((a.startsAt ?? a.publishedAt)?.getTime() ?? 0)) || a.id.localeCompare(b.id));
  return { ...vk, items, serverTime: now };
}

export async function getPublicBroadcasts(limit = 100) {
  const catalogue = await getBroadcastCatalogue();
  return catalogue.items.filter(item => item.isPublished && item.available !== false).slice(0, limit).map(item => ({
    id: item.id, slug: item.slug, title: item.title, description: item.description,
    videoUrl: item.videoUrl, imageUrl: item.imageUrl, startsAt: item.startsAt, endsAt: item.endsAt,
    publishedAt: item.publishedAt, matchStatus: item.matchStatus, status: item.status, isLive: item.isLive,
  }));
}
export type PublicBroadcast = Awaited<ReturnType<typeof getPublicBroadcasts>>[number];
