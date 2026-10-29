import { withAdmin } from "@/lib/admin-guard";
import { NextRequest, NextResponse } from "next/server";
import { resolveVideoPreview } from "@/lib/video-preview";

async function handleGET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") ?? "";
  const imageUrl = await resolveVideoPreview(url);
  return NextResponse.json({ imageUrl });
}

export const GET = withAdmin(handleGET);
