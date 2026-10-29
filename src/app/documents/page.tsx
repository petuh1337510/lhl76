import { UiIcon } from "@/components/ui-icon";
import { PublicSiteFooter, PublicSiteHeader } from "@/components/public-site-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const extension = (url: string) => url.split(".").pop()?.toUpperCase() || "ФАЙЛ";

export default async function DocumentsPage() {
  const documents = await prisma.document.findMany({
    where: { publishedAt: { not: null } },
    orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
  });
  return <><PublicSiteHeader/><main className="publicDocuments"><section className="documentsHero"><div className="shell"><span>ЛХЛ-76 · ОФИЦИАЛЬНО</span><h1>ДОКУМЕНТЫ</h1><p>Регламенты, формы заявок и материалы для команд и судей.</p></div></section><section className="shell documentsContent">{documents.length ? <section className="documentGroup documentsFlat"><div>{documents.map(item=><a href={localMediaUrl(item.fileUrl)} target="_blank" rel="noopener noreferrer" key={item.id}><i>{extension(item.fileUrl)}</i><b>{item.title}</b><strong>Открыть <UiIcon name="external" /></strong></a>)}</div></section>:<div className="publicNewsEmpty"><b>Документы готовятся</b><p>Опубликованные материалы появятся в этом разделе.</p></div>}</section></main><PublicSiteFooter/></>;
}
import {pageMetadata} from '@/lib/seo';
export const metadata=pageMetadata('Документы','Регламенты, формы заявок и официальные документы ЛХЛ-76.','/documents');
import {localMediaUrl} from '@/lib/local-media';
