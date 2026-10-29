import "server-only";

import { getDivisionPage } from "@/lib/division-page";
import { getPublicSiteContext } from "@/lib/public-site-context";
import { getPublicBroadcasts } from "@/lib/public-broadcasts";
import { getHomeEditorial } from "@/lib/home-editorial";

export async function getHomeSummary(liveOnly = false) {
  const context = await getPublicSiteContext();
  if (!context) return null;

  const [divisions, broadcasts, editorial] = await Promise.all([
    Promise.all(context.divisions.map(async (division) => {
      const data = await getDivisionPage(
        context.season.slug,
        context.championship.path,
        division.slug,
      );
      return data
        ? {
            ...division,
            teams: data.teams,
            leaders: data.statistics,
          }
        : { ...division, teams: [], leaders: [] };
    })),
    getPublicBroadcasts(4),
    liveOnly ? Promise.resolve(null) : getHomeEditorial(),
  ]);

  return { context, divisions, broadcasts, ...editorial };
}
