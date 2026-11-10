// Run inside the app container. Never print credentials, request bodies or raw API errors.
const token = process.env.VK_API_ACCESS_TOKEN;
if (!token) {
  console.log("VK photo check skipped: integration is not configured");
} else {
  try {
    async function call(method, params) {
      const response = await fetch(`https://api.vk.com/method/${method}`, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
        body: new URLSearchParams({ ...params, access_token: token, v: "5.199" }),
      });
      if (!response.ok) throw new Error(`VK HTTP ${response.status}`);
      const result = await response.json();
      if (result.error) throw new Error(`VK API code ${Number(result.error.error_code)}`);
      if (!result.response) throw new Error("VK returned an empty response");
      await new Promise(resolve => setTimeout(resolve, 400));
      return result.response;
    }
    const group = await call("utils.resolveScreenName", { screen_name: "lhl76" });
    if (group.type !== "group" || !Number.isSafeInteger(group.object_id)) throw new Error("LHL-76 community not found");
    const owner_id = String(-group.object_id);
    const albums = await call("photos.getAlbums", { owner_id, count: "1", need_covers: "1" });
    if (!Array.isArray(albums.items)) throw new Error("Invalid album response");
    const album = albums.items.find(item => item.id > 0);
    if (album) {
      const photos = await call("photos.get", { owner_id, album_id: String(album.id), count: "1", photo_sizes: "1" });
      if (!Array.isArray(photos.items)) throw new Error("Invalid photo response");
      console.log(`VK photo API verified: ${albums.count} albums, sample album has ${photos.count} photos`);
    } else {
      console.log("VK album API verified: no public albums available");
    }
  } catch (error) {
    const message = error instanceof Error && /^(VK HTTP \d+|VK API code \d+|VK returned an empty response|LHL-76 community not found|Invalid (album|photo) response)$/.test(error.message) ? error.message : "Connection or response failure";
    console.error(`VK photo check failed: ${message}`);
    process.exitCode = 1;
  }
}
