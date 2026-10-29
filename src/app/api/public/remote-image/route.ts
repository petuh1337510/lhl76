import {NextRequest} from 'next/server';
import {Resolver} from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';
import sharp from 'sharp';
import {remoteImageUrl,publicIpv4} from '@/lib/remote-image-policy';
export const runtime='nodejs';
let active=0;
const queue:Array<()=>void>=[];
async function slot(){
 if(active<4){active++;return;}
 if(queue.length>=24)throw new Error('Busy');
 await new Promise<void>((resolve,reject)=>{
  const resume=()=>{clearTimeout(timer);resolve();};
  const timer=setTimeout(()=>{const index=queue.indexOf(resume);if(index>=0)queue.splice(index,1);reject(new Error('Queue timeout'));},5000);
  queue.push(resume);
 });
}
function release(){const next=queue.shift();if(next)next();else active--;}
async function download(url:URL,address:string){
 return new Promise<Buffer>((resolve,reject)=>{
  let size=0;const chunks:Buffer[]=[];
  const req=httpsRequest(url,{method:'GET',family:4,lookup:(_host,_options,callback)=>callback(null,address,4)},res=>{
   // No redirects: never forward a request to a second, unchecked destination.
   if(res.statusCode!==200||Number(res.headers['content-length'])>25*1024*1024){res.destroy();reject(new Error('Invalid upstream response'));return;}
   res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>25*1024*1024){req.destroy(new Error('Image too large'));return;}chunks.push(chunk);});
   res.on('end',()=>resolve(Buffer.concat(chunks)));res.on('error',reject);
  });
  const timer=setTimeout(()=>req.destroy(new Error('Image timeout')),7000);
  req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end();
 });
}
export async function GET(request:NextRequest){
 const url=remoteImageUrl(request.nextUrl.searchParams.get('url')||'');if(!url)return new Response(null,{status:400});
 let acquired=false;
 try{
  await slot();acquired=true;
  if(request.signal.aborted)return new Response(null,{status:499});
  const resolver=new Resolver({timeout:2000,tries:1});
  const addresses=await resolver.resolve4(url.hostname);
  if(!addresses.length||addresses.some(x=>!publicIpv4(x)))return new Response(null,{status:400});
  // Pin the checked address in the HTTPS connection to prevent DNS rebinding.
  const bytes=await download(url,addresses[0]);
  const meta=await sharp(bytes,{limitInputPixels:40000000}).metadata();
  const mime:Record<string,string>={jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp'};
  if(!meta.format||!mime[meta.format])return new Response(null,{status:415});
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':mime[meta.format],'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=300'}});
 }catch{return new Response(null,{status:502});}finally{if(acquired)release();}
}
