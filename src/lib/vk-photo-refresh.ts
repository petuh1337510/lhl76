import { getPublicMediaAlbums } from "./public-media";

// Keep the one-hour Next data cache active even when the gallery has no visitors.
// One in-flight pass per process; failures retain the previous successful cache.
const state = globalThis as typeof globalThis & { vkPhotoRefreshTimer?: ReturnType<typeof setInterval> };
export function registerVkPhotoRefresh() {
  if (state.vkPhotoRefreshTimer) return;
  let running = false;
  state.vkPhotoRefreshTimer = setInterval(async () => {
    if (running) return;
    running = true;
    try { await getPublicMediaAlbums(); }
    catch { console.warn("VK photo refresh unavailable; will retry."); }
    finally { running = false; }
  }, 60_000);
  state.vkPhotoRefreshTimer.unref();
}
