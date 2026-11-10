// Read-only runtime check. Never log credentials, raw API errors or request bodies.
const token = process.env.VK_API_ACCESS_TOKEN;
if (!token) throw new Error('VK integration is not configured');
async function call(method, params) {
  const r = await fetch(`https://api.vk.com/method/${method}`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({ ...params, access_token: token, v: '5.199' }),
  });
  if (!r.ok) throw new Error(`VK HTTP ${r.status}`);
  const data = await r.json();
  if (data.error) throw new Error(`VK API code ${Number(data.error.error_code)}`);
  if (!data.response) throw new Error('Empty VK response');
  return data.response;
}
try {
  const owner = await call('utils.resolveScreenName', { screen_name: 'lhl76' });
  const ownerId = owner.type === 'user' ? owner.object_id : -owner.object_id;
  const videos = await call('video.get', { owner_id: String(ownerId), count: '40' });
  console.log(JSON.stringify({ ownerId, count: videos.count, returned: videos.items?.length,
    sample: videos.items?.slice(0, 12).map(v => ({ id: v.id, owner_id: v.owner_id, title: v.title, date: v.date,
      live_start_time: v.live_start_time, live: v.live, upcoming: v.upcoming })) }));
} catch (e) {
  console.error(e instanceof Error && /^(VK HTTP \d+|VK API code \d+|Empty VK response)$/.test(e.message) ? e.message : 'VK video connection failed');
  process.exitCode = 1;
}
