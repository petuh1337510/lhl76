import { clientKey, consumeLimit, readBounded } from "@/lib/request-limits";
import { sameOriginMutation } from "@/lib/security-policy";
import { parseVital } from "@/lib/telemetry-policy";
import { writeTelemetry } from "@/lib/telemetry-store";

export async function POST(request: Request) {
  if (process.env.TELEMETRY_ENABLED === "0") return new Response(null, {status: 204});
  if (!sameOriginMutation(request.headers.get("origin"), request.url, request.headers.get("sec-fetch-site"), request.headers.get("host"))) return new Response(null, {status: 403});
  try {
    if (!await consumeLimit(`vitals:${clientKey(request)}`, 120, 60000)) return new Response(null, {status: 429});
    const record = parseVital(JSON.parse((await readBounded(request, 1024)).toString()));
    if (!record) return new Response(null, {status: 400});
    await writeTelemetry([record]);
    return new Response(null, {status: 204, headers: {"Cache-Control": "no-store"}});
  } catch { return new Response(null, {status: 400}); }
}
