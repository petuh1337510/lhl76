import { PublicSiteFooter, PublicSiteHeader } from "@/components/public-site-header";
import { VK_CHANNEL_URL } from "@/lib/integrations/vk-video";
import { getPublicBroadcasts } from "@/lib/public-broadcasts";
import { BroadcastList } from "./broadcast-list";
export const dynamic = "force-dynamic";
export default async function Broadcasts({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const query = await searchParams;
  const filter = ["live", "archive", "upcoming"].includes(query.filter ?? "") ? query.filter! : "all";
  const broadcasts = await getPublicBroadcasts(1000);
  return <><PublicSiteHeader /><main className="publicBroadcasts">
    <section className="broadcastHero"><div className="shell"><span>ЛХЛ-76 · ВИДЕО</span><h1>ТРАНСЛЯЦИИ</h1><p>Прямые эфиры и записи матчей любительской хоккейной лиги.</p></div></section>
    <section className="shell broadcastContent"><BroadcastList initialItems={broadcasts} filter={filter} channelUrl={VK_CHANNEL_URL} serverTime={Date.now()} /></section>
  </main><PublicSiteFooter /></>;
}
import {pageMetadata} from '@/lib/seo';
export const metadata=pageMetadata('Трансляции','Видеотрансляции и записи матчей ЛХЛ-76.','/broadcasts');
