import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const sharp = require(require.resolve('sharp', { paths: [require.resolve('next')] }));

await mkdir('public/images/optimized', { recursive: true });
const source = await readFile('public/images/hero-hockey.png');
const hash = createHash('sha256').update(source).digest('hex').slice(0, 12);
const name = `hero-hockey-${hash}.webp`;
await sharp(source).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(`public/images/optimized/${name}`);
// Mechanical replacement of this one static background; keep the original file.
for (const path of ['src/app/globals.css', 'src/app/polish.css', 'src/components/home-page-client.tsx']) {
  const text = await readFile(path, 'utf8');
  await writeFile(path, text.replaceAll('/images/hero-hockey.png', `/images/optimized/${name}`));
}
const logo = await readFile('public/images/lhl76-logo.jpg');
await sharp(logo).resize(180, 180).png().toFile('src/app/apple-icon.png');
await sharp(logo).resize(192, 192).png().toFile('src/app/icon.png');
const png = await sharp(logo).resize(48, 48).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header[6] = 48; header[7] = 48;
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
await writeFile('src/app/favicon.ico', Buffer.concat([header, png]));
console.log({ background: name, originalBytes: source.length, optimizedBytes: (await readFile(`public/images/optimized/${name}`)).length });
