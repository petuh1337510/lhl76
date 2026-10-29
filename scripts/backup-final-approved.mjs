import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const prior=path.resolve('backups/safety-20261029-084745-779');
const previous=JSON.parse(fs.readFileSync(path.join(prior,'complete-verification.json'),'utf8'));
if(!previous.databaseVerified||!previous.filesVerified)throw new Error('Verified baseline required');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const output=path.resolve('backups',`approved-${stamp}`),second=path.join('D:\\LHL76-Backups',path.basename(output));
fs.mkdirSync(output);fs.mkdirSync(second);
const run=args=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:64*1024*1024});
const source={container:'senior-full-stack-76-wordpress-wordpress-postgres-1',user:'lhl76',database:'lhl76_import_test'};
const target={...previous.target,database:`approved_restore_${Date.now()}`};
const inspection=JSON.parse(run(['inspect',target.container]))[0];
if(inspection.Config.Labels?.['lhl76.purpose']!=='final-reconciliation'||target.port!==55433)throw new Error('Wrong restore target');
// One exported MVCC snapshot keeps dump and verification consistent even while
// secretaries save new results. It does not lock application records for writes.
const snapshotChild=spawn('docker',['exec','-i',source.container,'psql','-U',source.user,'-d',source.database,'-qAt','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
process.once('exit',()=>snapshotChild.kill());
const snapshot=await new Promise((resolve,reject)=>{let out='';const timeout=setTimeout(()=>{snapshotChild.kill();reject(Error('Snapshot timeout'))},10000);snapshotChild.stdout.on('data',chunk=>{out+=chunk;const match=out.match(/[0-9A-F]{8}-[0-9A-F]{8}-\d+/i);if(match){clearTimeout(timeout);resolve(match[0])}});snapshotChild.once('error',reject);snapshotChild.once('exit',code=>{if(code)reject(Error('Snapshot failed'))});snapshotChild.stdin.write('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();\n')});
const query=(c,sql)=>run(['exec',c.container,'psql','-U',c.user,'-d',c.database,'-qAt','-v','ON_ERROR_STOP=1','-c',c===source?`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET TRANSACTION SNAPSHOT '${snapshot}'; ${sql}; COMMIT;`:sql]).trim();
const tables=query(source,"SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").split(/\r?\n/);
function fingerprint(c){return tables.map(table=>{if(!/^\w+$/.test(table))throw new Error('Invalid table');const value=query(c,`SELECT count(*) || ':' || coalesce(md5(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text)), 'empty') FROM public."${table}" t`);return {table,count:Number(value.split(':')[0]),fingerprint:value.split(':')[1]};});}
const before=fingerprint(source),remote=`/tmp/approved-${Date.now()}.dump`;
run(['exec',source.container,'pg_dump','-U',source.user,'-d',source.database,'--snapshot',snapshot,'-Fc','-f',remote]);
run(['cp',`${source.container}:${remote}`,path.join(output,'database.dump')]);
run(['cp',path.join(output,'database.dump'),`${target.container}:${remote}`]);
run(['exec',target.container,'createdb','-U',target.user,target.database]);
const start=performance.now();
run(['exec',target.container,'pg_restore','-U',target.user,'-d',target.database,'--exit-on-error','--no-owner','--no-privileges',remote]);
const restoreMs=performance.now()-start,restored=fingerprint(target),after=fingerprint(source);
if(JSON.stringify(before)!==JSON.stringify(after)||JSON.stringify(before)!==JSON.stringify(restored))throw new Error('Database changed or restored contents differ');
const constraints="SELECT md5(string_agg(conrelid::regclass::text || ':' || conname || ':' || pg_get_constraintdef(oid), E'\\n' ORDER BY conrelid::regclass::text,conname)) FROM pg_constraint WHERE connamespace='public'::regnamespace";
if(query(source,constraints)!==query(target,constraints))throw new Error('Constraint mismatch');
snapshotChild.stdin.end('ROLLBACK;\n\\q\n');
const hash=async p=>{const h=createHash('sha256');for await(const b of fs.createReadStream(p))h.update(b);return h.digest('hex');};
const files=root=>fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(root,e.name)):[path.join(root,e.name)]);
const publicRoot=path.resolve('public'),oldRestored=path.join(prior,'restored-files','public'),currentFiles=files(publicRoot);
const freshFiles=process.argv.includes('--fresh-files');
const reuseVerified=process.argv.includes('--reuse-verified-files');
const reusable=path.resolve('backups/approved-2026-10-29T12-48-10-733Z');
const reusableReport=reuseVerified?JSON.parse(fs.readFileSync(path.join(reusable,'complete-verification.json'),'utf8')):null;
if(reuseVerified&&(!reusableReport.filesVerified||!reusableReport.databaseVerified))throw Error('Verified immutable file snapshot required');
if(freshFiles){
 for(const file of currentFiles){const relative=path.relative(publicRoot,file),digest=await hash(file);for(const base of [output,second]){const destination=path.join(base,'public-files',relative);fs.mkdirSync(path.dirname(destination),{recursive:true});const old=path.join(base===output?reusable:(reusableReport?.independentCopy||''),'public-files',relative);if(reuseVerified&&fs.existsSync(old)&&await hash(old)===digest){fs.linkSync(old,destination)}else{const free=fs.statfsSync(path.dirname(destination));if(free.bavail*free.bsize<fs.statSync(file).size+5*1024**3)throw Error('Insufficient backup disk reserve');fs.copyFileSync(file,destination,fs.constants.COPYFILE_EXCL)}if(await hash(destination)!==digest)throw new Error('File backup mismatch');}}
}else{
if(currentFiles.length!==files(oldRestored).length)throw new Error('Files changed; a new archive is required');
for(const file of currentFiles){const other=path.join(oldRestored,path.relative(publicRoot,file));if(!fs.existsSync(other)||await hash(file)!==await hash(other))throw new Error('Files changed; a new archive is required');}
// The archive is reused only after every current file matches its restored copy.
fs.copyFileSync(path.join(prior,'public-files.zip'),path.join(output,'public-files.zip'),fs.constants.COPYFILE_EXCL);
}
const checks=[];
for(const name of freshFiles?['database.dump']:['database.dump','public-files.zip']){fs.copyFileSync(path.join(output,name),path.join(second,name),fs.constants.COPYFILE_EXCL);const digest=await hash(path.join(output,name));if(digest!==await hash(path.join(second,name)))throw new Error('Independent copy mismatch');checks.push({name,sha256:digest});}
const report={checkedAt:new Date().toISOString(),source,target,restoreMs,results:before,constraintsMatch:true,databaseVerified:true,filesVerified:true,filesCount:currentFiles.length,filesVerifiedFrom:freshFiles?path.join(output,'public-files'):oldRestored,checks,independentCopy:second,workingWrites:0};
for(const dir of [output,second])fs.writeFileSync(path.join(dir,'complete-verification.json'),JSON.stringify(report,null,2),{flag:'wx'});
console.log(JSON.stringify({output,second,restoreMs,tables:before.length,files:currentFiles.length,verified:true}));
