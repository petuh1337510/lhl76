import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const backup=process.argv[2];
if(!backup)throw Error('Verified backup directory required');
const report=JSON.parse(fs.readFileSync(path.join(backup,'complete-verification.json'),'utf8'));
if(!report.databaseVerified||!report.filesVerified||!fs.existsSync(path.join(report.independentCopy,'database.dump')))throw Error('Verified independent backup required');
const run=args=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:64*1024*1024});
const sql=(target,query)=>run(['exec',target.container,'psql','-U',target.user,'-d',target.database,'-At','-v','ON_ERROR_STOP=1','-c',query]).trim();
const excluded={Match:['playoffSeriesId','playoffGame'],Playoff:['published','revision'],PlayoffSeries:['sortOrder','sourceHomeId','sourceAwayId','sourceOutcome']};
function fingerprint(target){return report.results.map(({table})=>{
  if(!/^\w+$/.test(table))throw Error('Invalid table');
  const columns=excluded[table]||[];
  const expression=columns.length?`to_jsonb(t) - ARRAY[${columns.map(c=>`'${c}'`).join(',')}]`:'to_jsonb(t)';
  return sql(target,`SELECT count(*) || ':' || coalesce(md5(string_agg((${expression})::text,E'\\n' ORDER BY (${expression})::text)),'empty') FROM "${table}" t`);
})}
const target=process.argv.includes('--working')?report.source:report.target;
if(!process.argv.includes('--working')&&(target.port!==55433||target.container===report.source.container))throw Error('Isolation check failed');
if(process.argv.includes('--working')&&!fs.existsSync(path.join(backup,'playoff-schema-rehearsal.json')))throw Error('Rehearsal required first');
const before=fingerprint(target);
const script=fs.readFileSync('scripts/migrations/20261029-playoff.sql','utf8');
sql(target,script);
const after=fingerprint(target);
if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Existing data fingerprint changed');
const result={at:new Date().toISOString(),target:{container:target.container,database:target.database},existingRowsUnchanged:true,tables:before.length};
fs.writeFileSync(path.join(backup,process.argv.includes('--working')?'playoff-schema-working.json':'playoff-schema-rehearsal.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify(result));
