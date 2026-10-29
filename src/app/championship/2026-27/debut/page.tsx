import { redirect } from "next/navigation";

export default async function LegacyDebutPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const query = await searchParams;
  const tab = query.tab === "calendar" || query.tab === "statistics" ? `?tab=${query.tab}` : "";
  redirect(`/competition/2026-27/championship/debyut${tab}`);
}
