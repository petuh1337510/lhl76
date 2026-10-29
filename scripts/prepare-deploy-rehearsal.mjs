import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const source=process.cwd(),backup=path.resolve(process.argv[2]);
const report=JSON.parse(fs.readFileSync(path.join(backup,'complete-verification.json'),'utf8'));
if(!report.databaseVerified||!report.filesVerified||report.target.port!==55433||report.target.database===report.source.database)throw Error('Verified isolated backup required');
const free=fs.statfsSync('D:/');if(free.bavail*free.bsize<12*1024**3)throw Error('Not enough rehearsal disk space');
const destination=path.join('D:/LHL76-Rehearsals','release-'+Date.now());fs.mkdirSync(destination,{recursive:true});
const folders=['src','prisma','scripts'];
for(const name of folders)fs.cpSync(path.join(source,name),path.join(destination,name),{recursive:true,errorOnExist:true,force:false});
for(const name of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','next.config.ts','next-env.d.ts','tsconfig.json','vitest.config.ts','eslint.config.mjs','Dockerfile','docker-entrypoint.sh'])fs.copyFileSync(path.join(source,name),path.join(destination,name),fs.constants.COPYFILE_EXCL);
// Real file copies, never links to live uploads or backup contents.
fs.cpSync(path.join(backup,'public-files'),path.join(destination,'public'),{recursive:true,errorOnExist:true,force:false});
// Install the frozen dependency tree on this drive before building. Cross-drive
// junctions break Next's Windows entrypoint resolution. Never copy a live .env.
const working=new URL(process.env.DATABASE_URL),role=working.username;
if(!/^lhl_app_\d+$/.test(role))throw Error('Unexpected application role');
execFileSync('docker',['exec',report.target.container,'psql','-U',report.target.user,'-d',report.target.database,'-v','ON_ERROR_STOP=1','-c',`GRANT USAGE ON SCHEMA public TO "${role}"; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO "${role}"; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO "${role}";`],{stdio:'pipe'});
fs.writeFileSync(path.join(destination,'rehearsal.json'),JSON.stringify({source,backup,target:report.target,applicationPort:3020,preparedAt:new Date().toISOString()},null,2),{flag:'wx'});
console.log(JSON.stringify({destination,database:report.target.database,port:3020,workingConnectionChanged:false}));
