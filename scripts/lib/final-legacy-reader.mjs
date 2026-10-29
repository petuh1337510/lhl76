import fs from 'node:fs';
import readline from 'node:readline';

// Data parser, never an SQL executor. Fail closed on unsupported tuple syntax.
export function parseValues(line) {
  const rows=[]; let i=0;
  const space=()=>{while(/\s/.test(line[i]||'')&&i<line.length)i++;};
  while(i<line.length){
    space(); if(line[i]===','||line[i]===';'){i++;continue;}
    if(i===line.length)break;
    if(line[i++]!=='(')throw new Error('Unsupported SQL tuple prefix');
    const row=[];
    for(;;){
      space(); let value;
      if(line[i]==="'"){
        i++;value='';let closed=false;
        while(i<line.length){const ch=line[i++];
          if(ch==='\\'){const next=line[i++];if(next===undefined)throw new Error('Truncated escape');value+=({'0':'\0',n:'\n',r:'\r',t:'\t',Z:'\x1a'}[next]??(next==='%'||next==='_'?'\\'+next:next));}
          else if(ch==="'"){if(line[i]==="'"){value+="'";i++;}else{closed=true;break;}}
          else value+=ch;
        }
        if(!closed)throw new Error('Unclosed SQL string');
      }else{
        const start=i;while(i<line.length&&line[i]!==','&&line[i]!==')')i++;
        const token=line.slice(start,i).trim();
        if(token==='NULL')value=null;
        else if(/^-?\d+(?:\.\d+)?$/.test(token)){value=Number(token);if(!Number.isSafeInteger(value)&&!token.includes('.'))throw new Error('Unsafe integer');}
        else throw new Error('Unsupported unquoted SQL value');
      }
      row.push(value);space();const end=line[i++];
      if(end===')')break;if(end!==',')throw new Error('Invalid tuple separator');
    }
    rows.push(row);
  }
  return rows;
}

export async function readFinalDump(path){
  const tables=new Map(),counts={},commands=[],hazards=[];let table=null,columns=[],lineNumber=0,insertBlocks=0;
  const wanted=name=>name.startsWith('wp_joomsport_')||['wp_posts','wp_postmeta','wp_terms'].includes(name);
  for await(const line of readline.createInterface({input:fs.createReadStream(path,{encoding:'utf8'}),crlfDelay:Infinity})){
    lineNumber++;
    const insert=line.match(/^INSERT INTO `([^`]+)` \((.+)\) VALUES\s*$/);
    if(insert){table=insert[1];columns=[...insert[2].matchAll(/`([^`]+)`/g)].map(m=>m[1]);insertBlocks++;continue;}
    if(table){
      if(!line.trim())continue;
      if(!line.startsWith('('))throw new Error(`Unsupported INSERT at line ${lineNumber}`);
      if(wanted(table)){
        const rows=parseValues(line);counts[table]=(counts[table]||0)+rows.length;
        if(!tables.has(table))tables.set(table,[]);
        for(const row of rows){if(row.length!==columns.length)throw new Error(`Column mismatch ${table}:${lineNumber}`);tables.get(table).push(Object.fromEntries(columns.map((c,j)=>[c,row[j]])));}
      }
      if(line.trimEnd().endsWith(';'))table=null;
      continue;
    }
    if(/^INSERT\b/i.test(line))throw new Error(`Unsupported INSERT header ${lineNumber}`);
    if(/\b(?:TRIGGER|PROCEDURE|FUNCTION|DEFINER|OUTFILE|DUMPFILE|LOAD_FILE|LOAD\s+DATA|GRANT|CREATE\s+USER|INSTALL\s+PLUGIN|DELIMITER)\b/i.test(line)&&!/^\s*--/.test(line))hazards.push({line:lineNumber,kind:line.match(/\b(?:TRIGGER|PROCEDURE|FUNCTION|DEFINER|OUTFILE|DUMPFILE|LOAD_FILE|LOAD\s+DATA|GRANT|CREATE\s+USER|INSTALL\s+PLUGIN|DELIMITER)\b/i)[0]});
    if(/^(?:CREATE|ALTER|DROP|SET|START|COMMIT|USE|LOCK|UNLOCK)\b/i.test(line))commands.push({line:lineNumber,verb:line.split(/\s/)[0]});
  }
  if(table)throw new Error('Truncated INSERT at EOF');
  return {tables,counts,commands,hazards,insertBlocks,lineNumber};
}
