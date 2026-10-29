import { notFound } from "next/navigation";
import { getDivisionPage } from "@/lib/division-page";
import { DivisionPageClient } from "./division-page-client";
import {cache} from 'react';
import {pageMetadata,contextualPath} from '@/lib/seo';
const load=cache(getDivisionPage);
export async function generateMetadata({params,searchParams}:{params:Promise<{season:string;competition:string;division:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const p=await params;const data=await load(p.season,p.competition,p.division);if(!data)return {title:'Соревнование не найдено',robots:{index:false}};
 const title=`${data.division.name} · ${data.competition.name} · ${data.season.name}`;
 return pageMetadata(title,title+': таблица, календарь, результаты и статистика игроков.',contextualPath(`/competition/${p.season}/${p.competition}/${p.division}`,await searchParams,['tab','category','stats','view']));
}

export const dynamic = "force-dynamic";

export default async function CompetitionDivisionPage({ params }: {
  params: Promise<{ season: string; competition: string; division: string }>;
}) {
  const route = await params;
  const data = await load(route.season, route.competition, route.division);
  if (!data) notFound();
  return <DivisionPageClient data={data} />;
}
