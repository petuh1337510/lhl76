// Real HTTP + PostgreSQL check in a disposable, loopback-only environment.
// Never connects to the local working or production database.
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes, scryptSync } from 'node:crypto';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import assert from 'node:assert/strict';

const name = `lhl76-shb-check-${Date.now()}`;
const dbPort = 55439, appPort = 3019, base = `http://127.0.0.1:${appPort}`;
const password = randomBytes(24).toString('hex');
const databaseUrl = `postgresql://shb_check:${password}@127.0.0.1:${dbPort}/shb_check`;
const docker = (...args) => execFileSync('docker', ['--context', 'desktop-linux', ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const env = { ...process.env, DATABASE_URL: databaseUrl, AUTH_SECRET: randomBytes(48).toString('hex'), PUBLIC_SITE_URL: 'https://localhost',
  NODE_ENV: 'development', NEXT_DIST_DIR: '.next-shb-check', RATE_LIMIT_DIR: `.runtime/${name}/limits`, VK_API_ACCESS_TOKEN: '', NEXT_TELEMETRY_DISABLED: '1' };
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const checks = [];
let server, created = false;
mkdirSync(`.runtime/${name}`, { recursive: true });
const check = (label, condition) => { assert.ok(condition, label); checks.push(label); console.log(`PASS ${label}`); };
const request = (path, options = {}) => fetch(base + path, { ...options, signal: AbortSignal.timeout(120000), redirect: 'manual' });
try {
  docker('run', '-d', '--name', name, '-p', `127.0.0.1:${dbPort}:5432`, '-e', 'POSTGRES_USER=shb_check', '-e', 'POSTGRES_DB=shb_check', '-e', `POSTGRES_PASSWORD=${password}`, 'postgres:16-alpine');
  created = true;
  for (let i = 0; i < 30; i++) {
    try { docker('exec', name, 'pg_isready', '-U', 'shb_check', '-d', 'shb_check'); break; } catch { await new Promise(r => setTimeout(r, 500)); }
  }
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env, stdio: 'pipe' });
  const salt = randomBytes(16), loginPassword = randomBytes(24).toString('hex');
  await db.user.create({ data: { username: 'shb-check', email: 'shb-check@example.invalid', name: 'Проверка ШБ', role: 'SUPER_ADMIN', active: true,
    passwordHash: `scrypt:${salt.toString('hex')}:${scryptSync(loginPassword, salt, 64).toString('hex')}` } });
  const season = await db.season.create({ data: { name: '2026/27', slug: '2026-27', startsAt: new Date('2026-09-01'), endsAt: new Date('2027-05-01'), isActive: true } });
  const competition = await db.competition.create({ data: { seasonId: season.id, name: 'Чемпионат — проверка', slug: 'championship', type: 'CHAMPIONSHIP', isActive: true } });
  const division = await db.division.create({ data: { competitionId: competition.id, name: 'Проверка', slug: 'check' } });
  const stage = await db.matchStage.create({ data: { divisionId: division.id, name: 'Регулярный', slug: 'regular', type: 'GROUP_STAGE', countsForStandings: true } });
  const entries = [], players = [], rosters = [];
  for (const [i, label] of ['Хозяева', 'Гости'].entries()) {
    const team = await db.team.create({ data: { slug: `check-${i}`, name: label, shortName: label } });
    entries.push(await db.teamEntry.create({ data: { teamId: team.id, divisionId: division.id } }));
    players.push(await db.player.create({ data: { slug: `check-player-${i}`, firstName: 'Тест', lastName: i ? 'Нарушитель' : 'Исполнитель', position: 'Нападающий', baseNumber: String(i + 10) } }));
    rosters.push(await db.rosterEntry.create({ data: { teamEntryId: entries[i].id, playerId: players[i].id } }));
  }
  const match = await db.match.create({ data: { slug: 'shb-roundtrip', divisionId: division.id, stageId: stage.id, homeTeamEntryId: entries[0].id, awayTeamEntryId: entries[1].id, startsAt: new Date('2026-11-12T12:00:00Z') } });
  const log = createWriteStream(`.runtime/${name}/server.log`);
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', String(appPort), '-H', '127.0.0.1'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.pipe(log); server.stderr.pipe(log);
  for (let i = 0; i < 90; i++) {
    try { if ((await request('/api/ready')).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  const login = await request('/api/admin/auth/login', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'shb-check', password: loginPassword }) });
  check('Authenticated through the normal login endpoint', login.ok);
  const headers = { Origin: base, 'Content-Type': 'application/json', Cookie: login.headers.get('set-cookie').split(';')[0] };
  const read = async () => {
    const r = await request('/api/admin/match-protocol?slug=shb-roundtrip', { headers }); assert.equal(r.status, 200); return r.json();
  };
  const save = async (body) => {
    const r = await request('/api/admin/match-protocol', { method: 'PUT', headers, body: JSON.stringify(body) });
    assert.equal(r.status, 200, `Save failed: ${await r.text()}`);
  };
  const common = { matchId: match.id, status: 'FINAL', resultType: 'NORMAL', rosterEntryIds: rosters.map(r => r.id), shootouts: [], protocolData: { eventTimesAbsolute: true, goalieStints: [], shots: [] } };
  await save({ ...common, expectedUpdatedAt: match.updatedAt.toISOString(),
    goals: [{ teamEntryId: entries[0].id, scorerId: players[0].id, situation: 'PENALTY_SHOT', penaltyShotOutcome: 'miss', period: 2, clockSeconds: 1500 }],
    penalties: [{ teamEntryId: entries[1].id, playerId: players[1].id, minutes: 'ШБ', reason: 'Подножка', reasonCode: 'ПОДН', period: 2, clockSeconds: 1490 }] });
  let loaded = await read();
  function verifyLoaded(value) {
    check('Reload retains missed in-game shot, player and time', value.penaltyShots.length === 1 && value.penaltyShots[0].phase === 'IN_GAME' && value.penaltyShots[0].scored === false && value.penaltyShots[0].playerId === players[0].id && value.penaltyShots[0].clockSeconds === 1500);
    check('Reload retains zero-minute penalty award, player, reason and time', value.penalties.length === 1 && value.penalties[0].minutes === 0 && value.penalties[0].playerId === players[1].id && value.penalties[0].reason === 'Подножка' && value.penalties[0].clockSeconds === 1490);
    check('Score and goal list stay empty', value.homeScore === 0 && value.awayScore === 0 && value.goals.length === 0);
  }
  verifyLoaded(loaded);
  // Resubmit the representation reconstructed by the admin editor after reopening.
  await save({ ...common, expectedUpdatedAt: loaded.updatedAt,
    goals: loaded.penaltyShots.filter(s => s.phase === 'IN_GAME').map(s => ({ teamEntryId: s.teamEntryId, scorerId: s.playerId, situation: 'PENALTY_SHOT', penaltyShotOutcome: 'miss', period: s.period, clockSeconds: s.clockSeconds })),
    penalties: loaded.penalties.map(p => ({ ...p, minutes: p.minutes === 0 ? 'ШБ' : String(p.minutes) })) });
  loaded = await read(); verifyLoaded(loaded);
  const stats = await db.playerStatistic.findMany();
  check('Repeated save adds no goals, assists, penalty minutes or duplicate appearances', stats.length === 2 && stats.every(s => s.goals === 0 && s.assists === 0 && s.penaltyMinutes === 0 && s.games === 1));
  const publicResponse = await request('/match/shb-roundtrip');
  check('Public match returns HTTP 200', publicResponse.status === 200);
  const html = await publicResponse.text();
  const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<!--.*?-->/gs, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  check('Public protocol labels the missed shot', visible.includes('ШБ · нереализованный'));
  check('Public protocol labels awarded shot instead of zero minutes', visible.includes('ШБ · назначен штрафной бросок') && !visible.includes('0 мин.'));
  check('Public protocol contains both event times and the reason', visible.includes('25:00') && visible.includes('24:50') && visible.includes('Подножка'));
  writeFileSync('.runtime/penalty-shot-roundtrip-report.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, database: 'isolated disposable PostgreSQL', result: 'passed' }, null, 2));
  console.log(`All ${checks.length} checks passed; working database untouched.`);
} finally {
  await db.$disconnect();
  if (server?.pid) {
    if (process.platform === 'win32') { try { execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'pipe' }); } catch {} }
    else server.kill('SIGTERM');
  }
  if (created) docker('rm', '-fv', name);
}
