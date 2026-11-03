import { PublicImage } from "@/components/public-image";
import Link from "next/link";

import { PublicSiteHeader } from "@/components/public-site-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const fallback = {
  headline: "Хоккей объединяет Ярославль.",
  intro: "ЛХЛ-76 — любительская хоккейная лига, в которой команды встречаются на льду, болельщики находят своих героев, а люди за кадром делают каждый матч возможным.",
};

export default async function AboutPage() {
  const [page, people] = await Promise.all([
    prisma.leaguePage.findUnique({ where: { id: "about" } }),
    prisma.leaguePerson.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <main className="leagueAbout">
      <PublicSiteHeader />
      <section className="leagueAboutHero" aria-labelledby="leagueAboutTitle">
        <div className="leagueAboutWrap leagueAboutHeroInner">
          <span className="leagueAboutEyebrow"><i /> ЛХЛ-76 · ЯРОСЛАВЛЬ</span>
          <h1 id="leagueAboutTitle">{page?.headline || fallback.headline}</h1>
          <p>{page?.intro || fallback.intro}</p>
          <Link href="/championship/current">СМОТРЕТЬ СОРЕВНОВАНИЯ <span aria-hidden="true">↗</span></Link>
        </div>
        <span className="leagueAboutWatermark" aria-hidden="true">76</span>
      </section>

      <section className="leagueAboutPeople" aria-labelledby="leaguePeopleTitle">
        <div className="leagueAboutWrap">
          <header className="leagueAboutSectionHead">
            <h2 id="leaguePeopleTitle">ЛИЦА ЛИГИ</h2>
          </header>
          {people.length ? <div className="leaguePeopleGrid">
            {people.map((person, index) => <article className="leaguePersonCard" key={person.id}>
              <div className="leaguePersonPhoto">
                <PublicImage width={290} height={290} sizes="290px" src={person.photoUrl || "/images/player-placeholder.svg"} alt={person.photoUrl ? person.name : "Фотография не добавлена"} loading={index < 3 ? "eager" : "lazy"} />
              </div>
              <div className="leaguePersonInfo">
                <span className="leaguePersonIndex">{String(index + 1).padStart(2, "0")}</span>
                <h3>{person.name}</h3>
                <strong>{person.role}</strong>
                {person.description ? <p>{person.description}</p> : null}
                {person.phone || person.email ? <div className="leaguePersonContacts">
                  {person.phone ? <a href={`tel:${person.phone.replace(/[^\d+]/g, "")}`}>{person.phone}</a> : null}
                  {person.email ? <a href={`mailto:${person.email}`}>{person.email}</a> : null}
                </div> : null}
              </div>
            </article>)}
          </div> : <p className="leaguePeopleEmpty">Информация о команде лиги скоро появится здесь.</p>}
        </div>
      </section>
    </main>
  );
}
import {pageMetadata} from '@/lib/seo';
export const metadata=pageMetadata('О лиге','Любительская хоккейная лига Ярославля: история, руководство и контакты.','/about');
