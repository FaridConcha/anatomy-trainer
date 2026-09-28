// Renders each image with its masks and sticker markers baked in, for review.
import sharp from 'sharp';
import { readFileSync, readdirSync } from 'node:fs';
const [out, prefix, cols = '3', tw = '600'] = process.argv.slice(2);
const files = readdirSync('content/images').filter((f) => f.startsWith(prefix) && f.endsWith('.json'));
const tiles = [];
for (const f of files) {
  const img = JSON.parse(readFileSync(`content/images/${f}`, 'utf8'));
  const s = +tw / img.width, th = Math.round(img.height * s);
  const masks = img.masks.map((m) => `<rect x="${m.x * +tw}" y="${m.y * th}" width="${m.w * +tw}" height="${m.h * th}" fill="#f6f4ee" stroke="#d9d2c2"/>`).join('');
  const pts = img.hotspots.map((h, i) => h.shape.kind === 'point' ? `<circle cx="${h.shape.x * +tw}" cy="${h.shape.y * th}" r="8" fill="#F2B705" stroke="#000"/><text x="${h.shape.x * +tw}" y="${h.shape.y * th + 4}" font-size="10" text-anchor="middle" font-weight="bold">${i + 1}</text>` : '').join('');
  const buf = await sharp(`public/${img.src}`).resize({ width: +tw, height: th, fit: 'fill' }).composite([{ input: Buffer.from(`<svg width="${tw}" height="${th}">${masks}${pts}</svg>`), left: 0, top: 0 }]).jpeg({ quality: 70 }).toBuffer();
  const label = Buffer.from(`<svg width="${tw}" height="16"><rect width="100%" height="100%" fill="#222"/><text x="4" y="12" font-size="11" fill="#fff" font-family="monospace">${img.id} · ${img.hotspots.length} hs</text></svg>`);
  tiles.push({ buf, label, h: th + 16 });
}
const c = +cols, rowH = [];
for (let i = 0; i < tiles.length; i += c) rowH.push(Math.max(...tiles.slice(i, i + c).map((t) => t.h)));
const comps = tiles.flatMap((t, i) => { const x = (i % c) * +tw, y = rowH.slice(0, Math.floor(i / c)).reduce((a, b) => a + b, 0); return [{ input: t.label, left: x, top: y }, { input: t.buf, left: x, top: y + 16 }]; });
await sharp({ create: { width: c * +tw, height: rowH.reduce((a, b) => a + b, 0), channels: 3, background: '#555' } }).composite(comps).jpeg({ quality: 72 }).toFile(out);
console.log('wrote', out, tiles.length, 'images');
