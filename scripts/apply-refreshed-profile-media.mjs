import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {PrismaClient} from '@prisma/client';
const root=path.resolve('work/final-reconciliation-2026-10-29T09-46-37-979Z');
const backup=path.resolve('backups/approved-2026-10-29T09-48-00-405Z');
const verified=JSON.parse(fs.readFileSync(path.join(backup,'complete-verification.json'),'utf8'));
if(!verified.filesVerified||!verified.databaseVerified)throw new Error('Verified backup required');
const reportPath=path.join(root,'refreshed-media-report.json'),bytes=fs.readFileSync(reportPath),report=JSON.parse(bytes),planHash=createHash('sha256').update(bytes).digest('hex');
if(report.failures.length||report.verified!==report.urls)throw new Error('Media verification incomplete');
const working=process.argv.includes('--approved-working'),target=working?verified.source:verified.target;
if(working&&(target.container!=='senior-full-stack-76-wordpress-wordpress-postgres-1'||target.database!=='lhl76_import_test'))throw new Error('Unexpected working database');
const config=JSON.parse(execFileSync('docker',['inspect',target.container],{encoding:'utf8'}))[0];
if(!working&&(!target.database.startsWith('approved_restore_')||target.port!==55433||config.Config.Labels?.['lhl76.purpose']!=='final-reconciliation'))throw new Error('Unexpected clone');
if(working){const proof=JSON.parse(fs.readFileSync(path.join(root,'media-rehearsal.json'),'utf8'));if(proof.planHash!==planHash||!proof.rollbackVerified||proof.first!==report.changes.length||proof.second!==0)throw new Error('Exact trial not passed');}
const password=config.Config.Env.find(s=>s.startsWith('POSTGRES_PASSWORD=')).slice(18);
const db=new PrismaClient({datasourceUrl:`postgresql://${target.user}:${encodeURIComponent(password)}@127.0.0.1:${working?5432:55433}/${target.database}`});
const changes=report.changes;
for(const row of changes){if(!['player','team'].includes(row.model)||!['photoUrl','logoUrl','teamPhotoUrl'].includes(row.field)||row.local!=='/legacy-media/'+row.file||!/^[a-f0-9]{64}\.(jpg|png|gif|webp|avif)$/.test(row.file))throw new Error('Invalid media plan');const data=fs.readFileSync(path.join(root,'refreshed-media',row.file));if(createHash('sha256').update(data).digest('hex')!==row.sha256)throw new Error('Staged image changed');
 if(working)for(const dir of [path.resolve('public/legacy-media'),path.join(verified.independentCopy,'refreshed-media')]){fs.mkdirSync(dir,{recursive:true});const destination=path.join(dir,row.file);if(fs.existsSync(destination)){if(createHash('sha256').update(fs.readFileSync(destination)).digest('hex')!==row.sha256)throw new Error('Existing file differs');}else fs.copyFileSync(path.join(root,'refreshed-media',row.file),destination,fs.constants.COPYFILE_EXCL);}
}
async function apply(tx,fail=false){await tx.$executeRawUnsafe("SET LOCAL lock_timeout='10s'");await tx.$executeRawUnsafe('LOCK TABLE "Player", "Team" IN SHARE ROW EXCLUSIVE MODE');let count=0;for(const r of changes){const current=await tx[r.model].findUniqueOrThrow({where:{id:r.id}});if(current[r.field]===r.local)continue;if(current[r.field]!==r.current)throw new Error('Photo changed after audit; not overwriting');await tx[r.model].update({where:{id:r.id},data:{[r.field]:r.local}});count++;if(fail)throw new Error('EXPECTED_MEDIA_ROLLBACK');}return count;}
try{
 let rollbackVerified=false;
 if(!working){try{await db.$transaction(tx=>apply(tx,true));}catch(e){if(e.message!=='EXPECTED_MEDIA_ROLLBACK')throw e;}rollbackVerified=true;for(const r of changes){if((await db[r.model].findUniqueOrThrow({where:{id:r.id}}))[r.field]!==r.current)rollbackVerified=false;}if(!rollbackVerified)throw new Error('Rollback failed');}
 const first=await db.$transaction(tx=>apply(tx),{timeout:60000}),second=await db.$transaction(tx=>apply(tx),{timeout:60000});
 const result={checkedAt:new Date().toISOString(),planHash,first,second,rollbackVerified:working?true:rollbackVerified,workingWrites:working,backup,players:changes.filter(r=>r.model==='player').length,teams:changes.filter(r=>r.model==='team').length,oldFilesDeleted:0};
 const filename=working?'media-working-import.json':'media-rehearsal.json';fs.writeFileSync(path.join(root,filename),JSON.stringify(result,null,2),{flag:'wx'});fs.copyFileSync(path.join(root,filename),path.join(verified.independentCopy,filename),fs.constants.COPYFILE_EXCL);console.log(JSON.stringify(result));
}finally{await db.$disconnect();}
