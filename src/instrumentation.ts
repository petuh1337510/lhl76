export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build" && process.env.VK_API_ACCESS_TOKEN) {
    const { registerVkPhotoRefresh } = await import("./lib/vk-photo-refresh");
    registerVkPhotoRefresh();
  }
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.TELEMETRY_ENABLED !== "0") {
    const { registerTelemetry } = await import("./lib/telemetry-node");
    registerTelemetry();
  }
}
