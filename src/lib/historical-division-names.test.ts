import {describe,it,expect} from 'vitest';
import {canonicalDivisionName,historicalDivisionNames} from './historical-division-names';
describe('division choices',()=>{
  it('normalizes approved plus aliases without merging Amateur',()=>{
    for(const name of ['Плюс','Любитель+','Любитель +','ЛЮБИТЕЛЬ ПЛЮС'])expect(canonicalDivisionName(name)).toBe('Любитель Плюс');
    expect(canonicalDivisionName('Любитель')).toBe('Любитель');
    expect(canonicalDivisionName('Новый дивизион')).toBe('Новый дивизион');
  });
  it('contains five distinct historical divisions',()=>{expect(historicalDivisionNames).toHaveLength(5);expect(historicalDivisionNames).toContain('Любитель Спорт')});
});
