// Mutations are restricted to the restored database; never the live database.
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {randomBytes,scryptSync} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
const backup=JSON.parse(fs.readFileSync('backups/approved-2026-10-29T12-48-10-733Z/complete-verification.json','utf8'));
const source=new URL(process.env.DATABASE_URL),url=new URL(source);
url.port=String(backup.target.port);url.pathname='/'+backup.target.database;
if(url.port===source.port||url.pathname===source.pathname||url.hostname!==source.hostname||!backup.databaseVerified)throw Error('Unsafe test target');
const db=new PrismaClient({datasourceUrl:url.href});
const base='http://127.0.0.1:3018',checks=[],users=[];
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3018','-H','127.0.0.1'],{env:{...process.env,NODE_ENV:'production',NEXT_DIST_DIR:'.next-security-check',DATABASE_URL:url.href,AUTH_SECRET:randomBytes(48).toString('hex'),RATE_LIMIT_DIR:'.runtime/security-'+Date.now(),VK_API_ACCESS_TOKEN:'',TRUST_PROXY_IP:'0'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',()=>{}); // Do not emit connection details from unexpected diagnostics.
const request=(p,o={})=>fetch(base+p,{...o,redirect:'manual',signal:AbortSignal.timeout(20000)});
const check=(name,ok)=>{checks.push({name,ok:Boolean(ok)});console.log((ok?'PASS ':'FAIL ')+name)};
const login=(email,password)=>request('/api/admin/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
try{
 let ready=false;for(let i=0;i<80;i++){try{if((await request('/api/ready')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,250))}if(!ready)throw Error('Test server not ready');
 check('anonymous admin API denied',(await request('/api/admin/users')).status===401);
 check('foreign Origin denied',(await request('/api/admin/auth/login',{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/json'},body:'{}'})).status===403);
 const password=randomBytes(24).toString('hex'),salt=randomBytes(16),passwordHash=`scrypt:${salt.toString('hex')}:${scryptSync(password,salt,64).toString('hex')}`;
 for(const role of ['SUPER_ADMIN','SECRETARY']){
  const user=await db.user.create({data:{email:`security-${role.toLowerCase()}-${Date.now()}@audit.invalid`,name:'Isolated security test',role,passwordHash,active:true}});users.push(user.id);
  const r=await login(user.email,password),cookie=r.headers.get('set-cookie')||'';
  check(role+' login',r.status===200);check(role+' secure cookie',cookie.includes('HttpOnly')&&cookie.includes('Secure')&&/SameSite=lax/i.test(cookie));
  const headers={Cookie:cookie.split(';')[0],Origin:base,'Content-Type':'application/json'};
  if(role==='SECRETARY'){
   check('secretary retains match access',(await request('/api/admin/matches',{headers})).status===200);
   check('secretary cannot edit users',(await request('/api/admin/users',{headers})).status===403);
  }else{
   for(const [path,field] of [['documents','fileUrl'],['homepage-content','link'],['venues','mapUrl'],['laureates','link']]){
    for(const value of ['javascript:alert(1)','data:text/html,test','//evil.example/a','https://127.0.0.1/a','/\\evil.example']){
     check(path+' rejects '+value,(await request('/api/admin/'+path,{method:'POST',headers,body:JSON.stringify({title:'Rejected test',name:'Rejected test',[field]:value})})).status===400);
    }
   }
   check('invalid JSON rejected',(await request('/api/admin/documents',{method:'POST',headers,body:'{'})).status===400);
   const form=new FormData();form.set('kind','documents');form.set('file',new Blob(['<script>alert(1)</script>'],{type:'application/pdf'}),'fake.pdf');
   check('disguised HTML file rejected',(await request('/api/admin/upload',{method:'POST',headers:{Cookie:headers.Cookie,Origin:base},body:form})).status===400);
  }
  await db.user.update({where:{id:user.id},data:{active:false}});
  check(role+' session revoked after disable',(await request('/api/admin/auth/me',{headers})).status===401);
 }
 let previous='';for(const path of ['/','/admin/login','/news','/documents','/venues','/team/hctanki76?tab=roster']){
  const r=await request(path),html=await r.text(),csp=r.headers.get('content-security-policy')||'',nonce=csp.match(/'nonce-([^']+)'/)?.[1];
  check(path+' loads',r.status===200);check(path+' enforcing nonce CSP',nonce&&!csp.includes('unsafe-eval')&&!csp.match(/script-src[^;]*unsafe-inline/));
  check(path+' script nonces',Boolean(nonce)&&[...html.matchAll(/<script\b[^>]*>/g)].every(m=>m[0].includes('nonce="'+nonce+'"')));
  check(path+' nonce not reused',nonce&&nonce!==previous);previous=nonce;
 }
 const attempts=[];for(let i=0;i<11;i++)attempts.push((await login('rate-security@audit.invalid','wrong')).status);
 check('login attempts limited',attempts.includes(429));
}finally{
 if(users.length)await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();child.kill();
 fs.mkdirSync('artifacts/security-fixes',{recursive:true});fs.writeFileSync('artifacts/security-fixes/checks.json',JSON.stringify({finishedAt:new Date().toISOString(),testDatabase:backup.target.database,checks},null,2));
}
if(checks.some(x=>!x.ok))process.exitCode=1;
