import { NextResponse } from "next/server";

import { getPublicSiteContext } from "@/lib/public-site-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getPublicSiteContext();
  return NextResponse.json(context, { status: context ? 200 : 404 });
}
