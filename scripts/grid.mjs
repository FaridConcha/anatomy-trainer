// Renders an image at 1000px wide with a 0.1 fraction grid, for reading coordinates.
import sharp from 'sharp';
const [file, out] = process.argv.slice(2);
const m = await sharp(file).metadata();
const pw = 1000, s = pw / m.width, ph = Math.round(m.height * s);
const grid = [...Array(21).keys()].map((k) => { const f = k / 20, maj = k % 2 === 0; return `<line x1="${f * pw}" y1="0" x2="${f * pw}" y2="${ph}" stroke="${maj ? '#09f' : '#9cf'}" stroke-width="1" stroke-dasharray="4 4"/><line x1="0" y1="${f * ph}" x2="${pw}" y2="${f * ph}" stroke="${maj ? '#09f' : '#9cf'}" stroke-width="1" stroke-dasharray="4 4"/>${maj ? `<text x="${f * pw + 2}" y="12" fill="#00f" font-size="12" font-weight="bold">${f.toFixed(1)}</text><text x="2" y="${f * ph + 12}" fill="#00f" font-size="12" font-weight="bold">${f.toFixed(1)}</text>` : ''}`; }).join('');
await sharp(file).flatten({ background: '#fff' }).resize({ width: pw, height: ph, fit: 'fill' }).composite([{ input: Buffer.from(`<svg width="${pw}" height="${ph}">${grid}</svg>`), left: 0, top: 0 }]).jpeg({ quality: 80 }).toFile(out);
console.log(out, m.width, m.height);
