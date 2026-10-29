import { PrismaClient } from '@prisma/client';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const db=new PrismaClient();
const models=['team','player','news','document','mediaAlbum','broadcast','homepageContent','leaguePerson','venue','laureate'];
const urls=new Set();
for(const model of models){for(const row of await db[model].findMany()){const text=JSON.stringify(row);for(const match of text.matchAll(/https?:\/\/(?:www\.)?lhl-76\.ru\/wp-content\/[^\s"<>\\]+/g))urls.add(match[0]);}}
await db.$disconnect();
await mkdir('artifacts/final-readiness',{recursive:true});
await writeFile('artifacts/final-readiness/media-inventory.json',JSON.stringify([...urls].sort(),null,2));
await mkdir('public/legacy-media',{recursive:true});
const entries=[...urls].sort(), verified={}, failures=[], small=[];
let index=0;
async function work(){while(index<entries.length){const url=entries[index++];try{
 const parsed=new URL(url);const extension=path.extname(parsed.pathname).toLowerCase();
 if(!['.jpg','.jpeg','.png','.webp','.gif','.pdf','.doc','.docx','.xlsx','.xls'].includes(extension))throw new Error('Unsupported format');
 const filename=createHash('sha256').update(url).digest('hex')+extension;const disk='public/legacy-media/'+filename;
 const max=url==='https://lhl-76.ru/wp-content/uploads/2023/07/dsc_2016-3.png'?100*1024*1024:25*1024*1024;
 let bytes;try{bytes=await readFile(disk);}catch{const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error('HTTP '+r.status);if(Number(r.headers.get('content-length'))>max)throw new Error('Too large');const chunks=[];let n=0;for await(const chunk of r.body){n+=chunk.length;if(n>max)throw new Error('Too large');chunks.push(chunk);}bytes=Buffer.concat(chunks);}
 if(['.jpg','.jpeg','.png','.webp','.gif'].includes(extension)){const m=await sharp(bytes,{limitInputPixels:40000000}).metadata();if(!m.width||!m.height)throw new Error('Invalid image');if(m.width<400)small.push({url,width:m.width,height:m.height});}
 try{await stat(disk);}catch{await writeFile(disk,bytes,{flag:'wx'});}
 if(bytes.length>20*1024*1024&&['.jpg','.jpeg','.png','.webp'].includes(extension)){
  const display=filename.replace(/\.[^.]+$/,'.webp');
  try{await stat('public/legacy-media/'+display);}catch{await writeFile('public/legacy-media/'+display,await sharp(bytes,{limitInputPixels:40000000}).rotate().resize({width:2560,height:2560,fit:'inside',withoutEnlargement:true}).webp({quality:86}).toBuffer(),{flag:'wx'});}
  verified[url]='/legacy-media/'+display;
 }else verified[url]='/legacy-media/'+filename;
 }catch(e){failures.push({url,error:e.message});}
 if(index%100===0)console.log(`Checked ${index}/${entries.length}`);
}}
await Promise.all([work(),work(),work(),work()]);
await writeFile('src/lib/legacy-media-manifest.json',JSON.stringify(verified));
await writeFile('artifacts/final-readiness/media-results.json',JSON.stringify({total:entries.length,verified:Object.keys(verified).length,failures,small},null,2));
console.log(JSON.stringify({total:entries.length,verified:Object.keys(verified).length,failures:failures.length,small:small.length}));
