// raw/ → public/img/*.webp, and a content/images/<id>.json stub for any image that has none.
// Manifest entries: { id, from, crop:[x,y,w,h]?, rotate?, labId, groupIds, title?, hotspots? }
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'scripts/images.manifest.json'), 'utf8'));
const only = process.argv[2];
mkdirSync(join(root, 'public/img'), { recursive: true });
mkdirSync(join(root, 'content/images'), { recursive: true });
const MAX = 1600;
for (const m of manifest) {
  if (only && !m.id.startsWith(only)) continue;
  let img = sharp(join(root, m.from)).flatten({ background: '#ffffff' });
  if (m.crop) img = img.extract({ left: m.crop[0], top: m.crop[1], width: m.crop[2], height: m.crop[3] });
  if (m.rotate) img = img.rotate(m.rotate);
  let buf = await img.toBuffer();
  if (m.whiteOutBlack) {
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += info.channels) if (data[i] < 40 && data[i + 1] < 40 && data[i + 2] < 40) { data[i] = data[i + 1] = data[i + 2] = 255; }
    buf = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
  }
  const out = await sharp(buf).resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const meta = await sharp(out).metadata();
  const src = `img/${m.id}.webp`;
  writeFileSync(join(root, 'public', src), out);
  const jsonPath = join(root, 'content/images', `${m.id}.json`);
  const existing = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf8')) : null;
  const rec = existing ?? { id: m.id, src, width: meta.width, height: meta.height, labId: m.labId, groupIds: m.groupIds, title: m.title, view: m.view ?? m.title, hotspots: m.hotspots ?? [], masks: m.masks ?? [] };
  Object.assign(rec, { src, width: meta.width, height: meta.height });
  writeFileSync(jsonPath, JSON.stringify(rec, null, 1));
  console.log(`${m.id}: ${meta.width}x${meta.height} ${(out.length / 1024).toFixed(0)} KB`);
}
