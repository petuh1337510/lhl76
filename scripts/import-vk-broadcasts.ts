import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const ownerId = "-170455976";
const videoIds = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["456240104", "456240103", "456240102", "456240101"];

type OembedResponse = {
  response?: { title?: string; thumbnail_url?: string };
  error?: { error_msg?: string };
};

async function main() {
  const imageDirectory = path.join(process.cwd(), "public", "images", "broadcasts");
  await mkdir(imageDirectory, { recursive: true });

  for (const [index, videoId] of videoIds.entries()) {
    const videoUrl = `https://vkvideo.ru/live${ownerId}_${videoId}`;
    const slug = `vk-${ownerId.slice(1)}-${videoId}`;
    const metadataUrl = new URL("https://api.vk.com/method/video.getOembed");
    metadataUrl.searchParams.set("url", `https://vk.com/video${ownerId}_${videoId}`);
    metadataUrl.searchParams.set("maxwidth", "1280");
    metadataUrl.searchParams.set("maxheight", "720");
    metadataUrl.searchParams.set("v", "5.199");

    const metadata = (await (await fetch(metadataUrl)).json()) as OembedResponse;
    const title = metadata.response?.title?.trim();
    const thumbnailUrl = metadata.response?.thumbnail_url;
    if (!title || !thumbnailUrl) {
      throw new Error(`${videoId}: VK не вернул название или обложку: ${metadata.error?.error_msg ?? "неизвестная ошибка"}`);
    }

    const imageName = `${slug}.jpg`;
    let imageUrl = thumbnailUrl;
    const imageResponse = await fetch(thumbnailUrl);
    if (imageResponse.ok && imageResponse.headers.get("content-type")?.startsWith("image/")) {
      const image = Buffer.from(await imageResponse.arrayBuffer());
      if (image.length >= 1000) {
        await writeFile(path.join(imageDirectory, imageName), image);
        imageUrl = `/images/broadcasts/${imageName}`;
      }
    }

    const existing = await prisma.broadcast.findFirst({
      where: { OR: [{ slug }, { videoUrl }] },
    });
    if (existing) {
      if (!existing.imageUrl) {
        await prisma.broadcast.update({ where: { id: existing.id }, data: { imageUrl } });
        console.log(`${index + 1}/${videoIds.length}: добавлена обложка — ${title}`);
      } else {
        console.log(`${index + 1}/${videoIds.length}: уже есть — ${title}`);
      }
      continue;
    }
    await prisma.broadcast.create({
      data: {
        slug,
        title,
        videoUrl,
        imageUrl,
        isLive: false,
        isPublished: true,
        publishedAt: new Date(Date.now() - index * 1000),
      },
    });
    console.log(`${index + 1}/${videoIds.length}: добавлено — ${title}`);
  }
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
