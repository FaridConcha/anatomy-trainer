// Finds photo rectangles on scanned pages: connected regions of non-paper pixels with a solid fill.
// Usage: node scripts/detect-photos.mjs out.json out.jpg file...
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
const [outJson, outJpg, ...files] = process.argv.slice(2);
const W = 220;
const results = [];
for (const f of files) {
  const img = sharp(f);
  const meta = await img.metadata();
  const scale = meta.width / W;
  const H = Math.round(meta.height / scale);
  const { data } = await img.resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    mask[i] = (mx - mn > 14 || mx < 205) ? 1 : 0;
  }
  const dil = mask;
  const seen = new Uint8Array(W * H);
  const boxes = [];
  for (let s = 0; s < W * H; s++) {
    if (!dil[s] || seen[s]) continue;
    const stack = [s]; seen[s] = 1; let n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
    while (stack.length) {
      const p = stack.pop(); n++;
      const x = p % W, y = (p - x) / W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue; const q = yy * W + xx; if (dil[q] && !seen[q]) { seen[q] = 1; stack.push(q); } }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, area = bw * bh;
    const fill = n / area;
    if (area > W * H * 0.015 && fill > 0.5 && bw > 12 && bh > 12)
      boxes.push({ x: Math.round((x0 + 1) * scale), y: Math.round((y0 + 1) * scale), w: Math.round((bw - 2) * scale), h: Math.round((bh - 2) * scale), fill: +fill.toFixed(2) });
  }
  boxes.sort((a, b) => a.y - b.y || a.x - b.x);
  results.push({ file: f, width: meta.width, height: meta.height, boxes });
}
writeFileSync(outJson, JSON.stringify(results, null, 1));
// verification sheet
const cols = 6, tw = 300;
const thumbs = [];
for (const r of results) {
  const s = tw / r.width, th = Math.round(r.height * s);
  const svg = `<svg width="${tw}" height="${th}">${r.boxes.map((b, i) => `<rect x="${b.x * s}" y="${b.y * s}" width="${b.w * s}" height="${b.h * s}" fill="none" stroke="#0f0" stroke-width="3"/><text x="${b.x * s + 4}" y="${b.y * s + 16}" fill="#0f0" font-size="16" font-weight="bold">${i}</text>`).join('')}</svg>`;
  const buf = await sharp(r.file).resize({ width: tw }).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).jpeg({ quality: 70 }).toBuffer();
  thumbs.push({ buf, h: th, name: r.file.split('/').pop() + ` (${r.boxes.length})` });
}
const th = Math.max(...thumbs.map(t => t.h)) + 18, rows = Math.ceil(thumbs.length / cols);
await sharp({ create: { width: cols * tw, height: rows * th, channels: 3, background: '#888' } }).composite(thumbs.flatMap((t, i) => { const x = (i % cols) * tw, y = Math.floor(i / cols) * th; return [{ input: Buffer.from(`<svg width="${tw}" height="18"><rect width="100%" height="100%" fill="#222"/><text x="4" y="13" font-size="12" fill="#fff" font-family="monospace">${i + 1}: ${t.name}</text></svg>`), left: x, top: y }, { input: t.buf, left: x, top: y + 18 }]; })).jpeg({ quality: 75 }).toFile(outJpg);
console.log(results.map(r => `${r.file.split('/').pop()}: ${r.boxes.length}`).join('\n'));
