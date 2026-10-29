import { notFound, redirect } from "next/navigation";

import { getPublicSiteContext } from "@/lib/public-site-context";

export const dynamic = "force-dynamic";

export default async function CurrentChampionshipPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [context, query] = await Promise.all([getPublicSiteContext(), searchParams]);
  if (!context) notFound();
  const tab = query.tab === "calendar" || query.tab === "statistics" ? `?tab=${query.tab}` : "";
  redirect(`${context.championshipHref}${tab}`);
}
