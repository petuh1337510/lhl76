import {beforeEach,expect,it,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({resolve:vi.fn(),request:vi.fn(),status:200,size:0,pinned:''}));
vi.mock('node:dns/promises',()=>({Resolver:class {resolve4=state.resolve}}));
vi.mock('node:https',()=>({request:state.request}));
import {GET} from '@/app/api/public/remote-image/route';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZ8AAAAASUVORK5CYII=','base64');
beforeEach(()=>{
 state.resolve.mockReset().mockResolvedValue(['93.184.216.34']);state.status=200;state.size=png.length;state.pinned='';state.request.mockReset();
 state.request.mockImplementation((_url,options,callback)=>{
  options.lookup('image-host',{},(_error:Error|null,address:string)=>{state.pinned=address});
  const req=new EventEmitter() as EventEmitter&{end:()=>void;destroy:(e?:Error)=>void};
  req.destroy=e=>{if(e)req.emit('error',e);req.emit('close')};
  req.end=()=>queueMicrotask(()=>{const res=Object.assign(new EventEmitter(),{statusCode:state.status,headers:{'content-length':state.size},destroy:()=>{}});callback(res);res.emit('data',png);res.emit('end');req.emit('close')});return req;
 });
});
const imageRequest=()=>GET(new NextRequest('http://localhost/api/public/remote-image?url='+encodeURIComponent('https://sun9-1.userapi.com/a.png')));
it('serves a decoded image using only the checked pinned address',async()=>{const r=await imageRequest();expect(r.status).toBe(200);expect(r.headers.get('content-type')).toBe('image/png');expect(state.pinned).toBe('93.184.216.34');expect((await r.arrayBuffer()).byteLength).toBe(png.length)});
it('rejects private DNS without making an HTTP request',async()=>{state.resolve.mockResolvedValue(['127.0.0.1']);expect((await imageRequest()).status).toBe(400);expect(state.request).not.toHaveBeenCalled()});
it('does not follow redirects',async()=>{state.status=302;expect((await imageRequest()).status).toBe(502);expect(state.request).toHaveBeenCalledTimes(1)});
it('rejects oversized responses',async()=>{state.size=26*1024*1024;expect((await imageRequest()).status).toBe(502)});
