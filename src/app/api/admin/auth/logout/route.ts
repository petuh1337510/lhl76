import {NextRequest,NextResponse} from "next/server";
import {clearSessionCookie} from "@/lib/auth";
import {sameOriginMutation} from '@/lib/security-policy';
export async function POST(request:NextRequest){if(!sameOriginMutation(request.headers.get('origin'),request.url,request.headers.get('sec-fetch-site'),request.headers.get('host')))return NextResponse.json({error:'Недопустимый источник запроса'},{status:403});await clearSessionCookie();return NextResponse.json({ok:true});}
