import {NextResponse} from "next/server";
import {currentSession} from "@/lib/auth";
export async function GET(){const user=await currentSession();return NextResponse.json({user},{status:user?200:401,headers:{'Cache-Control':'private, no-store'}});}
