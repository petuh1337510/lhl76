import { getVkBroadcasts, type VkBroadcast } from "@/lib/integrations/vk-video";
import { prisma } from "@/lib/prisma";

export type PublicBroadcast = Pick<VkBroadcast,
  "id" | "slug" | "title" | "description" | "videoUrl" | "imageUrl" | "startsAt" | "isLive"
>;

const vkKey = (url: string) => url.match(/(?:live|video)-?(\d+_\d+)/)?.[1] ?? null;

export async function getPublicBroadcasts(limit = 100): Promise<PublicBroadcast[]> {
  const [manual, automatic] = await Promise.all([
    prisma.broadcast.findMany({
      where: { isPublished: true },
      orderBy: [{ isLive: "desc" }, { startsAt: "desc" }, { publishedAt: "desc" }],
      take: Math.max(limit, 100),
    }),
    getVkBroadcasts(),
  ]);
  const automaticByKey = new Map(automatic.map((item) => [vkKey(item.videoUrl), item]));
  const manualItems: PublicBroadcast[] = manual.map((item) => {
    const vk = automaticByKey.get(vkKey(item.videoUrl));
    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      description: item.description,
      videoUrl: item.videoUrl,
      imageUrl: item.imageUrl ?? vk?.imageUrl ?? null,
      startsAt: item.startsAt ?? vk?.startsAt ?? null,
      isLive: vk?.isLive ?? item.isLive,
    };
  });
  const manualKeys = new Set(manual.map((item) => vkKey(item.videoUrl)).filter(Boolean));
  return [...manualItems, ...automatic.filter((item) => !manualKeys.has(vkKey(item.videoUrl)))]
    .sort((a, b) => Number(b.isLive) - Number(a.isLive)
      || (b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0))
    .slice(0, limit);
}
