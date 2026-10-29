import { PublicImage } from "@/components/public-image";
import Link from "next/link";
import {PublicSiteFooter,PublicSiteHeader} from "@/components/public-site-header";
import {prisma} from "@/lib/prisma";
export const dynamic="force-dynamic";
export default async function Venues(){const items=await prisma.venue.findMany({where:{active:true},orderBy:[{city:"asc"},{name:"asc"}],include:{_count:{select:{matches:true}}}});return <><PublicSiteHeader/><main className="publicVenues"><header className="venueHero"><div className="shell"><span>ЛХЛ-76 · ИНФРАСТРУКТУРА</span><h1>СТАДИОНЫ</h1><p>Ледовые арены, на которых проходят матчи лиги.</p></div></header><section className="shell publicVenueGrid">{items.length?items.map(item=><Link href={`/venues/${item.slug}`} key={item.id}><div>{item.imageUrl?<PublicImage width={960} height={540} sizes="(max-width: 600px) 92vw, (max-width: 1000px) 45vw, 640px" src={item.imageUrl} alt=""/>:<span>⌖</span>}<b>{item._count.matches} матчей</b></div><small>{item.city||"Ярославская область"}</small><h2>{item.name}</h2><p>{item.address||"Адрес уточняется"}</p></Link>):<div className="publicNewsEmpty"><b>Стадионы пока не опубликованы</b></div>}</section></main><PublicSiteFooter/></>}
import {pageMetadata} from '@/lib/seo';
export const metadata=pageMetadata('Стадионы','Ледовые арены и расписание ближайших матчей ЛХЛ-76.','/venues');
