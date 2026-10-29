import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
const backup=path.resolve(process.argv[2]||'');
if(!backup.startsWith(path.resolve('backups')+path.sep)||!fs.existsSync(path.join(backup,'database.dump')))throw new Error('Expected existing backup directory');
const source=['senior-full-stack-76-wordpress-wordpress-postgres-1','lhl76','lhl76_import_test'];
const name=`lhl76-final-reconcile-${Date.now()}`,user='reconcile_owner',database='lhl76_final_rehearsal';
const port=55433,password=randomBytes(32).toString('hex');
const cmd=(args,options={})=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:32*1024*1024,...options});
cmd(['run','-d','--name',name,'--label','lhl76.purpose=final-reconciliation','-p',`127.0.0.1:${port}:5432`,'-e',`POSTGRES_PASSWORD=${password}`,'-e',`POSTGRES_USER=${user}`,'-e',`POSTGRES_DB=${database}`,'postgres:16-alpine']);
let ready=false;for(let n=0;n<30;n++){try{cmd(['exec',name,'pg_isready','-U',user,'-d',database],{stdio:'pipe'});ready=true;break;}catch{await new Promise(r=>setTimeout(r,1000));}}if(!ready)throw new Error('Test database failed to start');
cmd(['cp',path.join(backup,'database.dump'),`${name}:/tmp/source.dump`]);
const start=performance.now();cmd(['exec',name,'pg_restore','-U',user,'-d',database,'--exit-on-error','--no-owner','--no-privileges','/tmp/source.dump']);
const restoreMs=performance.now()-start;
function query(conn,sql){return cmd(['exec',conn[0],'psql','-U',conn[1],'-d',conn[2],'-At','-v','ON_ERROR_STOP=1','-c',sql]).trim();}
const target=[name,user,database];const tables=query(source,"SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").split(/\r?\n/);
const results=tables.map(table=>{if(!/^\w+$/.test(table))throw new Error('Invalid identifier');const sql=`SELECT count(*) || ':' || coalesce(md5(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text)), 'empty') FROM public."${table}" t`;const before=query(source,sql),after=query(target,sql);return {table,count:Number(before.split(':')[0]),fingerprint:before.split(':')[1],matches:before===after};});
const constraintSql="SELECT md5(string_agg(conrelid::regclass::text || ':' || conname || ':' || pg_get_constraintdef(oid), E'\\n' ORDER BY conrelid::regclass::text,conname)) FROM pg_constraint WHERE connamespace='public'::regnamespace";
const constraintsMatch=query(source,constraintSql)===query(target,constraintSql);
const report={checkedAt:new Date().toISOString(),source:{container:source[0],database:source[2]},target:{container:name,user,database,port},restoreMs,results,constraintsMatch,databaseVerified:constraintsMatch&&results.every(r=>r.matches),filesVerified:false};
const reportPath=path.join(backup,'restore-verification.json');fs.writeFileSync(reportPath,JSON.stringify(report,null,2),{flag:'wx'});
console.log(JSON.stringify({databaseVerified:report.databaseVerified,tables:results.length,restoreMs,target:report.target}));
if(!report.databaseVerified)throw new Error('Restore verification failed');
const restored=path.join(backup,'restored-files');
execFileSync('powershell',['-NoProfile','-Command',`Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory('${path.join(backup,'public-files.zip').replaceAll("'","''")}','${restored.replaceAll("'","''")}')`],{stdio:'pipe'});
async function hashFile(p){const hash=createHash('sha256');for await(const chunk of fs.createReadStream(p))hash.update(chunk);return hash.digest('hex');}
function files(root){return fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(root,e.name)):[path.join(root,e.name)]);}
const originals=files(path.resolve('public')),restoredRoot=path.join(restored,'public'),checks=[];
for(const file of originals){const rel=path.relative(path.resolve('public'),file),copy=path.join(restoredRoot,rel);checks.push({path:rel,ok:fs.existsSync(copy)&&await hashFile(file)===await hashFile(copy)});}
report.filesVerified=checks.every(c=>c.ok)&&files(restoredRoot).length===originals.length;report.filesCount=checks.length;report.fileFailures=checks.filter(c=>!c.ok);
fs.writeFileSync(path.join(backup,'complete-verification.json'),JSON.stringify(report,null,2),{flag:'wx'});
fs.copyFileSync(path.join(backup,'complete-verification.json'),path.join('D:\\LHL76-Backups',path.basename(backup),'complete-verification.json'),fs.constants.COPYFILE_EXCL);
console.log(JSON.stringify({filesVerified:report.filesVerified,filesCount:checks.length,backup}));
if(!report.filesVerified)throw new Error('File restore check failed');
