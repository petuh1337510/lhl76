import { notFound } from "next/navigation";
import { getTeamProfile } from "@/lib/team-profile";
import { TeamRosterPrintClient } from "./team-roster-print-client";

export const dynamic = "force-dynamic";
export const metadata={title:'Печатный состав — ЛХЛ-76',robots:{index:false,follow:true},alternates:{canonical:null}};

export default async function TeamRosterPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ competition?: string; preview?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const team = await getTeamProfile(slug);
  if (!team) notFound();
  const competition = team.competitions.find((item) => item.id === query.competition) ?? team.competitions[0];
  if (!competition) notFound();
  return <TeamRosterPrintClient team={team} competition={competition} preview={query.preview === "1"} />;
}
