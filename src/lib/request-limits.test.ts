import {describe,it,expect} from 'vitest';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {consumeLimit,clientKey} from './request-limits';
describe('persistent limiter boundaries',()=>{
 it('shares a limit between independent processes and after restart',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'lhl-limiter-'));
  const run=()=>new Promise<number>((resolve,reject)=>{
   const child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',`import {consumeLimit} from './src/lib/request-limits.ts';process.stdout.write(String(await consumeLimit('same-key',3,86400000)));`],{env:{...process.env,NODE_ENV:'production',RATE_LIMIT_DIR:root},stdio:['ignore','pipe','pipe']});
   let output='';child.stdout.on('data',d=>output+=d);child.on('error',reject);child.on('exit',code=>code===0?resolve(output==='true'?1:0):reject(Error('Limiter child failed')));
  });
  try{const first=await Promise.all(Array.from({length:6},run));expect(first.reduce((a,b)=>a+b,0)).toBe(3);expect(await run()).toBe(0)}finally{await rm(root,{recursive:true,force:true})}
 },15000);
 it('does not reset a corrupt persisted counter',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'lhl-limiter-'));
  try{const id=createHash('sha256').update('broken:'+Math.floor(Date.now()/86400000)).digest('hex');await writeFile(path.join(root,id+'.json'),'broken');expect(await consumeLimit('broken',3,86400000,root)).toBe(false)}finally{await rm(root,{recursive:true,force:true})}
 });
 it('ignores untrusted forwarded addresses',()=>{expect(clientKey(new Request('http://localhost',{headers:{'x-forwarded-for':'1.2.3.4','x-real-ip':'5.6.7.8'}}))).toBe('local')});
});
