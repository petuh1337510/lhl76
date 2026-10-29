import { notFound } from "next/navigation";
import { getTeamProfile } from "@/lib/team-profile";
import { TeamProfileClient } from "./team-profile-client";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await getTeamProfile(slug);
  if (!team) notFound();
  return <TeamProfileClient team={team} />;
}
import {entityMetadata} from '@/lib/entity-metadata';
export async function generateMetadata({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){return entityMetadata('team',decodeURIComponent((await params).slug),await searchParams);}
