import { AlbumViewer } from "../album-viewer";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicSiteFooter, PublicSiteHeader } from "@/components/public-site-header";
import { getPublicMediaAlbum } from "@/lib/public-media";

export const dynamic = "force-dynamic";

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const album = await getPublicMediaAlbum(decodeURIComponent(slug));
  if (!album) notFound();
  return <>
    <PublicSiteHeader />
    <main className="albumPage">
      <header className="shell"><Link href="/media">← Все альбомы</Link><span>{album.eventDate?.toLocaleDateString("ru-RU")}</span><h1>{album.title}</h1><p>{album.description}</p></header>
      {album.vkUrl ? <div className="shell"><a href={album.vkUrl} target="_blank" rel="noreferrer">Открыть в VK ↗</a></div> : null}
      <AlbumViewer photos={album.photos} title={album.title} direct={Boolean(album.vkUrl)} error={album.vkError} />
    </main>
    <PublicSiteFooter />
  </>;
}
import {entityMetadata} from '@/lib/entity-metadata';
export async function generateMetadata({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){return entityMetadata('media',decodeURIComponent((await params).slug),await searchParams);}
