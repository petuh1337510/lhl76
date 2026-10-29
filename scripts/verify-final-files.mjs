import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const backup=path.resolve(process.argv[2]||'');
if(!backup.startsWith(path.resolve('backups')+path.sep))throw new Error('Invalid backup path');
const report=JSON.parse(fs.readFileSync(path.join(backup,'restore-verification.json'),'utf8'));
if(!report.databaseVerified)throw new Error('Database not verified');
const restored=path.join(backup,'restored-files');
if(fs.existsSync(restored))throw new Error('Restore directory exists; will not overwrite');
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
