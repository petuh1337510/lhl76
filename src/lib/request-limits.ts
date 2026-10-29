import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rmdir,opendir,stat,unlink} from 'node:fs/promises';
import path from 'node:path';

export async function readBounded(request:Request,max:number){
 if(Number(request.headers.get('content-length'))>max)throw new Error('BODY_LIMIT');
 const reader=request.body?.getReader();if(!reader)return Buffer.alloc(0);
 const chunks:Uint8Array[]=[];let size=0;
 const deadline=Date.now()+30000;
 try{for(;;){let timer:ReturnType<typeof setTimeout>|undefined;let part:ReadableStreamReadResult<Uint8Array>;try{part=await Promise.race([reader.read(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('BODY_TIMEOUT')),Math.max(1,deadline-Date.now()));})]);}finally{clearTimeout(timer);}const {done,value}=part;if(done)break;size+=value.length;if(size>max)throw new Error('BODY_LIMIT');chunks.push(value);}}finally{await reader.cancel();}
 return Buffer.concat(chunks);
}
/** Shared by Node processes on one host. A multi-host deployment needs a shared store. */
export async function consumeLimit(key:string,limit:number,windowMs:number,root=process.env.RATE_LIMIT_DIR||path.join(process.cwd(),'.runtime','limits')){
 if(process.env.NODE_ENV==='production'&&!process.env.RATE_LIMIT_DIR)throw new Error('Persistent RATE_LIMIT_DIR required');
 await mkdir(root,{recursive:true,mode:0o700});
 await cleanupLimits(root);
 // A crashed lock cannot block a user beyond this window. No stale lock is
 // removed while its current owner could still be using it.
 const bucket=Math.floor(Date.now()/windowMs);
 const id=createHash('sha256').update(key+':'+bucket).digest('hex');const file=path.join(root,id+'.json'),lock=path.join(root,id+'.lock');
 let acquired=false;
 for(let i=0;i<20;i++){try{await mkdir(lock);acquired=true;break;}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;await new Promise(r=>setTimeout(r,10));}}
 if(!acquired)return false;
 try{
  const now=Date.now();let state={count:0,until:(bucket+1)*windowMs};
  try{const saved=JSON.parse(await readFile(file,'utf8'));if(!Number.isSafeInteger(saved.count)||saved.count<0||!Number.isFinite(saved.until))return false;if(saved.until>now)state=saved;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')return false;}
  if(state.count>=limit)return false;
  state.count++;const temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(state),{mode:0o600,flag:'wx'});await rename(temporary,file);return true;
 }finally{await rmdir(lock);}
}
let lastCleanup=0;
async function cleanupLimits(root:string){
 if(Date.now()-lastCleanup<60000)return;lastCleanup=Date.now();
 let count=0;try{for await(const entry of await opendir(root)){
  if(++count>512)break;if(!/^[a-f0-9]{64}\.(json|lock)$/.test(entry.name))continue;
  const file=path.join(root,entry.name);try{if(Date.now()-(await stat(file)).mtimeMs>3600000){if(entry.isDirectory())await rmdir(file);else await unlink(file);}}catch{}
 }}catch{}
}
export function clientKey(request:Request){
 // Only enable behind an ingress which replaces this header, never appends it.
 return process.env.TRUST_PROXY_IP==='1'?(request.headers.get('x-real-ip')||'unknown').slice(0,64):'local';
}
