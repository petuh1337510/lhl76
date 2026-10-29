import { withAdmin } from "@/lib/admin-guard";
import {NextRequest,NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {getDataQualityAudit} from "@/lib/data-quality-audit";
async function handleGET(request:NextRequest){
  if(request.nextUrl.searchParams.get("scope")==="data")return NextResponse.json(await getDataQualityAudit({seasonId:request.nextUrl.searchParams.get("seasonId")||undefined,issue:request.nextUrl.searchParams.get("issue")||undefined,page:Number(request.nextUrl.searchParams.get("page"))||1}));
  const page=Math.max(1,Number(request.nextUrl.searchParams.get("page"))||1),take=40,entityType=request.nextUrl.searchParams.get("type")||undefined;const where=entityType?{entityType}:{};const[total,logs]=await prisma.$transaction([prisma.auditLog.count({where}),prisma.auditLog.findMany({where,orderBy:{createdAt:"desc"},skip:(page-1)*take,take})]);const users=await prisma.user.findMany({where:{id:{in:logs.flatMap(item=>item.userId?[item.userId]:[])}},select:{id:true,name:true,email:true}}),userMap=new Map(users.map(user=>[user.id,user]));return NextResponse.json({page,pages:Math.max(1,Math.ceil(total/take)),total,items:logs.map(item=>({...item,user:item.userId?userMap.get(item.userId)??null:null}))});}

export const GET = withAdmin(handleGET);
