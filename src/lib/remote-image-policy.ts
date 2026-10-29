export function remoteImageUrl(value:string){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&u.href.length<3000&&/^[a-z0-9.-]+\.(userapi\.com|vkuserphoto\.ru)$/.test(u.hostname)?u:null;}catch{return null;}
}
export function publicIpv4(address:string){
 const parts=address.split('.').map(Number);if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
 const [a,b,c]=parts;
 return !(a===0||a===10||a===127||a>=224||a===100&&b>=64&&b<=127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===88&&c===99)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
}
