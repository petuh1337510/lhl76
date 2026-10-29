import fs from 'node:fs';
import path from 'node:path';
import {PrismaClient} from '@prisma/client';
const db=new PrismaClient(),urls=new Set();
const walk=value=>{if(typeof value==='string'){for(const m of value.matchAll(/https?:\/\/(?:www\.)?lhl-76\.ru\/wp-content\/[^\s"'<>\\]+/g))urls.add(m[0].replaceAll('&amp;','&'));}else if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')Object.values(value).forEach(walk)};
try{
 const tables=await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
 // Read only. Do not print rows, account hashes, connection strings or private fields.
 for(const {tablename} of tables){if(!/^\w+$/.test(tablename))throw Error('Invalid table');if(['User','AuditLog'].includes(tablename))continue;const rows=await db.$queryRawUnsafe(`SELECT row_to_json(t) AS value FROM public."${tablename}" t`);rows.forEach(x=>walk(x.value));}
 const manifest={...JSON.parse(fs.readFileSync('src/lib/legacy-final-media-manifest.json','utf8')),...JSON.parse(fs.readFileSync('src/lib/legacy-media-manifest.json','utf8'))};
 const missing=[...urls].filter(url=>{const local=manifest[url];return !local||!/^\/legacy-media\/[a-f0-9]{64}\.[a-z]+$/.test(local)||!fs.existsSync(path.join('public',local));});
 const report={checkedAt:new Date().toISOString(),referencedOldUrls:urls.size,missing,allMapped:missing.length===0,workingWrites:0};
 fs.writeFileSync('artifacts/final-readiness/media-independence-current.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checked:urls.size,missing:missing.length,readOnly:true}));if(missing.length)process.exitCode=1;
}finally{await db.$disconnect();}
