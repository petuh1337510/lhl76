import { withAdmin } from "@/lib/admin-guard";
import { readTelemetry } from "@/lib/telemetry-store";

export const GET = withAdmin(async () => {
  const rows = await readTelemetry();
  const groups = new Map<string, {route: string; metric: string; values: number[]}>();
  for (const row of rows) if (row.kind === "vital" && row.metric && row.value !== undefined) {
    const key = `${row.route}:${row.metric}`, group = groups.get(key) ?? {route: row.route, metric: row.metric, values: []};
    group.values.push(row.value); groups.set(key, group);
  }
  const metrics = [...groups.values()].map(group => ({route: group.route, metric: group.metric, count: group.values.length, p75: group.values.sort((a,b) => a-b)[Math.ceil(group.values.length * .75)-1]}));
  const traces = rows.filter(row => row.kind === "trace");
  const recentIds = new Set(traces.slice(-200).map(row => row.traceId));
  return Response.json({metrics, traces: traces.filter(row => recentIds.has(row.traceId)).slice(-300), slowMs: Number(process.env.TELEMETRY_SLOW_MS) || 500});
});
