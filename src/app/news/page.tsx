import { PublicImage } from "@/components/public-image";
import Link from "next/link";
import { withReturn } from "@/lib/public-navigation";

import { PublicSiteFooter, PublicSiteHeader } from "@/components/public-site-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const date = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(value)
    : "";

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const news = await prisma.news.findMany({
    where: {
      isPublished: true,
      ...(category ? { category } : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
  });
  const categories = await prisma.news.findMany({
    where: { isPublished: true },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });

  return (
    <>
      <PublicSiteHeader />
      <main className="publicNewsPage">
        <section className="publicNewsHero">
          <div className="shell">
            <span>ЛХЛ-76 · МЕДИАЦЕНТР</span>
            <h1>НОВОСТИ ЛИГИ</h1>
            <p>Матчи, команды, турниры и главные события хоккейного сообщества.</p>
          </div>
        </section>

        <section className="shell publicNewsContent">
          <nav className="publicNewsFilters" aria-label="Категории новостей">
            <Link aria-current={!category ? "page" : undefined} className={!category ? "active" : ""} href="/news">
              Все материалы
            </Link>
            {categories.map((item) => (
              <Link
                className={category === item.category ? "active" : ""}
                aria-current={category === item.category ? "page" : undefined}
                href={`/news?category=${encodeURIComponent(item.category)}`}
                key={item.category}
              >
                {item.category}
              </Link>
            ))}
          </nav>

          {news.length ? (
            <div className="publicNewsGrid">
              {news.map((item, index) => (
                <Link
                  className={`publicNewsCard ${index === 0 && !category ? "featured" : ""}`}
                  href={withReturn(`/news/${item.slug}`, category ? `/news?category=${encodeURIComponent(category)}` : "/news")}
                  key={item.id}
                >
                  <div className="publicNewsCardImage">
                    {item.imageUrl ? <PublicImage width={960} height={540} sizes="(max-width: 600px) 92vw, (max-width: 1000px) 45vw, 640px" src={item.imageUrl} alt="" /> : <b>ЛХЛ-76</b>}
                    <span>{item.category}</span>
                  </div>
                  <div className="publicNewsCardBody">
                    <time>{date(item.publishedAt)}</time>
                    <h2>{item.title}</h2>
                    <p>{item.excerpt}</p>
                    <strong>Читать материал <i>→</i></strong>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="publicNewsEmpty">
              <b>Материалов пока нет</b>
              <p>{category ? "В этой категории ещё не опубликовано ни одной новости." : "Опубликованные новости лиги появятся здесь."}</p>
              {category ? <Link href="/news">Показать все новости</Link> : null}
            </div>
          )}
        </section>
      </main>
      <PublicSiteFooter />
    </>
  );
}
import {pageMetadata,contextualPath} from '@/lib/seo';
export async function generateMetadata({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const p=await searchParams;const category=typeof p.category==='string'?p.category.slice(0,80):'';return pageMetadata(category?'Новости: '+category:'Новости','Новости лиги, команд и соревнований ЛХЛ-76.',contextualPath('/news',p,['category']));}
