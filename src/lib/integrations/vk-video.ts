import { unstable_cache } from "next/cache";

export const VK_CHANNEL_URL = process.env.VK_VIDEO_CHANNEL_URL || "https://vkvideo.ru/@lhl76/lives";

export type VkBroadcast = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  videoUrl: string;
  imageUrl: string | null;
  startsAt: Date | null;
  isLive: boolean;
};

type VkVideo = {
  id?: number;
  owner_id?: number;
  title?: string;
  description?: string;
  date?: number;
  live_start_time?: number;
  live?: number | boolean;
  upcoming?: number | boolean;
  image?: Array<{ url?: string; width?: number }>;
};

type VkApiResult<T> = { response?: T; error?: { error_code: number; error_msg: string } };

export function normalizeVkVideos(videos: VkVideo[]): VkBroadcast[] {
  return videos.flatMap((video) => {
    if (!Number.isInteger(video.id) || !Number.isInteger(video.owner_id) || !video.title) return [];
    if (video.upcoming) return [];
    const isLive = Boolean(video.live);
    const ownerId = video.owner_id!;
    const videoId = video.id!;
    const image = video.image?.filter((item) => item.url?.startsWith("https://"))
      .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null;
    const timestamp = video.live_start_time || video.date;
    return [{
      id: `vk-${ownerId}_${videoId}`,
      slug: `vk-${ownerId}_${videoId}`,
      title: video.title,
      description: video.description?.trim() || null,
      videoUrl: `https://vkvideo.ru/${isLive ? "live" : "video"}${ownerId}_${videoId}`,
      imageUrl: image,
      startsAt: timestamp && Number.isFinite(timestamp) ? new Date(timestamp * 1000) : null,
      isLive,
    }];
  });
}

async function vkMethod<T>(method: string, params: Record<string, string>, token: string): Promise<T> {
  const response = await fetch(`https://api.vk.com/method/${method}`, {
    method: "POST",
    redirect: "error",
    body: new URLSearchParams({ ...params, access_token: token, v: "5.199" }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`VK API: HTTP ${response.status}`);
  const result = await response.json() as VkApiResult<T>;
  if (result.error) throw new Error(`VK API: ошибка ${result.error.error_code}`);
  if (result.response == null) throw new Error("VK API: пустой ответ");
  return result.response;
}

const cachedBroadcasts = unstable_cache(async (): Promise<VkBroadcast[]> => {
  const token = process.env.VK_API_ACCESS_TOKEN;
  if (!token) return [];
  let ownerId = Number(process.env.VK_VIDEO_OWNER_ID);
  if (!Number.isInteger(ownerId) || ownerId === 0) {
    const screenName = new URL(VK_CHANNEL_URL).pathname.match(/^\/@([^/]+)/)?.[1];
    if (!screenName) throw new Error("VK API: укажите ссылку канала вида https://vkvideo.ru/@name/lives");
    const owner = await vkMethod<{ type: string; object_id: number }>(
      "utils.resolveScreenName", { screen_name: screenName }, token,
    );
    if (!owner?.object_id || !["group", "page", "user"].includes(owner.type)) {
      throw new Error(`VK API: не удалось определить владельца канала ${screenName}`);
    }
    ownerId = owner.type === "user" ? owner.object_id : -owner.object_id;
  }
  const videos = await vkMethod<{ items: VkVideo[] }>(
    "video.get", { owner_id: String(ownerId), count: "40" }, token,
  );
  return normalizeVkVideos(videos.items ?? []).slice(0, 24);
}, ["lhl76-vk-broadcasts"], { revalidate: 300 });

export async function getVkBroadcasts(): Promise<VkBroadcast[]> {
  if (!process.env.VK_API_ACCESS_TOKEN) return [];
  try {
    const items = await cachedBroadcasts();
    // Next Data Cache uses JSON: restore dates on every read, including warm hits.
    return items.map(item => {
      const startsAt = item.startsAt ? new Date(item.startsAt) : null;
      return { ...item, startsAt: startsAt && Number.isFinite(startsAt.getTime()) ? startsAt : null };
    });
  } catch (error) {
    console.error("Не удалось загрузить трансляции VK:", error instanceof Error ? error.message : error);
    return [];
  }
}
