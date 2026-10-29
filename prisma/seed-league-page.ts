import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const people = [
  {
    id: "league-alekseev-igor",
    name: "Алексеев Игорь Михайлович",
    role: "Почётный президент ЛХЛ Ярославской области",
    description: "Заслуженный тренер РФ, заслуженный работник физической культуры и спорта России.",
    photoUrl: "/images/league/alekseev-igor.jpg",
  },
  {
    id: "league-suvorin-eduard",
    name: "Суворин Эдуард Витальевич",
    role: "Почётный куратор ЛХЛ-76",
    description: "Председатель регионального отделения ДОСААФ России Ярославской области, подполковник запаса ВС РФ.",
    photoUrl: "/images/league/suvorin.png",
  },
  {
    id: "league-kudryavtsev-sergey",
    name: "Кудрявцев Сергей Павлович",
    role: "Почётный куратор ЛХЛ-76",
    description: "Полковник МВД РФ, участник боевых действий, кавалер ордена Мужества.",
    photoUrl: "/images/league/kudryavtsev.jpg",
  },
  {
    id: "league-alekseev-eduard",
    name: "Алексеев Эдуард Игоревич",
    role: "Ответственный организатор матчей",
    description: "АНО ЯЦРС «Клуб Любитель-76».",
    photoUrl: "/images/league/alekseev-eduard.png",
  },
  {
    id: "league-bukovskiy-andrey",
    name: "Буковский Андрей",
    role: "Руководитель SMM-отдела",
    description: "Куратор дивизиона «Любитель Плюс».",
    photoUrl: "/images/league/bukovskiy.jpg",
  },
  {
    id: "league-glamazdin-maksim",
    name: "Гламаздин Максим",
    role: "Куратор дивизиона «Любитель»",
    description: null,
    photoUrl: "/images/league/glamazdin.jpg",
  },
  {
    id: "league-grebenshchikova-marina",
    name: "Гребенщикова Марина Алексеевна",
    role: "Специалист по правовым вопросам",
    description: null,
    photoUrl: "/images/league/grebenshchikova.jpg",
  },
  {
    id: "league-orlov-dmitriy",
    name: "Орлов Дмитрий",
    role: "Видеооператор трансляций",
    description: "Онлайн-трансляции матчей ЛХЛ-76.",
    photoUrl: "/images/league/orlov.jpg",
  },
  {
    id: "league-matveev-andrey",
    name: "Матвеев Андрей",
    role: "Комментатор матчей ЛХЛ-76",
    description: null,
    photoUrl: "/images/league/matveev.png",
  },
] as const;

async function main() {
  await db.leaguePage.upsert({
    where: { id: "about" },
    update: {},
    create: {
      id: "about",
      headline: "Хоккей объединяет Ярославль.",
      intro: "ЛХЛ-76 — любительская хоккейная лига, в которой команды встречаются на льду, болельщики находят своих героев, а люди за кадром делают каждый матч возможным.",
    },
  });

  for (const [index, person] of people.entries()) {
    await db.leaguePerson.upsert({
      where: { id: person.id },
      update: {},
      create: { ...person, active: true, sortOrder: index + 1 },
    });
  }

  console.log(`Страница «О лиге» готова: ${people.length} карточек.`);
}

main().finally(() => db.$disconnect());
