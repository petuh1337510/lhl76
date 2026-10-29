import {expect,it} from 'vitest';
import {editVersion,nextEditVersion} from './edit-version';
it('requires a real version instead of silently overwriting',()=>{for(const value of [null,undefined,'','invalid',42])expect(()=>editVersion(value)).toThrow();expect(editVersion('2026-10-29T12:00:00.000Z').toISOString()).toBe('2026-10-29T12:00:00.000Z')});
it('advances even when two writes fall in the same millisecond',()=>{const previous=new Date(Date.now()+10000);expect(nextEditVersion(previous).getTime()).toBe(previous.getTime()+1)});
