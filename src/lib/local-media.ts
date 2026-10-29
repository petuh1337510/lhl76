/** Original database URLs remain unchanged; all views share one local source. */
import {remoteImageUrl} from './remote-image-policy';
import {safeEditorialUrl} from './editorial-url';
export function localMediaUrl(source:string):string {
 try{const url=new URL(source);if(['lhl-76.ru','www.lhl-76.ru'].includes(url.hostname)&&url.pathname.startsWith('/wp-content/'))return '/api/public/legacy-media?source='+encodeURIComponent(source);}catch{}
 if(remoteImageUrl(source))return '/api/public/remote-image?url='+encodeURIComponent(source);
 return safeEditorialUrl(source)||'';
}
