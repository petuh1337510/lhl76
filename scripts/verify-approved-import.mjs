import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=path.resolve('work/final-reconciliation-2026-10-29T05-52-30-265Z');
const backup=JSON.parse(fs.readFileSync('backups/approved-2026-10-29T06-27-17-636Z/complete-verification.json','utf8'));
const query=(c,sql)=>execFileSync('docker',['exec',c.container,'psql','-U',c.user,'-d',c.database,'-At','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',maxBuffer:64*1024*1024}).trim();
const report={checkedAt:new Date().toISOString(),tableComparisons:[],media:[],pages:[],workingWrites:0};
for(const item of backup.results){if(!/^\w+$/.test(item.table))throw new Error('Invalid table');const sql=`SELECT count(*) || ':' || coalesce(md5(string_agg((to_jsonb(t)-'updatedAt')::text,E'\\n' ORDER BY (to_jsonb(t)-'updatedAt')::text)), 'empty') FROM "${item.table}" t`;const actual=query(backup.source,sql),expected=query(backup.target,sql);report.tableComparisons.push({table:item.table,count:Number(actual.split(':')[0]),matchesApprovedRehearsal:actual===expected});}
const staged=JSON.parse(fs.readFileSync(path.join(root,'staged-media-results.json'),'utf8')).results;
for(const item of staged){const url='http://localhost:3000/api/public/legacy-media?source='+encodeURIComponent(item.url);const r=await fetch(url,{signal:AbortSignal.timeout(20000)}),bytes=Buffer.from(await r.arrayBuffer());report.media.push({source:item.url,status:r.status,checksumMatches:r.ok&&createHash('sha256').update(bytes).digest('hex')===item.sha256});}
const source='/api/public/legacy-media?source='+encodeURIComponent(staged[0].url);
const image=await fetch('http://localhost:3000/_next/image?url='+encodeURIComponent(source)+'&w=96&q=75',{headers:{Accept:'image/webp'},signal:AbortSignal.timeout(30000)});
report.optimizedImage={status:image.status,type:image.headers.get('content-type')};if(image.ok){const metadata=await sharp(Buffer.from(await image.arrayBuffer())).metadata();report.optimizedImage.width=metadata.width;report.optimizedImage.format=metadata.format;}
const sitemap=await fetch('http://localhost:3000/sitemap.xml',{signal:AbortSignal.timeout(30000)});const xml=await sitemap.text();
const routes=[...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname).filter(p=>p.startsWith('/competition/')))];
report.sitemapStatus=sitemap.status;
const matches=JSON.parse(query(backup.source,`SELECT coalesce(json_agg(slug),'[]') FROM "Match" WHERE id IN (SELECT "entityId" FROM "LegacyImportMap" WHERE "entityType"='match' AND "legacyId" IN ('13976','14058'))`));
for(const route of ['/',...routes,...matches.map(s=>'/match/'+s)]){const r=await fetch('http://localhost:3000'+route,{signal:AbortSignal.timeout(30000)});await r.arrayBuffer();report.pages.push({route,status:r.status});}
report.allTablesMatch=report.tableComparisons.every(r=>r.matchesApprovedRehearsal);report.allMediaMatch=report.media.every(r=>r.status===200&&r.checksumMatches);report.allPagesOk=report.pages.every(r=>r.status===200);
fs.writeFileSync(path.join(root,'approved-final-verification.json'),JSON.stringify(report,null,2),{flag:'wx'});
console.log(JSON.stringify({allTablesMatch:report.allTablesMatch,tables:report.tableComparisons.length,allMediaMatch:report.allMediaMatch,media:report.media.length,allPagesOk:report.allPagesOk,pages:report.pages.length,competitionRoutes:routes.length,optimizedImage:report.optimizedImage,failedTables:report.tableComparisons.filter(r=>!r.matchesApprovedRehearsal)},null,2));
if(!report.allTablesMatch||!report.allMediaMatch||!report.allPagesOk)process.exitCode=1;
