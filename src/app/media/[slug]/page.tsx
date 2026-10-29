import { PublicImage } from "@/components/public-image";
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
      <section className="shell albumPhotos">{album.photos.map((photo, index) =>
        <a href={localMediaUrl(photo)} target="_blank" rel="noreferrer" key={`${photo}-${index}`}>
          <PublicImage width={960} height={540} sizes="(max-width: 600px) 92vw, (max-width: 1000px) 45vw, 640px" src={photo} alt={`${album.title}: фото ${index + 1}`} loading="lazy" />
        </a>
      )}</section>
    </main>
    <PublicSiteFooter />
  </>;
}
import {entityMetadata} from '@/lib/entity-metadata';
export async function generateMetadata({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){return entityMetadata('media',decodeURIComponent((await params).slug),await searchParams);}
import {localMediaUrl} from '@/lib/local-media';
