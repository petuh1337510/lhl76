import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const dir=path.resolve(process.argv[2]||''),backup=path.resolve(process.argv[3]||'');
if(!dir.startsWith(path.resolve('work')+path.sep)||!backup.startsWith(path.resolve('backups')+path.sep))throw new Error('Invalid paths');
const report=JSON.parse(fs.readFileSync(path.join(backup,'complete-verification.json'),'utf8'));
if(!report.databaseVerified||!report.filesVerified||!report.target.container.startsWith('lhl76-final-reconcile-'))throw new Error('Verified test restore required');
const container=report.target.container,user=report.target.user,database='lhl76_final_rehearsal_clean';
const run=args=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:32*1024*1024});
run(['exec',container,'createdb','-U',user,database]); // fails if already present; never replaces a database
run(['exec',container,'pg_restore','-U',user,'-d',database,'--exit-on-error','--no-owner','--no-privileges','/tmp/source.dump']);
for(const row of report.results){if(!/^\w+$/.test(row.table))throw new Error('Invalid table');const sql=`SELECT count(*) || ':' || coalesce(md5(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text)), 'empty') FROM public."${row.table}" t`;const value=run(['exec',container,'psql','-U',user,'-d',database,'-At','-c',sql]).trim();if(value!==`${row.count}:${row.fingerprint}`)throw new Error('Fresh clone mismatch');}
const cleanDir=path.join(dir,'clean-rehearsal'),cleanBackup=path.join(backup,'clean-rehearsal');fs.mkdirSync(cleanDir);fs.mkdirSync(cleanBackup);
for(const name of ['source.sql','summary.json','current-snapshot.json','field-differences.json','new-record-candidates.json','event-differences.json','media.json','staged-media-results.json','three-way-review.json','new-player-review.json','squad-differences.json'])fs.copyFileSync(path.join(dir,name),path.join(cleanDir,name),fs.constants.COPYFILE_EXCL);
fs.writeFileSync(path.join(cleanBackup,'complete-verification.json'),JSON.stringify({...report,target:{...report.target,database},cleanRestoreVerifiedAt:new Date().toISOString(),filesVerifiedFrom:path.join(backup,'complete-verification.json')},null,2),{flag:'wx'});
console.log(JSON.stringify({cleanDir,cleanBackup,verifiedTables:report.results.length}));
