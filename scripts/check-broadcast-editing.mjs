// Real authenticated HTTP checks against the local development database only.
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/lhl76_import_test') throw new Error('Local test database required');
const db = new PrismaClient();
const base = 'http://127.0.0.1:3000';
const marker = 'broadcast-check-' + Date.now();
const password = randomBytes(24).toString('hex'), salt = randomBytes(16);
let user, broadcast;
const assert = (ok, label) => { if (!ok) throw new Error(label); console.log('PASS ' + label); };
const dateInput = value => new Date(value + 3 * 3600000).toISOString().slice(0, 16);
try {
  user = await db.user.create({ data: { username: marker, email: marker + '@audit.invalid', name: 'Temporary broadcast check', role: 'SUPER_ADMIN', active: true,
    passwordHash: `scrypt:${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}` } });
  const login = await fetch(base + '/api/admin/auth/login', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: marker, password }) });
  assert(login.ok, 'admin authentication');
  const headers = { Cookie: login.headers.get('set-cookie').split(';')[0], Origin: base, 'Content-Type': 'application/json' };
  const request = (body, method = 'PATCH') => fetch(base + '/api/admin/broadcasts', { method, headers, body: JSON.stringify(body) });
  assert((await fetch(base + '/api/admin/broadcasts')).status === 401, 'anonymous access denied');
  const created = await request({ title: marker, videoUrl: 'https://example.com/' + marker + '.mp4', startsAt: dateInput(Date.now() - 3 * 60000), isPublished: false }, 'POST');
  const createdData = await created.json();
  assert(created.status === 201, 'draft creation'); broadcast = createdData.item;
  const read = async () => (await (await fetch(base + '/api/admin/broadcasts', { headers })).json()).items.find(item => item.id === broadcast.id);
  assert((await read()).isPublished === false, 'draft persisted');
  assert((await request({ id: broadcast.id, isPublished: true })).ok, 'publication');
  assert((await read()).status === 'live', 'live determined from start time');
  assert((await request({ id: broadcast.id, isLive: true })).status === 400, 'manual LIVE override rejected');
  assert((await request({ id: broadcast.id, endsAt: dateInput(Date.now() - 60000) })).ok, 'earlier end saved');
  assert((await read()).status === 'archive', 'completed time becomes archive');
  assert((await request({ id: broadcast.id, endsAt: '', startsAt: dateInput(Date.now() + 3600000) })).ok, 'future time saved');
  assert((await read()).status === 'upcoming', 'future game becomes upcoming');
  const match = await db.match.findFirst({ where: { startsAt: { not: null } }, orderBy: { startsAt: 'desc' } });
  assert(Boolean(match), 'calendar match available');
  assert((await request({ id: broadcast.id, matchId: match.id })).ok, 'calendar match linked');
  assert((await read()).startsAt === match.startsAt.toISOString(), 'linked calendar time takes priority');
  assert((await request({ id: broadcast.id, isPublished: false })).ok, 'unpublication');
  assert(!(await (await fetch(base + '/broadcasts')).text()).includes(marker), 'hidden video absent from public page');
  assert((await fetch(base + '/api/admin/broadcasts', { method: 'PATCH', headers: { ...headers, Origin: 'https://example.org' }, body: JSON.stringify({ id: broadcast.id, isPublished: true }) })).status === 403, 'foreign origin rejected');
} finally {
  if (broadcast) await db.broadcast.delete({ where: { id: broadcast.id } });
  if (user) { await db.auditLog.deleteMany({ where: { userId: user.id } }); await db.user.delete({ where: { id: user.id } }); }
  await db.$disconnect();
}
