import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const dir=path.resolve(process.argv[2]||'');if(!dir.startsWith(path.resolve('work')+path.sep))throw new Error('Expected audit directory');
const refs=JSON.parse(fs.readFileSync(path.join(dir,'media.json'),'utf8')).filter(m=>m.url&&!m.available);
const urls=[...new Set(refs.map(m=>m.url))],output=path.join(dir,'staged-media');fs.mkdirSync(output,{recursive:false});
const results=[];let next=0;
async function worker(){while(next<urls.length){const url=urls[next++];try{
 const parsed=new URL(url);if(!['lhl-76.ru','www.lhl-76.ru'].includes(parsed.hostname)||!parsed.pathname.startsWith('/wp-content/uploads/')||parsed.username||parsed.password||parsed.port||!['https:','http:'].includes(parsed.protocol))throw new Error('Outside approved legacy upload host/path');
 parsed.protocol='https:';const response=await fetch(parsed,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);
 const limit=25*1024*1024;if(Number(response.headers.get('content-length'))>limit)throw new Error('Too large');
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw new Error('Too large');chunks.push(chunk);}const bytes=Buffer.concat(chunks);
 const info=await sharp(bytes,{limitInputPixels:40_000_000}).metadata();if(!['jpeg','png','webp','gif','avif'].includes(info.format))throw new Error('Unsupported image content');
 const sha256=createHash('sha256').update(bytes).digest('hex'),ext=info.format==='jpeg'?'jpg':info.format,file=`${sha256}.${ext}`;
 if(!fs.existsSync(path.join(output,file)))fs.writeFileSync(path.join(output,file),bytes,{flag:'wx'});
 results.push({url,ok:true,file,size,sha256,width:info.width,height:info.height,format:info.format});
 }catch(error){results.push({url,ok:false,error:error.message});}
}}
await Promise.all(Array.from({length:3},worker));
fs.writeFileSync(path.join(dir,'staged-media-results.json'),JSON.stringify({urls:urls.length,verified:results.filter(r=>r.ok).length,results,publicFilesChanged:false},null,2),{flag:'wx'});
console.log(JSON.stringify({urls:urls.length,verified:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,publicFilesChanged:false}));
