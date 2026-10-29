import {describe,it,expect} from 'vitest';
import {authSecret,allowedAdminPath,safeAdminReturn,sameOriginMutation} from './security-policy';
import {consumeLimit,readBounded} from './request-limits';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
describe('security boundaries',()=>{
 it('uses browser Host without trusting forwarded hosts',()=>{expect(sameOriginMutation('http://127.0.0.1:3001','http://localhost:3001/api',null,'127.0.0.1:3001')).toBe(true);expect(sameOriginMutation('https://evil.test','http://localhost:3001/api',null,'league.test')).toBe(false);});
 it('rejects missing or example production secrets',()=>{for(const s of ['', 'local-development-secret-change-me','change-this-to-a-long-random-secret'])expect(()=>authSecret({NODE_ENV:'production',AUTH_SECRET:s})).toThrow();});
 it('limits secretary and user administration',()=>{expect(allowedAdminPath('SECRETARY','/api/admin/users')).toBe(false);expect(allowedAdminPath('ADMIN','/api/admin/users')).toBe(false);expect(allowedAdminPath('SECRETARY','/api/admin/match-protocol')).toBe(true);expect(allowedAdminPath('SECRETARY','/api/admin/matches-extra')).toBe(false);});
 it('rejects cross-origin mutations and redirects',()=>{expect(sameOriginMutation('https://evil.test','https://league.test/admin',null)).toBe(false);expect(sameOriginMutation(null,'https://league.test/admin',null)).toBe(false);expect(sameOriginMutation('https://league.test','https://league.test/admin','same-origin')).toBe(true);expect(safeAdminReturn('//evil.test')).toBe('/admin');expect(safeAdminReturn('/admin?x=1')).toBe('/admin?x=1');});
 it('bounds streamed bodies without content-length',async()=>{await expect(readBounded(new Request('http://localhost',{method:'POST',body:'123456'}),3)).rejects.toThrow('BODY_LIMIT');});
 it('serializes concurrent limit attempts',async()=>{const dir=await mkdtemp(path.join(tmpdir(),'lhl-limit-test-'));try{const results=await Promise.all(Array.from({length:8},()=>consumeLimit('same',3,10000,dir)));expect(results.filter(Boolean)).toHaveLength(3);}finally{await rm(dir,{recursive:true});}});
});
