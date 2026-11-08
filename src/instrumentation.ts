export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.TELEMETRY_ENABLED !== "0") {
    const { registerTelemetry } = await import("./lib/telemetry-node");
    registerTelemetry();
  }
}
