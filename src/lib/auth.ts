import "server-only";
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { authSecret } from "@/lib/security-policy";

const scrypt = promisify(scryptCallback);
export const AUTH_COOKIE = "lhl76_admin";
export type AuthRole = "SUPER_ADMIN" | "ADMIN" | "SECRETARY";
export type AuthSession = { userId:string; email:string; name:string; role:AuthRole; exp:number; revision?:string };
const secret=authSecret;
const b64=(value:string|Buffer)=>Buffer.from(value).toString("base64url");
export async function hashPassword(password:string){const salt=randomBytes(16);const derived=await scrypt(password,salt,64) as Buffer;return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;}
export async function verifyPassword(password:string,stored:string){const[,saltHex,hashHex]=stored.split(":");if(!saltHex||!hashHex)return false;const derived=await scrypt(password,Buffer.from(saltHex,"hex"),64) as Buffer;const expected=Buffer.from(hashHex,"hex");return derived.length===expected.length&&timingSafeEqual(derived,expected);}
export function createSessionToken(data:Omit<AuthSession,"exp">){const payload=b64(JSON.stringify({...data,exp:Date.now()+1000*60*60*12}));const signature=createHmac("sha256",secret()).update(payload).digest("base64url");return `${payload}.${signature}`;}
export function readSessionToken(token?:string|null):AuthSession|null{if(!token)return null;const[payload,signature]=token.split(".");if(!payload||!signature)return null;const expected=createHmac("sha256",secret()).update(payload).digest("base64url");const a=Buffer.from(signature),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))return null;try{const data=JSON.parse(Buffer.from(payload,"base64url").toString()) as AuthSession;return data.exp>Date.now()?data:null}catch{return null}}
function revision(user:{passwordHash:string;updatedAt:Date}){return createHmac('sha256',secret()).update(user.passwordHash+':'+user.updatedAt.toISOString()).digest('hex');}
export async function resolveSession(token?:string|null){
  if(!token||token.length>4096)return null;
  const session=readSessionToken(token);if(!session||typeof session.userId!=='string')return null;
  const user=await prisma.user.findUnique({where:{id:session.userId}});
  if(!user?.active||user.role!==session.role||session.revision!==revision(user))return null;
  return {userId:user.id,email:user.email,name:user.name,role:user.role,exp:session.exp};
}
export async function currentSession(){const store=await cookies();return resolveSession(store.get(AUTH_COOKIE)?.value);}
export async function setSessionCookie(session:Omit<AuthSession,"exp">){const user=await prisma.user.findUniqueOrThrow({where:{id:session.userId}});const store=await cookies();store.set(AUTH_COOKIE,createSessionToken({...session,revision:revision(user)}),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*12});}
export async function clearSessionCookie(){const store=await cookies();store.set(AUTH_COOKIE,"",{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:0});}
