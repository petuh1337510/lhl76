type Event='LOGIN_DENIED'|'LOGIN_THROTTLED'|'ACCESS_DENIED'|'ORIGIN_DENIED'|'AUTH_UNAVAILABLE';
// Local structured logs only: never include request bodies, cookies, IPs or email.
export function securityEvent(event:Event,area:'login'|'administration',subjectId?:string){
 console.warn(JSON.stringify({type:'security',event,area,at:new Date().toISOString(),...(subjectId?{subjectId:subjectId.slice(0,128)}:{})}));
}
