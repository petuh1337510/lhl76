import {NextRequest} from 'next/server';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import manifest from '@/lib/legacy-media-manifest.json';
import finalManifest from '@/lib/legacy-final-media-manifest.json';
const entries:Record<string,string>={...finalManifest,...manifest};
const types:Record<string,string>={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.avif':'image/avif','.pdf':'application/pdf','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xls':'application/vnd.ms-excel','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
export async function GET(request:NextRequest){
 const file=entries[request.nextUrl.searchParams.get('source')||''];
 if(!file||!/^\/legacy-media\/[a-f0-9]{64}\.[a-z]+$/.test(file))return new Response(null,{status:404});
 const tag='"'+path.basename(file)+'"';
 const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'public, max-age=86400','ETag':tag,'X-Content-Type-Options':'nosniff',...(!/^image\//.test(types[path.extname(file)]||'')?{'Content-Disposition':'attachment'}:{})};
 if(request.headers.get('if-none-match')===tag)return new Response(null,{status:304,headers});
 try{return new Response(new Uint8Array(await readFile(path.join(process.cwd(),'public',file))),{headers});}catch{return new Response(null,{status:404});}
}
