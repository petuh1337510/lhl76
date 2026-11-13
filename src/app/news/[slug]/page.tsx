import { NewsVideo } from "@/components/news-video";
import { PublicImage } from "@/components/public-image";
import Link from "next/link";
import { PublicReturnLink } from "@/components/public-return-link";
import { notFound } from "next/navigation";

import { PublicSiteFooter, PublicSiteHeader } from "@/components/public-site-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const publishedDate = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(value)
    : "";

function galleryItems(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default async function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const article = await prisma.news.findFirst({ where: { slug: decodedSlug, isPublished: true } });
  if (!article) notFound();

  const gallery = galleryItems(article.gallery);
  const related = await prisma.news.findMany({
    where: { isPublished: true, id: { not: article.id } },
    orderBy: { publishedAt: "desc" },
    take: 3,
  });

  return (
    <>
      <PublicSiteHeader />
      <main className="newsArticlePage">
        <article>
          <header className="newsArticleHeader shell">
            <PublicReturnLink fallback="/news">← Все новости</PublicReturnLink>
            <div>
              <span>{article.category}</span>
              <time>{publishedDate(article.publishedAt)}</time>
            </div>
            <h1>{article.title}</h1>
            {article.excerpt ? <p>{article.excerpt}</p> : null}
          </header>

          {article.imageUrl && !article.videoUrl ? (
            <div className="newsArticleCover shell">
              <PublicImage priority width={1280} height={720} sizes="(max-width: 1000px) 92vw, 1180px" src={article.imageUrl} alt={article.title} />
            </div>
          ) : null}

          <div className="newsArticleBody shell">
            {article.body ? (
              article.body.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)
            ) : (
              <p>{article.excerpt}</p>
            )}
          </div>

          {article.videoUrl ? <section className="newsArticleMedia shell">
            <div className="newsArticleSectionTitle"><span>ВИДЕО</span><h2>Смотреть</h2></div>
            <NewsVideo source={article.videoUrl} title={article.title} poster={article.imageUrl} />
          </section> : null}
          {gallery.length ? (
            <section className="newsArticleMedia shell">
              <div className="newsArticleSectionTitle">
                <span>ФОТОРЕПОРТАЖ</span>
                <h2>Фотографии</h2>
              </div>
              <div className="newsArticleGallery">
                {gallery.map((image, index) => (
                  <a href={localMediaUrl(image)} target="_blank" rel="noreferrer" key={`${image}-${index}`}>
                    <PublicImage width={960} height={540} sizes="(max-width: 600px) 92vw, (max-width: 1000px) 45vw, 640px" src={image} alt={`${article.title}: фотография ${index + 1}`} />
                  </a>
                ))}
              </div>
            </section>
          ) : null}

        </article>

        {related.length ? (
          <section className="newsRelated shell">
            <div className="newsArticleSectionTitle">
              <span>ЕЩЁ В ЛИГЕ</span>
              <h2>Последние новости</h2>
            </div>
            <div className="newsRelatedGrid">
              {related.map((item) => (
                <Link href={`/news/${item.slug}`} key={item.id}>
                  {item.imageUrl ? <PublicImage width={960} height={540} sizes="(max-width: 600px) 92vw, (max-width: 1000px) 45vw, 640px" direct={Boolean(item.videoUrl)} src={item.imageUrl} alt="" /> : <div>ЛХЛ-76</div>}
                  {item.videoUrl ? <span>▶ Видео</span> : null}<time>{publishedDate(item.publishedAt)}</time>
                  <h3>{item.title}</h3>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <PublicSiteFooter />
    </>
  );
}
import {entityMetadata} from '@/lib/entity-metadata';
export async function generateMetadata({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){return entityMetadata('news',decodeURIComponent((await params).slug),await searchParams);}
import {localMediaUrl} from '@/lib/local-media';
