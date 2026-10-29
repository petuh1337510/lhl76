/** Browser navigation URLs only; not a replacement for server-side SSRF checks. */
export function safeEditorialUrl(value:unknown,document=false):string|null {
 if(typeof value!=='string'||!value||value.length>2048||value!==value.trim()||/[\u0000-\u0020\u007f\\]/.test(value))return null;
 let decoded=value;try{for(let i=0;i<3;i++){const next=decodeURIComponent(decoded);if(next===decoded)break;decoded=next}}catch{return null}
 if(/[\u0000-\u001f\u007f\\]/.test(decoded)||decoded.startsWith('//'))return null;
 if(value.startsWith('/')){
   if(value.startsWith('//')||decoded.split(/[?#]/)[0].split('/').some(x=>x==='.'||x==='..'))return null;
   if(document&&!/^\/(?:uploads\/documents\/|documents\/legacy\/|legacy-media\/)/.test(decoded))return null;
   return value;
 }
 try{
  const u=new URL(value),host=u.hostname.toLowerCase().replace(/\.$/,'');
  if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!host.includes('.')||host.includes(':')||/^[\d.]+$/.test(host)||/(?:^|\.)(?:localhost|local|internal|lan|invalid|test)$/.test(host))return null;
  return value;
 }catch{return null}
}
export function safeHref(value:unknown):string {return safeEditorialUrl(value)||'#'}
export function invalidEditorialField(body:unknown,document=false):string|null {
 if(!body||typeof body!=='object'||Array.isArray(body))return 'body';
 const fields=['link','fileUrl','mapUrl','imageUrl','imageDesktop','imageMobile','photoUrl','laureatePhotoUrl','logoUrl','teamPhotoUrl','vkUrl','telegramUrl','websiteUrl'];
 for(const key of fields){const value=(body as Record<string,unknown>)[key];if(value===undefined||value===null||value==='')continue;if(!safeEditorialUrl(value,document&&key==='fileUrl'))return key}
 return null;
}
