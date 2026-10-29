import { describe, expect, it } from 'vitest';
import { createCompetitionInput, editCompetitionInput } from './competition-input';
const base={seasonId:'d70e14aa-38e1-4aca-b853-e409d7669825',name:'Апрельский турнир',type:'TOURNAMENT',sortOrder:0};
describe('Competition editor input',()=>{
  it('accepts tournament and championship names',()=>{expect(createCompetitionInput.parse(base).name).toBe(base.name);expect(createCompetitionInput.safeParse({...base,type:'CHAMPIONSHIP'}).success).toBe(true)});
  it('rejects invalid season, type, name and order',()=>{for(const change of [{seasonId:'x'},{type:'OTHER'},{name:' '},{name:'a'.repeat(121)},{sortOrder:-1},{sortOrder:1.5},{sortOrder:10000}])expect(createCompetitionInput.safeParse({...base,...change}).success).toBe(false)});
  it('rejects unauthorized fields and preserves version requirement',()=>{expect(createCompetitionInput.safeParse({...base,isActive:true}).success).toBe(false);const edit={id:base.seasonId,name:base.name,sortOrder:0,updatedAt:'2026-10-29T00:00:00.000Z'};expect(editCompetitionInput.safeParse(edit).success).toBe(true);expect(editCompetitionInput.safeParse({...edit,seasonId:base.seasonId}).success).toBe(false);expect(editCompetitionInput.safeParse({...edit,updatedAt:''}).success).toBe(false)});
});
