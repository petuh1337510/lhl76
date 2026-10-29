import { withAdmin } from "@/lib/admin-guard";
import {randomBytes} from "crypto";
import {NextRequest,NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {resolveVideoPreview} from "@/lib/video-preview";
const slug=(v:string)=>`${v.toLowerCase().replace(/[^a-zа-яё0-9]+/gi,"-").replace(/^-|-$/g,"")}-${randomBytes(3).toString("hex")}`;
export const dynamic="force-dynamic";
async function handleGET(){return NextResponse.json({items:await prisma.broadcast.findMany({orderBy:[{isLive:"desc"},{startsAt:"desc"},{createdAt:"desc"}]})})}
async function handlePOST(request:NextRequest){const x=await request.json(),title=String(x.title??"").trim(),videoUrl=String(x.videoUrl??"").trim();if(!title||!videoUrl)return NextResponse.json({error:"Укажите название и ссылку на видео"},{status:400});const imageUrl=String(x.imageUrl??"").trim()||await resolveVideoPreview(videoUrl);const item=await prisma.broadcast.create({data:{slug:slug(title),title,videoUrl,description:String(x.description??"").trim()||null,imageUrl,startsAt:x.startsAt?new Date(x.startsAt):null,isLive:Boolean(x.isLive),isPublished:Boolean(x.isPublished),publishedAt:x.isPublished?new Date():null}});return NextResponse.json({item},{status:201})}
async function handlePATCH(request:NextRequest){const x=await request.json(),id=String(x.id??""),old=await prisma.broadcast.findUnique({where:{id}});if(!old)return NextResponse.json({error:"Трансляция не найдена"},{status:404});const published=x.isPublished===undefined?old.isPublished:Boolean(x.isPublished),videoUrl=String(x.videoUrl??old.videoUrl).trim();const imageUrl=String(x.imageUrl??old.imageUrl??"").trim()||await resolveVideoPreview(videoUrl);const item=await prisma.broadcast.update({where:{id},data:{title:String(x.title??old.title).trim(),videoUrl,description:String(x.description??old.description??"").trim()||null,imageUrl:imageUrl||null,startsAt:x.startsAt?new Date(x.startsAt):old.startsAt,isLive:x.isLive===undefined?old.isLive:Boolean(x.isLive),isPublished:published,publishedAt:published?old.publishedAt??new Date():null}});return NextResponse.json({item})}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
export const PATCH = withAdmin(handlePATCH);
