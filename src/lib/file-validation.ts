/** Positive signatures only; document downloads must also use attachment + nosniff. */
export function validFileSignature(bytes:Buffer,extension:string){
 if(extension==='.pdf')return bytes.subarray(0,5).toString()==='%PDF-'&&bytes.subarray(Math.max(0,bytes.length-2048)).includes(Buffer.from('%%EOF'));
 if(extension==='.doc'||extension==='.xls')return bytes.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex'));
 if(extension==='.docx'||extension==='.xlsx'){
  if(bytes.readUInt32LE(0)!==0x04034b50)return false;
  let total=0,files=0,expected=false,types=false;
  for(let i=0;i+46<=bytes.length;i++){
   if(bytes.readUInt32LE(i)!==0x02014b50)continue;
   const n=bytes.readUInt16LE(i+28),extra=bytes.readUInt16LE(i+30),comment=bytes.readUInt16LE(i+32);
   if(i+46+n+extra+comment>bytes.length)return false;
   const name=bytes.subarray(i+46,i+46+n).toString();
   if(name.includes('..')||name.startsWith('/')||/vbaProject\.bin$/i.test(name))return false;
   total+=bytes.readUInt32LE(i+24);if(total>100*1024*1024||++files>2000)return false;
   types ||= name==='[Content_Types].xml';expected ||= name===(extension==='.docx'?'word/document.xml':'xl/workbook.xml');i+=45+n+extra+comment;
  }return types&&expected;
 }
 if(extension==='.mp4'||extension==='.mov')return bytes.length>=12&&bytes.subarray(4,8).toString()==='ftyp';
 if(extension==='.webm')return bytes.subarray(0,4).equals(Buffer.from('1a45dfa3','hex'));
 return false;
}
