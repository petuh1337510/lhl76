const decodeHtml = (value: string) =>
  value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export async function resolveVideoPreview(value: string): Promise<string | null> {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if(url.protocol!=='https:'||url.port||url.username||url.password)return null;
    if (['youtube.com','www.youtube.com','m.youtube.com'].includes(host)) {
      const id = url.searchParams.get("v");
      if (id&&/^[\w-]{11}$/.test(id)) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
    if (host === "youtu.be") {
      const id = url.pathname.slice(1);
      if (/^[\w-]{11}$/.test(id)) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
    const allowed = ['vk.com','www.vk.com','vkvideo.ru','www.vkvideo.ru','rutube.ru','www.rutube.ru'].includes(host);
    if (!allowed) return null;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LHL76/1.0)" },
      redirect: "error",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return null;
    if(Number(response.headers.get('content-length'))>2*1024*1024)return null;
    const reader=response.body?.getReader();if(!reader)return null;
    const chunks:Uint8Array[]=[];let size=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024)return null;chunks.push(value);}}finally{await reader.cancel();}
    const html = Buffer.concat(chunks).toString();
    const match = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);
    if(!match?.[1])return null;
    const image=new URL(decodeHtml(match[1]));
    return image.protocol==='https:'&&!image.port&&!image.username&&!image.password&&/\.(?:userapi\.com|vkuserphoto\.ru|rutube\.ru)$/.test(image.hostname)?image.href:null;
  } catch {
    return null;
  }
}
