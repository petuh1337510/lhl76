import { withAdmin } from "@/lib/admin-guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {createOnce} from "@/lib/create-once";

async function handleGET(request: NextRequest) {
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
  const pageSize = 25;
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const words = search.split(/\s+/).filter(Boolean);
  const where = { deletedAt: null, ...(words.length ? { AND: words.map((word) => ({
    OR: ["lastName", "firstName", "patronymic"].map((field) => ({ [field]: { contains: word, mode: "insensitive" as const } })),
  })) } : {}) };
  const [total, players] = await prisma.$transaction([
    prisma.player.count({ where }),
    prisma.player.findMany({ where, orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { patronymic: "asc" }], skip: (page - 1) * pageSize, take: pageSize, select: { id: true, updatedAt:true, slug: true, firstName: true, lastName: true, patronymic: true, birthDate: true, position: true, photoUrl: true, baseNumber: true, ratingCategoryId: true, _count: { select: { rosterEntries: true } } } }),
  ]);
  return NextResponse.json({ page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)), items: players });
}

function slugify(value: string) {
  const map: Record<string,string> = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
  return value.toLowerCase().split("").map(char=>map[char]??char).join("").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "player";
}

async function handlePOST(request: NextRequest) {
  const body = await request.json();
  if (!body.lastName?.trim() || !body.firstName?.trim()) return NextResponse.json({ error: "Укажите фамилию и имя" }, { status: 400 });
  const ratingCategoryId = String(body.ratingCategoryId ?? "").trim();
  if (ratingCategoryId && !(await prisma.classificationCategory.findFirst({ where: { id: ratingCategoryId, active: true } }))) return NextResponse.json({ error: "Неизвестный рейтинг" }, { status: 400 });
  const base = slugify(`${body.lastName}-${body.firstName}`);
  const player=await createOnce('player',request.headers.get('Idempotency-Key'),body,async tx=>{
  let slug = base, index = 2;
  while (await tx.player.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${index++}`;
  const created = await tx.player.create({ data: { slug, lastName: body.lastName.trim(), firstName: body.firstName.trim(), patronymic: body.patronymic?.trim() || null, nativeName: body.nativeName?.trim() || null, birthDate: body.birthDate ? new Date(body.birthDate) : null, country: body.country?.trim() || null, birthPlace: body.birthPlace?.trim() || null, position: body.position || null, stickHand: body.stickHand || null, heightCm: body.heightCm ? Number(body.heightCm) : null, weightKg: body.weightKg ? Number(body.weightKg) : null, league: body.league?.trim() || null, baseNumber: String(body.baseNumber ?? "").trim() || null, ratingCategoryId: ratingCategoryId || null, photoUrl: body.photoUrl || null, laureatePhotoUrl: body.laureatePhotoUrl || null } });
  return created;
  });
  return NextResponse.json(player, { status: 201 });
}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
