import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=path.resolve(process.argv[2]||'');if(!root.startsWith(path.resolve('work')+path.sep))throw new Error('Invalid audit path');
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'current-snapshot.json'),'utf8'));
const media=JSON.parse(fs.readFileSync(path.join(root,'media.json'),'utf8'));
const manifest={...JSON.parse(fs.readFileSync('src/lib/legacy-final-media-manifest.json','utf8')),...JSON.parse(fs.readFileSync('src/lib/legacy-media-manifest.json','utf8'))};
const refs=[];
for(const row of media){if(!row.url)continue;const model=row.type==='player'?'player':'team',field=row.type==='player'?'photoUrl':row.type==='team-logo'?'logoUrl':'teamPhotoUrl';const ids=[...new Set(snapshot.legacyImportMap.filter(m=>m.entityType===model&&m.legacyId===String(row.legacyId)&&m.source.startsWith('joomsport:lhlnew:')).map(m=>m.entityId))];if(ids.length!==1)continue;const target=snapshot[model].find(r=>r.id===ids[0]);if(!target)continue;refs.push({...row,model,field,id:target.id,current:target[field]});}
const urls=[...new Set(refs.map(r=>r.url))],output=path.join(root,'refreshed-media');fs.mkdirSync(output);const results=[];let next=0,done=0;
const digest=b=>createHash('sha256').update(b).digest('hex');
async function worker(){while(next<urls.length){const url=urls[next++];try{
 const parsed=new URL(url);if(!['lhl-76.ru','www.lhl-76.ru'].includes(parsed.hostname)||parsed.port||parsed.username||parsed.password||!parsed.pathname.startsWith('/wp-content/uploads/'))throw new Error('Unapproved media location');parsed.protocol='https:';
 const response=await fetch(parsed,{redirect:'error',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);
 const limit=parsed.pathname==='/wp-content/uploads/2023/07/dsc_2016-3.png'?100*1024*1024:25*1024*1024;
 if(Number(response.headers.get('content-length'))>limit)throw new Error('Oversized image');let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw new Error('Oversized image');chunks.push(chunk);}const bytes=Buffer.concat(chunks);
 const info=await sharp(bytes,{limitInputPixels:40_000_000}).metadata();if(!['jpeg','png','gif','webp','avif'].includes(info.format))throw new Error('Unsupported image');
 const sha=digest(bytes),file=sha+'.'+(info.format==='jpeg'?'jpg':info.format),filename=path.join(output,file);if(!fs.existsSync(filename))fs.writeFileSync(filename,bytes,{flag:'wx'});
 let local=manifest[url];const original='/legacy-media/'+digest(Buffer.from(url))+path.extname(parsed.pathname).toLowerCase();if(fs.existsSync(path.join('public',original)))local=original;
 const oldHash=local&&fs.existsSync(path.join('public',local))?digest(fs.readFileSync(path.join('public',local))):null;
 results.push({url,ok:true,file,sha256:sha,width:info.width,height:info.height,size,oldHash,bytesChanged:oldHash!==sha});
 }catch(error){results.push({url,ok:false,error:error.message});}
 done++;if(done%100===0)console.log(JSON.stringify({checked:done,total:urls.length}));
}}
await Promise.all(Array.from({length:3},worker));
const changes=refs.flatMap(ref=>{const fetched=results.find(r=>r.url===ref.url);if(!fetched?.ok)return[];return ref.current!==ref.url||fetched.bytesChanged?[{...ref,...fetched,local:'/legacy-media/'+fetched.file}]:[];});
const report={checkedAt:new Date().toISOString(),references:refs.length,urls:urls.length,verified:results.filter(r=>r.ok).length,failures:results.filter(r=>!r.ok),changes,results,workingWrites:0};
fs.writeFileSync(path.join(root,'refreshed-media-report.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({urls:report.urls,verified:report.verified,failures:report.failures,changes:changes.length}));
