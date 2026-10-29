// Node 22+. Decrypt only to a NEW file; never writes a database or extracts paths.
// Usage: node decrypt-handoff.mjs data.tar.aes password-file.txt restored.tar
import fs from 'node:fs';
import {createDecipheriv,scryptSync} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
const [input,keyFile,output]=process.argv.slice(2);
if(!input||!keyFile||!output||fs.existsSync(output)||fs.existsSync(output+'.unverified'))throw Error('Provide input, key file and a NEW output path');
const handle=fs.openSync(input,'r'),header=Buffer.alloc(36),tag=Buffer.alloc(16),size=fs.statSync(input).size;
if(size<52)throw Error('Invalid encrypted archive');
fs.readSync(handle,header,0,36,0);fs.readSync(handle,tag,0,16,size-16);fs.closeSync(handle);
if(header.subarray(0,8).toString()!=='LHL76A01')throw Error('Unsupported archive format');
const password=fs.readFileSync(keyFile,'utf8').trim();
const key=scryptSync(password,header.subarray(8,24),32,{N:32768,r:8,p:1,maxmem:64*1024*1024});
const cipher=createDecipheriv('aes-256-gcm',key,header.subarray(24,36));cipher.setAAD(header);cipher.setAuthTag(tag);
try{await pipeline(fs.createReadStream(input,{start:36,end:size-17}),cipher,fs.createWriteStream(output+'.unverified',{flags:'wx',mode:0o600}));fs.renameSync(output+'.unverified',output);console.log('Archive authenticated and decrypted. Verify SHA256 before extraction.');}
catch{console.error('Authentication/decryption failed. Do NOT use the .unverified file.');process.exitCode=1;}
