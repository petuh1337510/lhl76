import { prisma } from "@/lib/prisma";
import { uploadFamilyKey } from "@/lib/upload-files";

export type UploadUse = { label: string; href: string };

export async function findUploadUses() {
  const uses = new Map<string, UploadUse[]>();
  const scan = (value: unknown, label: string, href: string): void => {
    if (typeof value === "string") {
      // Banner settings are stored as JSON text, including escaped URL paths.
      if (/^[\[{]/.test(value.trim())) {
        try {
          const parsed: unknown = JSON.parse(value);
          scan(parsed, label, href);
          return;
        } catch { /* Legacy plain text still needs the URL scan below. */ }
      }
      for (const match of value.matchAll(/\/uploads\/(?:teams|players|news|documents|media|general)\/[^\s"'<>),;]+/g)) {
        const key = uploadFamilyKey(match[0]);
        if (!key) continue;
        const entries = uses.get(key) ?? [];
        if (!entries.some((entry) => entry.label === label && entry.href === href)) entries.push({ label, href });
        uses.set(key, entries);
      }
    } else if (Array.isArray(value)) {
      value.forEach((item) => scan(item, label, href));
    } else if (value && typeof value === "object") {
      Object.values(value).forEach((item) => scan(item, label, href));
    }
  };

  const [teams, players, venues, news, documents, albums, broadcasts, homepage, leaguePages, leaguePeople, laureates] = await Promise.all([
    prisma.team.findMany({ select: { name: true, slug: true, logoUrl: true, teamPhotoUrl: true, description: true, achievements: true } }),
    prisma.player.findMany({ select: { firstName: true, lastName: true, slug: true, photoUrl: true, laureatePhotoUrl: true, laureateAchievements: true } }),
    prisma.venue.findMany({ select: { name: true, imageUrl: true, description: true } }),
    prisma.news.findMany({ select: { title: true, imageUrl: true, videoUrl: true, gallery: true, body: true, excerpt: true } }),
    prisma.document.findMany({ select: { title: true, fileUrl: true } }),
    prisma.mediaAlbum.findMany({ select: { title: true, coverUrl: true, photos: true, description: true } }),
    prisma.broadcast.findMany({ select: { title: true, imageUrl: true, videoUrl: true } }),
    prisma.homepageContent.findMany({ select: { title: true, imageDesktop: true, imageMobile: true, link: true, style: true } }),
    prisma.leaguePage.findMany({ select: { headline: true, intro: true } }),
    prisma.leaguePerson.findMany({ select: { name: true, photoUrl: true, description: true } }),
    prisma.laureate.findMany({ select: { name: true, imageUrl: true, link: true } }),
  ]);

  for (const item of teams) scan([item.logoUrl, item.teamPhotoUrl, item.description, item.achievements], `Команда «${item.name}»`, `/admin/team?slug=${encodeURIComponent(item.slug)}`);
  for (const item of players) scan([item.photoUrl, item.laureatePhotoUrl, item.laureateAchievements], `Игрок ${item.lastName} ${item.firstName}`, `/admin/player?slug=${encodeURIComponent(item.slug)}`);
  for (const item of venues) scan([item.imageUrl, item.description], `Стадион «${item.name}»`, "/admin/venues");
  for (const item of news) scan([item.imageUrl, item.videoUrl, item.gallery, item.body, item.excerpt], `Новость «${item.title}»`, "/admin/news");
  for (const item of documents) scan(item.fileUrl, `Документ «${item.title}»`, "/admin/content-library");
  for (const item of albums) scan([item.coverUrl, item.photos, item.description], `Альбом «${item.title}»`, "/admin/media");
  for (const item of broadcasts) scan([item.imageUrl, item.videoUrl], `Трансляция «${item.title}»`, "/admin/broadcasts");
  for (const item of homepage) scan([item.imageDesktop, item.imageMobile, item.link, item.style], `Главная: ${item.title}`, "/admin/homepage-content");
  for (const item of leaguePages) scan(item.intro, `О лиге: ${item.headline}`, "/admin/league-page");
  for (const item of leaguePeople) scan([item.photoUrl, item.description], `О лиге: ${item.name}`, "/admin/league-page");
  for (const item of laureates) scan([item.imageUrl, item.link], `Лауреат ${item.name}`, "/admin/laureates");
  return uses;
}
