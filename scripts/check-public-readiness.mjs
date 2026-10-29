import {writeFileSync} from 'node:fs';
const base='http://localhost:3000';
const paths=['/','/competition/2026-27/championship/lyubitel-plyus?tab=statistics','/team/hctanki76?tab=roster','/player/egorov-artem','/match/sezon-2026-2027-2026-27-divizion-lyubitel-plyus-baltika-vs-tanki?view=rosters','/news','/news/торжественное-открытие-сезона-2026-2027-в-лхл-76-9f7963','/documents','/media','/broadcasts','/about','/venues','/tournaments','/laureates'];
const results=[];let home='',documents='';
const validCanonical=value=>{try{return new URL(value).origin==='https://lhl-76.ru';}catch{return false;}};
for(const path of paths){const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)}),html=await r.text();const title=html.match(/<title>([^<]+)<\/title>/)?.[1],canonical=html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];const description=/name="description" content="[^"]+"/.test(html),og=/property="og:title"/.test(html);results.push({path,status:r.status,title,canonical,description,og,ok:r.ok&&Boolean(title)&&validCanonical(canonical)&&description&&og});if(path==='/')home=html;if(path==='/documents')documents=html;}
for(const path of [...new Set([...documents.matchAll(/href="(\/documents\/legacy\/[^"<>]+)"/g)].map(m=>m[1])),...new Set([...home.matchAll(/href="([^"<>]+\.woff2)"/g)].map(m=>m[1])),'/robots.txt','/sitemap.xml','/icon.png','/apple-icon.png','/favicon.ico','/api/ready']){
 const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)});await r.arrayBuffer();results.push({path,status:r.status,ok:r.ok,type:r.headers.get('content-type')});
}
for(const [path,expected] of [['/api/public/remote-image?url=http%3A%2F%2F127.0.0.1',400],['/api/public/legacy-media?source=file%3A%2F%2F%2Fetc%2Fpasswd',404],['/api/admin/users',401]]){const r=await fetch(base+path);results.push({path,status:r.status,ok:r.status===expected});}
const report={checkedAt:new Date().toISOString(),base,results,ok:results.every(r=>r.ok)};writeFileSync('artifacts/final-readiness/main-site-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks:results.length,failed:results.filter(r=>!r.ok)}));if(!report.ok)process.exitCode=1;
