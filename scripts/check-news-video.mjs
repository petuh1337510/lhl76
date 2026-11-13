import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';
import { writeFile, readFile, unlink } from 'node:fs/promises';
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/lhl76_import_test') throw new Error('Local test database required');
const db = new PrismaClient();
const fixture = '.runtime/news-video-check.json';
if (process.argv.includes('--cleanup')) {
  try {
    const data = JSON.parse(await readFile(fixture, 'utf8'));
    if (!data.username.startsWith('news-clip-check-')) throw new Error('Unexpected test fixture');
    await db.news.deleteMany({ where: { id: data.articleId, title: data.title } });
    await db.auditLog.deleteMany({ where: { userId: data.userId } });
    await db.user.deleteMany({ where: { id: data.userId, username: data.username } });
    await unlink(fixture); console.log('PASS temporary fixture cleanup');
  } finally { await db.$disconnect(); }
} else {
 const marker = 'news-clip-check-' + Date.now();
 const password = randomBytes(24).toString('hex'), salt = randomBytes(16);
 const base = 'http://localhost:3000';
 const data = { username: marker, password, title: 'Проверка клипа VK', userId: null, articleId: null };
 const check = (value, name) => { if (!value) throw new Error(name); console.log('PASS ' + name); };
 try {
  const user = await db.user.create({ data: { username: marker, email: marker + '@audit.invalid', name: 'Local news clip check', role: 'SUPER_ADMIN', active: true, passwordHash: `scrypt:${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}` } });
  data.userId = user.id; await writeFile(fixture, JSON.stringify(data));
  const login = await fetch(base + '/api/admin/auth/login', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: marker, password }) });
  check(login.ok, 'authentication');
  const headers = { Cookie: login.headers.get('set-cookie').split(';')[0], Origin: base, 'Content-Type': 'application/json' };
  check((await fetch(base + '/api/admin/news')).status === 401, 'anonymous admin request denied');
  const result = await fetch(base + '/api/admin/news', { method: 'POST', headers, body: JSON.stringify({ title: data.title, excerpt: 'Клип, текст и фотографии в одной новости.', body: 'Тестовая публикация только в локальной базе.', videoUrl: 'https://vk.ru/clip-170455976_456240126', gallery: ['/images/player-placeholder.svg'], status: 'DRAFT' }) });
  const article = await result.json(); check(result.status === 201, 'draft saved');
  data.articleId = article.id; data.slug = article.slug; await writeFile(fixture, JSON.stringify(data));
  check(article.imageUrl?.includes('userapi.com'), 'automatic VK cover saved');
  check(article.gallery.length === 1 && article.body.includes('Тестовая'), 'text and gallery preserved');
  const published = await fetch(base + '/api/admin/news', { method: 'PATCH', headers, body: JSON.stringify({ id: article.id, isPublished: true }) });
  check(published.ok, 'local publication saved');
  const html = await (await fetch(base + '/news/' + encodeURIComponent(article.slug))).text();
  check(html.includes('Смотреть в VK') && html.indexOf('Смотреть видео') < html.indexOf('ФОТОРЕПОРТАЖ'), 'public video before gallery with fallback');
  check(!html.includes('<iframe'), 'no iframe before user interaction');
  console.log('LOCAL_URL ' + base + '/news/' + encodeURIComponent(article.slug));
 } finally { await db.$disconnect(); }
}
