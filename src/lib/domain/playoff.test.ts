import {describe,it,expect} from 'vitest';
import {seriesResult,type SeriesGame} from './playoff';
const game=(id:string,winner='A'):SeriesGame=>({id,status:'FINAL',homeTeamEntryId:'A',awayTeamEntryId:'B',homeScore:winner==='A'?2:1,awayScore:winner==='B'?2:1,resultType:'NORMAL',protocolData:null});
describe('playoff series',()=>{
  it('counts wins until target, not table points',()=>{expect(seriesResult('A','B',3,[game('1')])).toMatchObject({homeWins:1,awayWins:0,target:2,winner:null});expect(seriesResult('A','B',3,[game('1'),game('2')])).toMatchObject({winner:'A',loser:'B',homeWins:2})});
  it('handles home/away reversal and technical winner',()=>{expect(seriesResult('A','B',3,[{...game('1'),homeTeamEntryId:'B',awayTeamEntryId:'A'}, {...game('2'),resultType:'TECHNICAL',homeScore:0,awayScore:0,protocolData:{technicalWinnerTeamEntryId:'B'}}])).toMatchObject({awayWins:2,winner:'B'})});
  it('rejects draw, unrelated teams and excess finished games',()=>{expect(()=>seriesResult('A','B',1,[{...game('1'),homeScore:1}])).toThrow();expect(()=>seriesResult('A','B',1,[{...game('1'),awayTeamEntryId:'C'}])).toThrow();expect(()=>seriesResult('A','B',1,[game('1'),game('2')])).toThrow()});
  it('supports bye and ignores non-final matches',()=>{expect(seriesResult('A',null,3,[],true).winner).toBe('A');expect(seriesResult('A',null,3,[],false).winner).toBeNull();expect(seriesResult('A','B',3,[{...game('1'),status:'CANCELLED'}]).homeWins).toBe(0)});
});
