import { withAdmin } from "@/lib/admin-guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateHomeEditorial } from "@/lib/home-editorial";

const text = (value: unknown) => String(value ?? "").trim();
async function handleGET() { return NextResponse.json({ items: await prisma.laureate.findMany({ orderBy:[{sortOrder:"asc"},{createdAt:"asc"}] }) }); }
async function handlePOST(request: NextRequest) {
  const body = await request.json();
  if (!text(body.name) || !text(body.title)) return NextResponse.json({error:"Укажите имя и название награды"},{status:400});
  const item = await prisma.laureate.create({data:{category:text(body.category)||"Лауреаты сезона",title:text(body.title),name:text(body.name),teamName:text(body.teamName)||null,season:text(body.season)||null,imageUrl:text(body.imageUrl)||null,link:text(body.link)||null,active:Boolean(body.active),sortOrder:Number(body.sortOrder)||0}});
  invalidateHomeEditorial();
  return NextResponse.json({item});
}
async function handlePATCH(request: NextRequest) {
  const body = await request.json(); const id=text(body.id); if(!id)return NextResponse.json({error:"Лауреат не выбран"},{status:400});
  const item=await prisma.laureate.update({where:{id},data:{category:text(body.category)||"Лауреаты сезона",title:text(body.title),name:text(body.name),teamName:text(body.teamName)||null,season:text(body.season)||null,imageUrl:text(body.imageUrl)||null,link:text(body.link)||null,active:Boolean(body.active),sortOrder:Number(body.sortOrder)||0}});
  invalidateHomeEditorial();
  return NextResponse.json({item});
}
async function handleDELETE(request:NextRequest){const id=request.nextUrl.searchParams.get("id");if(!id)return NextResponse.json({error:"Лауреат не выбран"},{status:400});await prisma.laureate.delete({where:{id}});invalidateHomeEditorial();return NextResponse.json({ok:true});}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
export const PATCH = withAdmin(handlePATCH);
export const DELETE = withAdmin(handleDELETE);
