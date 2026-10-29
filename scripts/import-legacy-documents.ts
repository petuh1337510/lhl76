import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const base = "https://lhl-76.ru/wp-content/uploads";
const documents = [
  { title: "Регламент Чемпионата ЛХЛ-76 сезон 2026-27", category: "Чемпионат 2026/27", source: "2026/09/reglament-lhl-76-chempionat-26-27-1.docx" },
  { title: "Согласие команды с Регламентом Чемпионата", category: "Командам", source: "2026/09/soglasie-s-reglamentom-26-27.docx" },
  { title: "Заявочный лист команды", category: "Командам", source: "2026/09/zayavochnyj-list-komandy-na-sezon-26-27-111-1.docx" },
  { title: "Требования к заявочной документации", category: "Командам", source: "2026/09/trebovaniya-k-zayavochnoj-dokumentaczii.docx" },
  { title: "Регламент турнира «Памяти Локомотива 2011» 2026 г.", category: "Турниры", source: "2026/08/turnir-pamyati-lokomotiva-26-reglament-1-1.docx" },
  { title: "Официальный протокол матча", category: "Формы и правила", source: "2023/08/ficzialnyj-protokol-matcha.doc" },
  { title: "Согласие родителей ребёнка до 18 лет (нотариально)", category: "Командам", source: "2023/08/soglasie-roditelej-rebenka-do-18-let-notarialno-.pdf" },
  { title: "Таблица штрафов", category: "Формы и правила", source: "2025/11/tablicza-shtrafov-2023-1.xlsx" },
  { title: "Устав АНО «Клуб Любитель 76»", category: "О лиге", source: "2023/08/ustav-ano-klub-lyubitel-76.pdf" },
  { title: "Руководство по судейству соревнований", category: "Формы и правила", source: "2023/08/rukovodstvo-po-sudejstvu-sorevnovanij.pdf" },
] as const;

async function main() {
  const directory = path.join(process.cwd(), "public", "documents", "legacy");
  await mkdir(directory, { recursive: true });
  for (const [index, document] of documents.entries()) {
    const filename = path.basename(document.source);
    const response = await fetch(`${base}/${document.source}`);
    if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 100) throw new Error(`${filename}: файл выглядит пустым`);
    await writeFile(path.join(directory, filename), bytes);
    const fileUrl = `/documents/legacy/${filename}`;
    const existing = await prisma.document.findFirst({
      where: { OR: [{ fileUrl }, { title: document.title }] },
    });
    const data = {
      title: document.title,
      category: document.category,
      fileUrl,
      publishedAt: existing?.publishedAt ?? new Date(Date.now() - index * 1000),
    };
    if (existing) await prisma.document.update({ where: { id: existing.id }, data });
    else await prisma.document.create({ data });
    console.log(`${index + 1}/${documents.length} ${filename} (${bytes.length} байт)`);
  }
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
