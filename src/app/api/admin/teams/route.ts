import { withAdmin } from "@/lib/admin-guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {createOnce} from "@/lib/create-once";

async function handleGET(request: NextRequest) {
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
  const pageSize = 25;
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const where = { deletedAt: null, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { city: { contains: search, mode: "insensitive" as const } }] } : {}) };
  const [total, teams] = await prisma.$transaction([
    prisma.team.count({ where }),
    prisma.team.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, slug: true, name: true, shortName: true, city: true, logoUrl: true, _count: { select: { entries: true } } } }),
  ]);
  return NextResponse.json({ page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)), items: teams });
}

function slugify(value: string) {
  const map: Record<string,string> = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
  return value.toLowerCase().split("").map(char=>map[char]??char).join("").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "team";
}

async function handlePOST(request: NextRequest) {
  const body = await request.json();
  if (!body.name?.trim()) return NextResponse.json({ error: "Укажите название команды" }, { status: 400 });
  const base = slugify(body.name), shortName = body.shortName?.trim() || body.name.trim();
  const team=await createOnce('team',request.headers.get('Idempotency-Key'),body,async tx=>{
  let slug = base, index = 2;
  while (await tx.team.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${index++}`;
  const created = await tx.team.create({ data: { slug, name: body.name.trim(), shortName, city: body.city?.trim() || null } });
  return created;
  });
  return NextResponse.json(team, { status: 201 });
}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
