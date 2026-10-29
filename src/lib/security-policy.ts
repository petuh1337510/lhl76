export function authSecret(env = process.env): string {
  const value=env.AUTH_SECRET;
  const example=!value || value.length<32 || /^(change-this|local-development|test-secret)/i.test(value);
  if(env.NODE_ENV==='production' && example) throw new Error('AUTH_SECRET must be configured with a unique secret of at least 32 characters');
  return value || 'local-development-secret-change-me';
}
export function allowedAdminPath(role:string,path:string) {
  if(['/admin/users','/api/admin/users','/admin/audit','/api/admin/audit'].some(p=>path===p||path.startsWith(p+'/')))return role==='SUPER_ADMIN';
  if(role==='SUPER_ADMIN'||role==='ADMIN')return true;
  if(role!=='SECRETARY')return false;
  return ['/admin','/api/admin/dashboard','/api/admin/auth/me','/api/admin/auth/logout'].includes(path)||['/admin/matches','/admin/match-protocol','/api/admin/matches','/api/admin/match-protocol'].some(p=>path===p||path.startsWith(p+'/'));
}
export function safeAdminReturn(value:string|null) {
  if(!value || !value.startsWith('/') || /[\\\r\n]/.test(value))return '/admin';
  try{const url=new URL(value,'https://local.invalid');return url.origin==='https://local.invalid'&&/^\/admin(?:\/|$)/.test(url.pathname)?url.pathname+url.search:'/admin';}catch{return '/admin';}
}
export function sameOriginMutation(origin:string|null,requestUrl:string,fetchSite:string|null,host?:string|null) {
  if(fetchSite==='cross-site'||!origin)return false;
  try{
    const parsed=new URL(origin),target=new URL(requestUrl);
    // Next's internal URL can use localhost behind its listener/proxy. Host is
    // browser-controlled, unlike a user-supplied X-Forwarded-Host header.
    if(host)return ['http:','https:'].includes(parsed.protocol)&&parsed.host===host&&parsed.origin===origin;
    return parsed.origin===target.origin;
  }catch{return false;}
}
