import type {Metadata} from 'next';
import {localMediaUrl} from './local-media';
export function publicOrigin(){
 const value=process.env.PUBLIC_SITE_URL;
 if(!value)return undefined;
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('PUBLIC_SITE_URL must be an HTTPS origin');
 return url.origin;
}
export function pageMetadata(title:string,description:string,pathname:string,image?:string|null):Metadata {
 const origin=publicOrigin();
 const canonical=origin?new URL(pathname,origin).href:undefined;
 const photo=origin?new URL(localMediaUrl(image||'/icon.png'),origin).href:undefined;
 const cleanDescription=description.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
 return {title:title+' — ЛХЛ-76',description:cleanDescription,...(origin?{metadataBase:new URL(origin),alternates:{canonical}}:{}),openGraph:{title,description:cleanDescription,type:'website',locale:'ru_RU',siteName:'ЛХЛ-76',...(canonical?{url:canonical}:{}),...(photo?{images:[{url:photo,alt:title}]}:{})}};
}
export function contextualPath(pathname:string,params:Record<string,string|string[]|undefined>,keys:string[]){
 const query=new URLSearchParams();for(const key of keys){const value=params[key];if(typeof value==='string'&&value.length<=150)query.set(key,value);}
 return pathname+(query.size?'?'+query.toString():'');
}
