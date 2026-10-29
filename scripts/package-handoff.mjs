import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes,createHash,createCipheriv,scryptSync} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
const backup=path.resolve(process.argv[2]),source=process.cwd();
const verified=JSON.parse(fs.readFileSync(path.join(backup,'complete-verification.json'),'utf8'));
if(!verified.databaseVerified||!verified.filesVerified)throw Error('Verified backup required');
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),root=path.join('D:/LHL76-Handoff',stamp),code=path.join(root,'source');
fs.mkdirSync(code,{recursive:true});
for(const name of ['src'])fs.cpSync(path.join(source,name),path.join(code,name),{recursive:true});
fs.mkdirSync(path.join(code,'prisma'));fs.copyFileSync('prisma/schema.prisma',path.join(code,'prisma/schema.prisma'));
fs.mkdirSync(path.join(code,'docs'));for(const name of ['DEPLOY-GATES.txt','DEPLOY-HANDOFF.txt'])fs.copyFileSync(path.join('docs',name),path.join(code,'docs',name));
fs.mkdirSync(path.join(code,'scripts'));fs.copyFileSync('scripts/decrypt-handoff.mjs',path.join(code,'scripts/decrypt-handoff.mjs'));
fs.cpSync('public/images',path.join(code,'public/images'),{recursive:true});
for(const name of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','next.config.ts','next-env.d.ts','tsconfig.json','vitest.config.ts','eslint.config.mjs','Dockerfile','docker-entrypoint.sh','docker-compose.production.yml','.env.example','.gitignore','.dockerignore'])fs.copyFileSync(name,path.join(code,name));
const pkg=JSON.parse(fs.readFileSync(path.join(code,'package.json'),'utf8'));
pkg.scripts={dev:'next dev',build:'next build',start:'next start',lint:'eslint src',test:'vitest run','db:generate':'prisma generate'};
fs.writeFileSync(path.join(code,'package.json'),JSON.stringify(pkg,null,2)+'\n');
fs.copyFileSync('docs/DEPLOY-HANDOFF.txt',path.join(code,'README.txt'));
const list=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?list(path.join(dir,e.name)):[path.join(dir,e.name)]);
const env=fs.readFileSync('.env.local','utf8'),secrets=[];
for(const line of env.split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=["']?(.*?)["']?$/);if(m&&/(SECRET|TOKEN|DATABASE_URL|PASSWORD)/.test(m[1])&&m[2].length>12)secrets.push(m[2]);}
const codeFiles=list(code);for(const file of codeFiles){if(/(?:\.env\.local|\.dump|\.sql|\.log|password-file)/i.test(file))throw Error('Forbidden release file');const data=fs.readFileSync(file);for(const secret of secrets)if(data.includes(Buffer.from(secret)))throw Error('Secret found in release: '+path.relative(code,file));}
const hash=async file=>{const h=createHash('sha256');for await(const chunk of fs.createReadStream(file))h.update(chunk);return h.digest('hex')};
const sourceTar=path.join(root,'lhl76-source.tar.gz');execFileSync('tar',['-czf',sourceTar,'-C',code,'.']);
fs.copyFileSync('docs/DEPLOY-HANDOFF.txt',path.join(root,'START-HERE.txt'));fs.copyFileSync('scripts/decrypt-handoff.mjs',path.join(root,'decrypt-handoff.mjs'));
const secretDir='D:/LHL76-Handoff-Keys';fs.mkdirSync(secretDir,{recursive:true});const password=randomBytes(32).toString('base64url'),passwordFile=path.join(secretDir,stamp+'.txt');fs.writeFileSync(passwordFile,password+'\n',{flag:'wx',mode:0o600});
const salt=randomBytes(16),iv=randomBytes(12),header=Buffer.concat([Buffer.from('LHL76A01'),salt,iv]),key=scryptSync(password,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});
const encrypted=path.join(root,'lhl76-data.tar.aes');fs.writeFileSync(encrypted,header,{flag:'wx'});const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(header);
const tar=spawn('tar',['-cf','-','-C',backup,'database.dump','public-files','complete-verification.json'],{stdio:['ignore','pipe','pipe']});const ended=new Promise((resolve,reject)=>{tar.on('error',reject);tar.on('exit',c=>c===0?resolve():reject(Error('Archive failed')))});tar.stderr.on('data',()=>{});
await Promise.all([pipeline(tar.stdout,cipher,fs.createWriteStream(encrypted,{flags:'a'})),ended]);fs.appendFileSync(encrypted,cipher.getAuthTag());
const restored=path.join(root,'verified-data.tar');execFileSync(process.execPath,['scripts/decrypt-handoff.mjs',encrypted,passwordFile,restored],{stdio:'pipe'});
const extract=path.join(root,'verification');fs.mkdirSync(extract);execFileSync('tar',['-xf',restored,'-C',extract]);
const originals=[path.join(backup,'database.dump'),...list(path.join(backup,'public-files'))];for(const file of originals){const relative=path.relative(backup,file);if(await hash(file)!==await hash(path.join(extract,relative)))throw Error('Restored mismatch: '+relative);}
const report={createdAt:new Date().toISOString(),sourceFiles:codeFiles.length,sourceArchive:{name:path.basename(sourceTar),sha256:await hash(sourceTar)},dataArchive:{name:path.basename(encrypted),sha256:await hash(encrypted)},verifiedFiles:originals.length,verifiedDatabaseBackup:verified.checkedAt,workingWrites:0,secretsExcluded:true};
fs.writeFileSync(path.join(root,'CHECKSUMS.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({root,passwordFile,...report}));
