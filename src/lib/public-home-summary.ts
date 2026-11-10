import "server-only";

import { getHomeDivisionSummary } from "@/lib/home-division-summary";
import { getPublicSiteContext } from "@/lib/public-site-context";
import { getPublicBroadcasts } from "@/lib/public-broadcasts";
import { getHomeEditorial } from "@/lib/home-editorial";

export async function getHomeSummary(liveOnly = false) {
  if (liveOnly) return { broadcasts: await getPublicBroadcasts(4), serverTime: Date.now() };
  const context = await getPublicSiteContext();
  if (!context) return null;

  const [divisions, broadcasts, editorial] = await Promise.all([
    Promise.all(context.divisions.map(async (division) => {
      const data = await getHomeDivisionSummary(division.id);
      return { ...division, ...data };
    })),
    getPublicBroadcasts(4),
    getHomeEditorial(),
  ]);

  return { context, divisions, broadcasts, ...editorial, serverTime: Date.now() };
}
