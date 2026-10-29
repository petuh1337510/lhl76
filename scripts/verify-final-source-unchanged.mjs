import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const backup=path.resolve(process.argv[2]||''),dir=path.resolve(process.argv[3]||'');
if(!backup.startsWith(path.resolve('backups')+path.sep)||!dir.startsWith(path.resolve('work')+path.sep))throw new Error('Unexpected paths');
const baseline=JSON.parse(fs.readFileSync(path.join(backup,'complete-verification.json'),'utf8'));
const results=baseline.results.map(row=>{
 if(!/^\w+$/.test(row.table))throw new Error('Invalid table');
 const sql=`SELECT count(*) || ':' || coalesce(md5(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text)), 'empty') FROM public."${row.table}" t`;
 const actual=execFileSync('docker',['exec',baseline.source.container,'psql','-U','lhl76','-d',baseline.source.database,'-At','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8'}).trim();
 return {table:row.table,unchanged:actual===`${row.count}:${row.fingerprint}`,count:row.count};
});
const report={checkedAt:new Date().toISOString(),allUnchanged:results.every(r=>r.unchanged),results};fs.writeFileSync(path.join(dir,`working-unchanged-${Date.now()}.json`),JSON.stringify(report,null,2),{flag:'wx'});
console.log(JSON.stringify({tables:results.length,allUnchanged:report.allUnchanged}));if(!report.allUnchanged)process.exitCode=1;
