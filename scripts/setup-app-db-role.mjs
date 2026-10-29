// Run after a verified fresh backup. Does not modify application records or existing roles.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
const backup=path.resolve(process.argv[2]||'');
if(!backup.startsWith(path.resolve('backups')+path.sep))throw Error('Backup required');
const report=JSON.parse(fs.readFileSync(path.join(backup,'complete-verification.json'),'utf8'));
if(!report.databaseVerified||!report.filesVerified||!report.constraintsMatch||!fs.existsSync(path.join(report.independentCopy,'database.dump')))throw Error('Verified independent backup required');
const sourceUrl=new URL(process.env.DATABASE_URL);
if(sourceUrl.pathname.slice(1)!==report.source.database||!['localhost','127.0.0.1'].includes(sourceUrl.hostname)||(sourceUrl.port||'5432')!=='5432')throw Error('Unexpected database');
if(report.target.database===report.source.database||report.target.port!==55433)throw Error('Unsafe test target');
const role='lhl_app_'+Date.now(),password=randomBytes(40).toString('hex');
function sql(target,query){return execFileSync('docker',['exec','-i',target.container,'psql','-U',target.user,'-d',target.database,'-At','-v','ON_ERROR_STOP=1','-f','-'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()}
async function provision(target,port){
 if(!/^\w+$/.test(target.database)||!/^\w+$/.test(target.user))throw Error('Invalid identifiers');
 sql(target,`BEGIN; CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; GRANT CONNECT ON DATABASE "${target.database}" TO "${role}"; GRANT USAGE ON SCHEMA public TO "${role}"; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO "${role}"; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO "${role}"; ALTER DEFAULT PRIVILEGES FOR ROLE "${target.user}" IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO "${role}"; ALTER DEFAULT PRIVILEGES FOR ROLE "${target.user}" IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO "${role}"; COMMIT;`);
 const url=new URL(sourceUrl);url.username=role;url.password=password;url.port=String(port);url.pathname='/'+target.database;
 const db=new PrismaClient({datasourceUrl:url.toString()});
 try{
  const [rights]=await db.$queryRaw`SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,has_schema_privilege(current_user,'public','CREATE') AS ddl FROM pg_roles WHERE rolname=current_user`;
  if(Object.values(rights).some(Boolean))throw Error('Role has excessive privileges');
  const counts={players:await db.player.count(),matches:await db.match.count()};
  if(port===55433){
   let denied=false;try{await db.$transaction(async tx=>{await tx.$executeRawUnsafe('CREATE TABLE public.permission_probe(id int)');throw Error('DDL_ALLOWED')})}catch(e){if(e.message==='DDL_ALLOWED'||e.meta?.code!=='42501')throw e;denied=true}
   if(!denied)throw Error('DDL not denied');
   try{await db.$transaction(async tx=>{const p=await tx.player.findFirstOrThrow();await tx.player.update({where:{id:p.id},data:{firstName:p.firstName}});throw Error('ROLLBACK_PROBE')})}catch(e){if(e.message!=='ROLLBACK_PROBE')throw e}
  }
  return {url:url.toString(),rights,counts};
 }finally{await db.$disconnect()}
}
try{
 const rehearsal=await provision(report.target,55433);
 const working=await provision(report.source,5432);
 if(JSON.stringify(rehearsal.counts)!==JSON.stringify(working.counts))throw Error('Counts changed; do not switch automatically');
 const file=path.resolve('.env.local'),original=fs.readFileSync(file,'utf8');
 if(!/^DATABASE_URL=.*$/m.test(original))throw Error('Expected single DATABASE_URL line');
 // Private backup is never emitted to stdout or placed under public.
 fs.copyFileSync(file,path.join(backup,'environment-before-role.env'),fs.constants.COPYFILE_EXCL);
 fs.chmodSync(path.join(backup,'environment-before-role.env'),0o600);
 const next=original.replace(/^DATABASE_URL=.*$/m,'DATABASE_URL="'+working.url+'"');
 fs.writeFileSync(file,next,{mode:0o600});
 const result={checkedAt:new Date().toISOString(),role,verified:true,rights:working.rights,counts:working.counts,rehearsalDatabase:report.target.database,workingDatabase:report.source.database,applicationRecordsChanged:false};
 fs.writeFileSync(path.join(backup,'least-privilege-role.json'),JSON.stringify(result,null,2),{flag:'wx'});
 console.log(JSON.stringify(result));
}catch(e){console.error('Role setup stopped:',e instanceof Error&&/^Role has|Counts changed|Expected single|DDL_ALLOWED|DDL not/.test(e.message)?e.message:'See private local diagnostics; no secrets emitted');process.exitCode=1}
