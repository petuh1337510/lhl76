import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomBytes,scryptSync,createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
const root=path.resolve(process.argv[2]);
if(!root.startsWith('D:\\LHL76-Rehearsals\\'))throw Error('Isolated rehearsal directory required');
const meta=JSON.parse(fs.readFileSync(path.join(root,'rehearsal.json'),'utf8'));
const source=new URL(process.env.DATABASE_URL),target=new URL(source);
target.port=String(meta.target.port);target.pathname='/'+meta.target.database;
if(target.port===source.port||target.pathname===source.pathname||target.port!=='55433')throw Error('Working database forbidden');
const db=new PrismaClient({datasourceUrl:target.href});
const env={...process.env,NODE_ENV:'production',DATABASE_URL:target.href,AUTH_SECRET:randomBytes(48).toString('hex'),PUBLIC_SITE_URL:'https://lhl-76.ru',RATE_LIMIT_DIR:path.join(root,'cycle-limits'),VK_API_ACCESS_TOKEN:'',ALLOW_ADMIN_SETUP:'0'};
const report={startedAt:new Date().toISOString(),database:meta.target.database,checks:[]};let child,user,player;
const check=(name,ok)=>{report.checks.push({name,ok:!!ok});console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)throw Error(name)};
const base='http://127.0.0.1:3020';
async function stop(){if(child&&child.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}child=null;}
async function start(dist){child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','-p','3020','-H','127.0.0.1'],{cwd:root,env:{...env,NEXT_DIST_DIR:dist},stdio:['ignore','ignore','ignore']});for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Rehearsal start failed');try{if((await fetch(base+'/api/ready',{signal:AbortSignal.timeout(2000)})).ok)return}catch{}await new Promise(r=>setTimeout(r,200))}throw Error('Readiness timeout')}
const file=path.join(root,'public/uploads','cycle-'+Date.now()+'.txt'),content=randomBytes(48);fs.writeFileSync(file,content,{flag:'wx'});
try{
 const counts=async()=>Promise.all([db.match.count(),db.goal.count(),db.rosterEntry.count(),db.playerStatistic.count()]);const before=await counts();
 await start('.next');check('version A ready',true);
 player=await db.player.create({data:{firstName:'Isolated',lastName:'Rollback check',slug:'cycle-'+Date.now()}});
 await stop();await start('.next-release-b');check('update B preserves new data',!!await db.player.findUnique({where:{id:player.id}}));check('update B preserves upload',fs.readFileSync(file).equals(content));
 await stop();await start('.next');check('rollback A preserves new data',!!await db.player.findUnique({where:{id:player.id}}));check('rollback A preserves upload',fs.readFileSync(file).equals(content));
 await stop();await start('.next-release-b');check('sports record counts unchanged',JSON.stringify(before)===JSON.stringify(await counts()));
 const password=randomBytes(24).toString('hex'),salt=randomBytes(16);
 user=await db.user.create({data:{email:`visual-${Date.now()}@audit.invalid`,name:'Temporary visual audit',role:'SUPER_ADMIN',active:true,passwordHash:`scrypt:${salt.toString('hex')}:${scryptSync(password,salt,64).toString('hex')}`}});
 fs.writeFileSync(path.join(root,'visual-session.json'),JSON.stringify({base,email:user.email,password}),{flag:'wx'});
 fs.writeFileSync(path.join(root,'release-cycle.json'),JSON.stringify({...report,completedAt:new Date().toISOString(),mode:'Next production; Docker packaging not claimed'},null,2));
 console.log('READY FOR VISUAL QA: '+base);
 await new Promise(resolve=>{process.on('SIGINT',resolve);process.on('SIGTERM',resolve)});
}finally{await stop();if(user)await db.user.delete({where:{id:user.id}});if(player)await db.player.delete({where:{id:player.id}});await db.$disconnect();}
