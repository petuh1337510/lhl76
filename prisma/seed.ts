import { CompetitionType, PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const slugify = (value: string) => value
  .toLowerCase()
  .replaceAll(" ", "-")
  .replaceAll("+", "plus");

async function main() {
  const season = await db.season.upsert({
    where: { slug: "2026-27" },
    update: {},
    create: {
      name: "2026/27",
      slug: "2026-27",
      startsAt: new Date("2026-09-01"),
      endsAt: new Date("2027-05-31"),
      isActive: true,
    },
  });

  const championship = await db.competition.upsert({
    where: { seasonId_slug: { seasonId: season.id, slug: "championship-lhl-76" } },
    update: {},
    create: {
      seasonId: season.id,
      name: "Чемпионат ЛХЛ-76",
      slug: "championship-lhl-76",
      type: CompetitionType.CHAMPIONSHIP,
      isActive: true,
      rules: {
        points: { win: 2, draw: 1, loss: 0 },
        standingsStage: "GROUP_STAGE",
        tieBreakers: [
          "HEAD_TO_HEAD_POINTS",
          "TOTAL_GOAL_DIFFERENCE",
          "HEAD_TO_HEAD_GOAL_DIFFERENCE",
          "TOTAL_GOALS_FOR",
          "TOTAL_WINS",
          "LEAST_PENALTY_MINUTES",
        ],
      },
    },
  });

  for (const [sortOrder, name] of ["Дебют", "Старт", "Любитель", "Любитель Plus"].entries()) {
    const slug = slugify(name);
    await db.division.upsert({
      where: { competitionId_slug: { competitionId: championship.id, slug } },
      update: {},
      create: { competitionId: championship.id, name, slug, sortOrder },
    });
  }

  for (const [sortOrder, name] of ["1", "1+", "2", "2+", "2+*", "3", "3>", "3+", "3+*", "4"].entries()) {
    await db.classificationCategory.upsert({
      where: { name },
      update: {},
      create: { name, level: sortOrder + 1, sortOrder },
    });
  }

  console.log("Тестовая структура сезона, чемпионата и дивизионов загружена.");
}

main().finally(() => db.$disconnect());
