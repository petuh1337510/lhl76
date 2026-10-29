import { PublicImage } from "@/components/public-image";
import {safeHref} from '@/lib/editorial-url';
import Link from "next/link";

import { PublicSiteHeader } from "@/components/public-site-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LaureatesPage() {
  const laureates = await prisma.laureate.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return <>
    <PublicSiteHeader />
    <main className="leagueCatalog">
      <section className="leagueCatalogHero"><div className="leagueCatalogShell">
        <span>ЛХЛ-76 · ЯРОСЛАВЛЬ</span>
        <h1>ЛАУРЕАТЫ ЛИГИ</h1>
        <p>Игроки и команды, отмеченные наградами ЛХЛ-76.</p>
      </div></section>
      <div className="leagueCatalogShell leagueCatalogBody">
        {laureates.length ? <div className="leagueLaureateGrid">{laureates.map((item) => {
          const content = <>
            <div>{item.imageUrl ? <PublicImage width={960} height={540} sizes="(max-width: 600px) 92vw, (max-width: 1000px) 45vw, 640px" src={item.imageUrl} alt="" /> : <span>{item.name.slice(0, 1)}</span>}<i>★</i></div>
            <small>{item.category}{item.season ? ` · ${item.season}` : ""}</small>
            <h2>{item.name}</h2>
            <b>{item.title}</b>
            {item.teamName ? <p>{item.teamName}</p> : null}
          </>;
          return item.link
            ? <Link className="homeLaureateCard" href={safeHref(item.link)} key={item.id}>{content}</Link>
            : <article className="homeLaureateCard" key={item.id}>{content}</article>;
        })}</div> : <div className="publicNewsEmpty"><b>Лауреаты пока не опубликованы</b><p>Награды и имена появятся здесь после публикации.</p></div>}
      </div>
    </main>
  </>;
}
import {pageMetadata} from '@/lib/seo';
export const metadata=pageMetadata('Лауреаты лиги','Опубликованные награды и лауреаты ЛХЛ-76.','/laureates');
