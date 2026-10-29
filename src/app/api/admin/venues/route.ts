import { withAdmin } from "@/lib/admin-guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const text=(value:unknown)=>String(value??"").trim();
const slugify=(value:string)=>value.toLowerCase().replace(/ё/g,"е").split("").map((char)=>({а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya"} as Record<string,string>)[char]??char).join("").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"arena";
async function uniqueSlug(name:string,currentId?:string){const base=slugify(name);let slug=base,index=2;while(await prisma.venue.findFirst({where:{slug,...(currentId?{id:{not:currentId}}:{})},select:{id:true}}))slug=`${base}-${index++}`;return slug;}
async function handleGET(){const items=await prisma.venue.findMany({orderBy:[{city:"asc"},{name:"asc"}],include:{_count:{select:{matches:true}}}});return NextResponse.json({items});}
async function handlePOST(request:NextRequest){const body=await request.json(),name=text(body.name);if(!name)return NextResponse.json({error:"Укажите название стадиона"},{status:400});const item=await prisma.venue.create({data:{slug:await uniqueSlug(name),name,address:text(body.address)||null,city:text(body.city)||null,description:text(body.description)||null,imageUrl:text(body.imageUrl)||null,mapUrl:text(body.mapUrl)||null,active:Boolean(body.active)}});return NextResponse.json({item});}
async function handlePATCH(request:NextRequest){const body=await request.json(),id=text(body.id),name=text(body.name);if(!id||!name)return NextResponse.json({error:"Укажите название стадиона"},{status:400});const item=await prisma.venue.update({where:{id},data:{slug:await uniqueSlug(name,id),name,address:text(body.address)||null,city:text(body.city)||null,description:text(body.description)||null,imageUrl:text(body.imageUrl)||null,mapUrl:text(body.mapUrl)||null,active:Boolean(body.active)}});return NextResponse.json({item});}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
export const PATCH = withAdmin(handlePATCH);
