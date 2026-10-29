import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const baseline=JSON.parse(readFileSync(process.argv[2]||'backups/final-safety-20261028-191346/verification.json','utf8'));
const results=baseline.results.map(row=>{
 if(!/^\w+$/.test(row.table))throw new Error('Invalid table');
 const sql=`SELECT count(*) || ':' || coalesce(md5(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text)), 'empty') FROM public."${row.table}" t`;
 const actual=execFileSync('docker',['exec','senior-full-stack-76-wordpress-wordpress-postgres-1','psql','-U','lhl76','-d','lhl76_import_test','-At','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8'}).trim();
 return {table:row.table,unchanged:actual===`${row.count}:${row.fingerprint}`,count:row.count};
});
const report={checkedAt:new Date().toISOString(),allUnchanged:results.every(r=>r.unchanged),results};
writeFileSync(process.argv[3]||'artifacts/final-readiness/working-data-unchanged.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({tables:results.length,allUnchanged:report.allUnchanged}));if(!report.allUnchanged)process.exitCode=1;
