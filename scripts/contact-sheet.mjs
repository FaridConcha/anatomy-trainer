// Usage: node scripts/contact-sheet.mjs out.jpg cols thumbWidth file1 file2 ...
import sharp from 'sharp';
const [out, colsS, twS, ...files] = process.argv.slice(2);
const cols = +colsS, tw = +twS;
const thumbs = await Promise.all(files.map(async (f) => {
  const buf = await sharp(f).rotate().resize({ width: tw }).jpeg({ quality: 70 }).toBuffer();
  const m = await sharp(buf).metadata();
  return { buf, w: m.width, h: m.height, f };
}));
const th = Math.max(...thumbs.map(t => t.h)) + 18;
const rows = Math.ceil(thumbs.length / cols);
const label = (i, name) => Buffer.from(`<svg width="${tw}" height="18"><rect width="100%" height="100%" fill="#222"/><text x="4" y="13" font-size="12" fill="#fff" font-family="monospace">${i}: ${name}</text></svg>`);
const composites = thumbs.flatMap((t, i) => {
  const x = (i % cols) * tw, y = Math.floor(i / cols) * th;
  return [{ input: label(i + 1, t.f.split('/').pop()), left: x, top: y }, { input: t.buf, left: x, top: y + 18 }];
});
await sharp({ create: { width: cols * tw, height: rows * th, channels: 3, background: '#888' } }).composite(composites).jpeg({ quality: 75 }).toFile(out);
console.log('wrote', out, cols * tw, 'x', rows * th);
