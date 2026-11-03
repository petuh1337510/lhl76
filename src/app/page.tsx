import Home from "@/components/home-page-client";
import { GET as getMatches } from "@/app/api/public/home-matches/route";
import { getHomeSummary } from "@/lib/public-home-summary";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Reuse public queries without a self-HTTP request or persistent score cache.
  const [initialMatches, initialSummary] = await Promise.all([
    getMatches().then((response) => response.json()),
    getHomeSummary().then((summary) => JSON.parse(JSON.stringify(summary))),
  ]);
  return <Home initialMatches={initialMatches} initialSummary={initialSummary} initialNow={new Date().toISOString()} />;
}
