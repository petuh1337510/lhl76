import { AlbumImage } from "@/components/album-image";
import Link from "next/link";

import { PublicSiteFooter, PublicSiteHeader } from "@/components/public-site-header";
import { getPublicMediaAlbums } from "@/lib/public-media";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const albums = await getPublicMediaAlbums();
  return <>
    <PublicSiteHeader />
    <main className="publicMedia">
      <section className="mediaHero"><div className="shell"><span>ЛХЛ-76 · ФОТО</span><h1>ФОТО</h1><p>Матчи, турниры и жизнь хоккейного сообщества в фотографиях.</p></div></section>
      <section className="shell mediaAlbums">
        {albums.length ? albums.map((album, index) =>
          <Link href={`/media/${album.slug}`} className={index === 0 ? "featured" : ""} key={album.id}>
            <div>{album.coverUrl ? <AlbumImage retry={false} src={album.coverUrl} alt="" direct={Boolean(album.vkUrl)} /> : <b>ЛХЛ-76</b>}<span>{album.photos.length} ФОТО</span></div>
            <time>{album.eventDate?.toLocaleDateString("ru-RU")}</time>
            <h2>{album.title}</h2><p>{album.description}</p>
          </Link>
        ) : <div className="publicNewsEmpty"><b>Альбомов пока нет</b><p>Опубликованные фоторепортажи появятся здесь.</p></div>}
      </section>
    </main>
    <PublicSiteFooter />
  </>;
}
import {pageMetadata} from '@/lib/seo';
export const metadata=pageMetadata('Фото','Фотографии матчей, турниров и событий ЛХЛ-76.','/media');
