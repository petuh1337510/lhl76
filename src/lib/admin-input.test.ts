import {it,expect} from 'vitest';
import {validAdminInput} from './admin-input';
it('does not coerce arrays or booleans into suspension lengths',()=>{for(const matchesCount of [[1],true,null,0,'0','1.5'])expect(validAdminInput('/api/admin/suspensions',{matchesCount})).toBe(false);for(const matchesCount of [1,'2'])expect(validAdminInput('/api/admin/suspensions',{matchesCount})).toBe(true)});
it('rejects malformed profile input and impossible dates',()=>{for(const body of [{firstName:{}},{heightCm:-1},{birthDate:'2026-02-30'},{lastName:'x'.repeat(101)}])expect(validAdminInput('/api/admin/player',body)).toBe(false)});
it('accepts legitimate profiles and rejects invalid roster enums',()=>{expect(validAdminInput('/api/admin/player',{firstName:'Иван',birthDate:'2000-02-29',heightCm:'180'})).toBe(true);expect(validAdminInput('/api/admin/roster',{leadership:'OWNER'})).toBe(false)});
