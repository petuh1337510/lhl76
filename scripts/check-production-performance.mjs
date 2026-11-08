import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Runs against production with Lighthouse's mobile CPU/network simulation.
// No authenticated writes or stored cookies are used.
const output = path.resolve(process.argv[2] || `outputs/performance/${new Date().toISOString().replace(/[:.]/g, "-")}`);
mkdirSync(output, {recursive: true});
const targets = [
  ["home", "https://lhl-76.ru/"],
  ["team", "https://lhl-76.ru/team/hctanki76?tab=roster"],
  ["division", "https://lhl-76.ru/competition/2026-27/championship/lyubitel-plyus?tab=statistics"],
  ["login", "https://lhl-76.ru/admin/login"],
];
const summary = [];
for (const [name, url] of targets) {
  const args = ["dlx", "lighthouse@13.6.0", url, "--chrome-flags=--headless=new", "--only-categories=performance", "--form-factor=mobile", "--throttling-method=simulate", "--throttling.cpuSlowdownMultiplier=4", "--throttling.rttMs=150", "--throttling.throughputKbps=1638.4", "--output=json", "--output=html", `--output-path=${path.join(output, name)}`, "--quiet"];
  const cli = process.env.PNPM_CLI || process.env.npm_execpath;
  if (process.platform === "win32" && !cli) throw Error("Run pnpm check:performance, or set PNPM_CLI to pnpm.cjs");
  const result = cli ? spawnSync(process.execPath, [cli, ...args], {stdio:"inherit"}) : spawnSync("pnpm", args, {stdio:"inherit"});
  if (result.error || result.status !== 0) throw result.error || Error(`Lighthouse failed: ${name}`);
  const report = JSON.parse(readFileSync(path.join(output, `${name}.report.json`), "utf8"));
  if (report.runtimeError) throw Error(`${name}: ${report.runtimeError.message}`);
  summary.push({name, url, score:report.categories.performance.score, metrics:Object.fromEntries(["largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index", "server-response-time"].map(key => [key, report.audits[key]?.numericValue])), findings:Object.entries(report.audits).filter(([, audit]) => audit.score !== null && audit.score < 0.9).map(([id, audit]) => ({id,title:audit.title,displayValue:audit.displayValue}))});
}
writeFileSync(path.join(output, "summary.json"), JSON.stringify(summary, null, 2));
console.log(`Production report: ${path.join(output, "summary.json")}`);
