import { NextRequest, NextResponse } from "next/server";
import { getHomeSummary } from "@/lib/public-home-summary";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const summary = await getHomeSummary(request.nextUrl.searchParams.get("live") === "1");
  return NextResponse.json(summary, { status: summary ? 200 : 404, headers: { "Cache-Control": "no-store" } });
}
