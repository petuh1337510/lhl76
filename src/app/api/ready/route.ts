import {prisma} from '@/lib/prisma';
import {authSecret} from '@/lib/security-policy';
import {publicOrigin} from '@/lib/seo';
export const dynamic='force-dynamic';
export async function GET(){
 try{authSecret();if(process.env.NODE_ENV==='production'&&!publicOrigin())throw new Error('Configuration');await prisma.$queryRaw`SELECT 1`;return Response.json({status:'ready'},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
