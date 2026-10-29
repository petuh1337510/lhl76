import {prisma} from '@/lib/prisma';
import {publicOrigin} from '@/lib/seo';
import {competitionPublicPath,publicSlug} from '@/lib/division-page';
export const dynamic='force-dynamic';
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export async function GET(){
 const origin=publicOrigin();if(!origin)return new Response('Public URL is not configured',{status:503});
 const [teams,players,matches,news,albums,venues,divisions]=await Promise.all([
  prisma.team.findMany({where:{deletedAt:null},select:{slug:true}}),prisma.player.findMany({where:{deletedAt:null},select:{slug:true}}),
  prisma.match.findMany({select:{slug:true}}),prisma.news.findMany({where:{isPublished:true},select:{slug:true}}),
  prisma.mediaAlbum.findMany({where:{isPublished:true},select:{slug:true}}),prisma.venue.findMany({where:{active:true},select:{slug:true}}),
  prisma.division.findMany({include:{competition:{include:{season:true}}}})
 ]);
 const paths=['/','/news','/about','/documents','/media','/broadcasts','/venues','/teams','/tournaments','/laureates'];
 for(const [prefix,rows] of [['team',teams],['player',players],['match',matches],['news',news],['media',albums],['venues',venues]] as const)for(const row of rows)paths.push('/'+prefix+'/'+encodeURIComponent(row.slug));
 for(const d of divisions)paths.push(`/competition/${d.competition.season.slug}/${competitionPublicPath(d.competition.name,d.competition.type)}/${publicSlug(d.name)}`);
 return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+[...new Set(paths)].map(p=>'<url><loc>'+escape(origin+p)+'</loc></url>').join('')+'</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=0, must-revalidate'}});
}
