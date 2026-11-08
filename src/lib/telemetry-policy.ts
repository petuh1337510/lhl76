/** Only route templates and numeric timings leave request/browser memory. */
export function telemetryRoute(path: string) {
  const pathname = path.split(/[?#]/)[0];
  if (pathname === "/") return "/";
  if (/^\/(team|player|match|news)\/[^/]+/.test(pathname)) return `/${pathname.split("/")[1]}/[slug]`;
  if (pathname.startsWith("/competition/")) return "/competition/[season]/[competition]/[division]";
  const allowed = /^\/(?:admin(?:\/(?:login|team|teams|player|players|team-roster|news|media-files|media|matches|match-protocol|performance|seasons|competitions|standings|suspensions|homepage-content|league-page|users|audit|content-library|broadcasts|laureates|playoff))?|news|media|league|documents|statistics|calendar|api\/(?:ready|health|telemetry|public\/(?:home-summary|home-matches|site-context)|admin\/(?:players|player|teams|team|roster|media-files|upload|news|matches|match-protocol|performance|auth\/(?:me|login|logout))))$/;
  return allowed.test(pathname) ? pathname : "/other";
}

export const vitalNames = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;
export function parseVital(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.route !== "string" || input.route.length > 250 || typeof input.metric !== "string") return null;
  if (input.metric === "ERROR") return {kind: "vital" as const, route: telemetryRoute(input.route), metric: "ERROR", value: 1};
  if (!(vitalNames as readonly string[]).includes(input.metric) || typeof input.value !== "number" || !Number.isFinite(input.value) || input.value < 0 || input.value > (input.metric === "CLS" ? 100 : 300000)) return null;
  return {kind: "vital" as const, route: telemetryRoute(input.route), metric: input.metric, value: Math.round(input.value * 1000) / 1000};
}
