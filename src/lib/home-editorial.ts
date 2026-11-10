import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { desktopHeroSource, mobileHeroSource } from "@/lib/hero-images";

export const HOME_EDITORIAL_TAG = "home-editorial";
// Only editorial content: never scores, ratings, rosters or suspensions.
export const getHomeEditorial = unstable_cache(async () => {
  const [news, homepageContent, laureates] = await Promise.all([
    prisma.news.findMany({ where: { isPublished: true }, orderBy: { publishedAt: "desc" }, take: 4, select: {id:true, slug:true, title:true, excerpt:true, category:true, imageUrl:true, publishedAt:true} }),
    prisma.homepageContent.findMany({ where: { active: true }, orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.laureate.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 8 }),
  ]);
  const content = await Promise.all(homepageContent.map(async (item) => item.type === "banner"
    ? { ...item, imageMobile: await mobileHeroSource(item.imageDesktop, item.imageMobile), imageDesktop: await desktopHeroSource(item.imageDesktop) }
    : item));
  return { news, homepageContent: content, laureates };
}, ["home-editorial-v4"], { revalidate: 300, tags: [HOME_EDITORIAL_TAG] });

export function invalidateHomeEditorial() { revalidateTag(HOME_EDITORIAL_TAG); }
