import { NextRequest, NextResponse } from "next/server";
import { vkNewsVideo } from "@/lib/news-video";
import { getVkNewsPreview } from "@/lib/vk-news-video";
export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("url") || "";
  if (!vkNewsVideo(source)) return NextResponse.json({ error: "Вставьте ссылку на клип или видео VK" }, { status: 400 });
  const preview = await getVkNewsPreview(source);
  return preview ? NextResponse.json(preview) : NextResponse.json({ error: "VK не предоставил плеер. Попробуйте открыть ролик в VK; обложку можно загрузить вручную." }, { status: 502 });
}
