import {cache} from 'react';
import {prisma} from '@/lib/prisma';
import {pageMetadata,contextualPath} from './seo';
type Search=Record<string,string|string[]|undefined>;
export const entityMetadata=cache(async(kind:'team'|'player'|'match'|'news'|'venue'|'media',slug:string,params:Search={})=>{
 const prefix=kind==='venue'?'venues':kind;
 const path=contextualPath('/'+prefix+'/'+encodeURIComponent(slug),params,kind==='team'?['tab','competition']:kind==='match'?['view']:[]);
 if(kind==='team'){const x=await prisma.team.findFirst({where:{slug,deletedAt:null},select:{name:true,shortDescription:true,logoUrl:true}});if(x)return pageMetadata(x.name,x.shortDescription||`${x.name}: состав команды, календарь матчей и статистика игроков.`,path,x.logoUrl);}
 if(kind==='player'){const x=await prisma.player.findFirst({where:{slug,deletedAt:null},select:{firstName:true,lastName:true,photoUrl:true}});if(x)return pageMetadata(`${x.lastName} ${x.firstName}`,`Игрок ${x.lastName} ${x.firstName}: профиль и статистика выступлений в ЛХЛ-76.`,path,x.photoUrl);}
 if(kind==='news'){const x=await prisma.news.findFirst({where:{slug,isPublished:true},select:{title:true,excerpt:true,imageUrl:true}});if(x)return pageMetadata(x.title,x.excerpt,path,x.imageUrl);}
 if(kind==='venue'){const x=await prisma.venue.findFirst({where:{slug,active:true},select:{name:true,address:true,imageUrl:true}});if(x)return pageMetadata(x.name,`${x.name}. ${x.address||''} Информация об арене и ближайшие матчи.`,path,x.imageUrl);}
 if(kind==='media'){const x=await prisma.mediaAlbum.findFirst({where:{slug,isPublished:true},select:{title:true,description:true,coverUrl:true}});if(x)return pageMetadata(x.title,x.description||'Фотоальбом ЛХЛ-76',path,x.coverUrl);}
 if(kind==='match'){const x=await prisma.match.findUnique({where:{slug},select:{startsAt:true,homeTeamEntry:{select:{team:{select:{name:true,logoUrl:true}}}},awayTeamEntry:{select:{team:{select:{name:true}}}}}});if(x){const title=x.homeTeamEntry.team.name+' — '+x.awayTeamEntry.team.name;return pageMetadata(title,`${title}${x.startsAt?' · '+x.startsAt.toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'}):''}. Результат, составы и протокол матча.`,path,x.homeTeamEntry.team.logoUrl);}}
 return {title:'Страница не найдена — ЛХЛ-76',robots:{index:false,follow:false}};
});
