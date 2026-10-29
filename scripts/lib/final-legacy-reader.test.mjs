import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
const expect=value=>({toEqual:other=>assert.deepEqual(value,other),toThrow:()=>assert.throws(value)});
import {parseValues} from './final-legacy-reader.mjs';
describe('strict legacy dump parser',()=>{
  it('preserves quoted numbers, whitespace and NULL strings',()=>expect(parseValues("(1,'004',' NULL ','',NULL); ")).toEqual([[1,'004',' NULL ','',null]]));
  it('handles MySQL escapes and doubled quotes',()=>expect(parseValues("(1,'a\\\\b','O''Brien','a\\nb'),(2,'x,y)','\\\'','\\0');")).toEqual([[1,'a\\b',"O'Brien",'a\nb'],[2,'x,y)',"'",'\0']]));
  it('rejects expressions and truncated tuples',()=>{for(const s of ["(1,NOW());","(1,'x",'(1,2','(9007199254740993);'])expect(()=>parseValues(s)).toThrow();});
});
