import { appendFile, mkdir, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";

export type TelemetryRecord = { at: number; kind: "trace" | "vital"; route: string; name?: string; duration?: number; traceId?: string; spanId?: string; parentId?: string; failed?: boolean; metric?: string; value?: number };
const root = () => process.env.TELEMETRY_DIR || path.join(process.env.RATE_LIMIT_DIR ? path.dirname(process.env.RATE_LIMIT_DIR) : path.join(process.cwd(), ".runtime"), "performance");
const state = globalThis as unknown as { telemetryQueue?: Promise<void> };
const maxBytes = 1024 * 1024;

/** Bounded, single-host store on the existing persistent state volume. */
export function writeTelemetry(records: Omit<TelemetryRecord, "at">[]) {
  if (!records.length || process.env.TELEMETRY_ENABLED === "0") return Promise.resolve();
  const lines = records.slice(0, 512).map(record => JSON.stringify({...record, at: Date.now()})).join("\n") + "\n";
  const pending = (state.telemetryQueue ?? Promise.resolve()).catch(() => undefined).then(async () => {
    await mkdir(root(), {recursive: true, mode: 0o700});
    const file = path.join(root(), "events.jsonl");
    const size = await stat(file).then(info => info.size).catch(() => 0);
    if (size + Buffer.byteLength(lines) > maxBytes) await rename(file, path.join(root(), "previous.jsonl")).catch(error => {if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;});
    await appendFile(file, lines, {mode: 0o600});
  });
  state.telemetryQueue = pending;
  return pending;
}

export async function readTelemetry() {
  const files = await Promise.all(["previous.jsonl", "events.jsonl"].map(name => readFile(path.join(root(), name), "utf8").catch(() => "")));
  return files.flatMap(file => file.split("\n").flatMap(line => {try {return [JSON.parse(line) as TelemetryRecord];} catch {return [];}})).filter(row => row.at > Date.now() - 86400000);
}
