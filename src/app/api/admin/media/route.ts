import { withAdmin } from "@/lib/admin-guard";
import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const slugify = (value: string) => `${value.toLowerCase().replace(/[^a-zа-яё0-9]+/gi,"-").replace(/^-|-$/g,"")}-${randomBytes(3).toString("hex")}`;
const photos = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
export const dynamic = "force-dynamic";

async function handleGET(){return NextResponse.json({items:await prisma.mediaAlbum.findMany({orderBy:[{eventDate:"desc"},{createdAt:"desc"}]})});}
async function handlePOST(request:NextRequest){const input=await request.json(),title=String(input.title??"").trim(),images=photos(input.photos);if(!title||!images.length)return NextResponse.json({error:"Укажите название и добавьте фотографии"},{status:400});const item=await prisma.mediaAlbum.create({data:{slug:slugify(title),title,description:String(input.description??"").trim()||null,photos:images,coverUrl:String(input.coverUrl??images[0]),eventDate:input.eventDate?new Date(input.eventDate):null,isPublished:Boolean(input.isPublished),publishedAt:input.isPublished?new Date():null}});return NextResponse.json({item},{status:201});}
async function handlePATCH(request:NextRequest){const input=await request.json(),id=String(input.id??""),current=await prisma.mediaAlbum.findUnique({where:{id}});if(!current)return NextResponse.json({error:"Альбом не найден"},{status:404});const images=photos(input.photos??current.photos),published=input.isPublished===undefined?current.isPublished:Boolean(input.isPublished);const item=await prisma.mediaAlbum.update({where:{id},data:{title:String(input.title??current.title).trim(),description:String(input.description??current.description??"").trim()||null,photos:images,coverUrl:String(input.coverUrl??current.coverUrl??images[0]??"" )||null,eventDate:input.eventDate?new Date(input.eventDate):current.eventDate,isPublished:published,publishedAt:published?current.publishedAt??new Date():null}});return NextResponse.json({item});}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
export const PATCH = withAdmin(handlePATCH);
