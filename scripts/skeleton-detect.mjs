// Finds the handwritten (red ink) answer boxes on the 2024 skeleton pages, reads the OCR words
// inside each, and matches them to terms. Output: scripts/skeleton-boxes.json + a review sheet.
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const [outJson, outJpg] = process.argv.slice(2);
const content = JSON.parse(readFileSync('public/content.json', 'utf8'));
const termsByGroup = {};
for (const t of content.terms) (termsByGroup[t.groupId] ??= []).push(t);

// page → candidate groups (pages with no labelled diagram are omitted)
const pages = {
  'axial-03': ['skull.bones'],
  'axial-04': ['skull.sutures', 'skull.frontal-facial', 'skull.bones'],
  'axial-05': ['skull.bones'],
  'axial-06': ['skull.bones'],
  'axial-07': ['skull.occipital', 'skull.foramina'],
  'axial-08': ['skull.temporal', 'skull.foramina'],
  'axial-09': ['foot.tarsals', 'foot.bones'],
  'axial-10': ['humerus'],
  'axial-11': ['radius', 'ulna'],
  'axial-12': ['tibia', 'fibula'],
  'append-03': ['hand.carpals', 'hand.bones'],
  'append-04': ['hip'],
  'append-05': ['scapula', 'clavicle'],
  'append-07': ['skull.frontal-facial', 'skull.foramina', 'skull.bones'],
  'append-08': ['skull.ethmoid'],
  'append-09': ['skull.bones', 'skull.sphenoid', 'skull.frontal-facial'],
  'append-10': ['skull.mandible', 'skull.foramina'],
  'append-12': ['skull.bones'],
};

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
function lev(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i), cur = [];
  for (let i = 1; i <= m; i++) { cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
const sim = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);

function matchTerm(text, groups) {
  const n = norm(text);
  if (!n) return null;
  let best = null;
  const consider = (t, weight) => {
    for (const f of [t.name, ...(t.aliases ?? [])]) {
      const s = sim(n, norm(f)) * weight;
      if (!best || s > best.score) best = { termId: t.id, name: t.name, score: +s.toFixed(2) };
    }
  };
  for (const g of groups) for (const t of termsByGroup[g] ?? []) consider(t, 1);
  for (const t of content.terms) if (!groups.includes(t.groupId) && /^(skull|humerus|radius|ulna|hand|hip|femur|tibia|fibula|foot|scapula|clavicle|thorax|vertebrae|sacrum)/.test(t.groupId)) consider(t, 0.85);
  return best;
}

function parseWords(html) {
  return [...html.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)].map((m) => ({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], text: m[5].replace(/&amp;/g, '&') }));
}

const results = [];
for (const [page, groups] of Object.entries(pages)) {
  const file = `raw/skeleton/${page}.png`;
  const img = sharp(file);
  const meta = await img.metadata();
  const W = 500, scale = meta.width / W, H = Math.round(meta.height / scale);
  const { data } = await img.resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const red = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    red[i] = r > 90 && r < 235 && r - g >= 32 && Math.abs(g - b) <= 18 ? 1 : 0;
  }
  // dilate to merge letters into lines/boxes
  const R = 2, RX = 8;
  const dil = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!red[y * W + x]) continue;
    for (let dy = -R; dy <= R; dy++) for (let dx = -RX; dx <= RX; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W) dil[yy * W + xx] = 1; }
  }
  const seen = new Uint8Array(W * H);
  const comps = [];
  for (let s = 0; s < W * H; s++) {
    if (!dil[s] || seen[s]) continue;
    const stack = [s]; seen[s] = 1; let n = 0, nred = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
    while (stack.length) {
      const p = stack.pop(); n++; if (red[p]) nred++;
      const x = p % W, y = (p - x) / W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue; const q = yy * W + xx; if (dil[q] && !seen[q]) { seen[q] = 1; stack.push(q); } }
    }
    if (nred < 20) continue;
    comps.push({ x: (x0 + RX) * scale, y: (y0 + R) * scale, w: (x1 - x0 - RX * 2 + 1) * scale, h: (y1 - y0 - R * 2 + 1) * scale, nred });
  }
  // merge two stacked lines of one answer box: small vertical gap, strong horizontal overlap
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < comps.length; i++) for (let j = i + 1; j < comps.length; j++) {
      const a = comps[i], b = comps[j];
      const gap = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
      const ov = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      if (gap < 0.45 * Math.min(a.h, b.h) && ov > 0.4 * Math.min(a.w, b.w)) {
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        comps[i] = { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y, nred: a.nred + b.nred };
        comps.splice(j, 1); merged = true; break outer;
      }
    }
  }
  const words = parseWords(readFileSync(`raw/skeleton/${page}.bbox.html`, 'utf8'));
  const boxes = comps.map((c) => {
    const pad = 14;
    const inside = words.filter((w) => { const cx = (w.x0 + w.x1) / 2, cy = (w.y0 + w.y1) / 2; return cx >= c.x - pad && cx <= c.x + c.w + pad && cy >= c.y - pad && cy <= c.y + c.h + pad; });
    inside.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    const text = inside.map((w) => w.text).join(' ');
    return { x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.w), h: Math.round(c.h), text, match: matchTerm(text, groups) };
  }).sort((a, b) => a.y - b.y || a.x - b.x);
  results.push({ page, file, width: meta.width, height: meta.height, groups, boxes });
}
writeFileSync(outJson, JSON.stringify(results, null, 1));
import { mkdirSync } from 'node:fs';
mkdirSync(outJpg.replace(/\.jpg$/, ''), { recursive: true });
for (const r of results) {
  const pw = 1000, s = pw / r.width, ph = Math.round(r.height * s);
  const grid = [...Array(11).keys()].map((k) => `<line x1="${k * pw / 10}" y1="0" x2="${k * pw / 10}" y2="${ph}" stroke="#09f" stroke-width="1" stroke-dasharray="4 4"/><line x1="0" y1="${k * ph / 10}" x2="${pw}" y2="${k * ph / 10}" stroke="#09f" stroke-width="1" stroke-dasharray="4 4"/><text x="${k * pw / 10 + 2}" y="12" fill="#09f" font-size="11">${k / 10}</text><text x="2" y="${k * ph / 10 + 12}" fill="#09f" font-size="11">${k / 10}</text>`).join('');
  const boxes = r.boxes.map((b, i) => `<rect x="${b.x * s}" y="${b.y * s}" width="${b.w * s}" height="${b.h * s}" fill="none" stroke="${b.match && b.match.score >= 0.75 ? '#0c0' : '#f0f'}" stroke-width="2"/><rect x="${b.x * s - 2}" y="${b.y * s - 16}" width="22" height="15" fill="#00f"/><text x="${b.x * s}" y="${b.y * s - 4}" fill="#fff" font-size="13" font-weight="bold">${i}</text>`).join('');
  await sharp(r.file).resize({ width: pw }).composite([{ input: Buffer.from(`<svg width="${pw}" height="${ph}">${grid}${boxes}</svg>`), left: 0, top: 0 }]).jpeg({ quality: 72 }).toFile(`${outJpg.replace(/\.jpg$/, '')}/${r.page}.jpg`);
}

// review sheet: 3 columns, boxes numbered, list under each page
const cols = 3, tw = 600;
const tiles = [];
for (const r of results) {
  const s = tw / r.width, th = Math.round(r.height * s);
  const svg = `<svg width="${tw}" height="${th}">${r.boxes.map((b, i) => `<rect x="${b.x * s}" y="${b.y * s}" width="${b.w * s}" height="${b.h * s}" fill="none" stroke="${b.match && b.match.score >= 0.6 ? '#0c0' : '#f0f'}" stroke-width="2"/><text x="${b.x * s}" y="${b.y * s - 2}" fill="#00f" font-size="14" font-weight="bold">${i}</text>`).join('')}</svg>`;
  const buf = await sharp(r.file).resize({ width: tw }).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).jpeg({ quality: 70 }).toBuffer();
  const lines = r.boxes.map((b, i) => `${i}: ${b.text.slice(0, 28)} → ${b.match ? `${b.match.name} (${b.match.score})` : '?'}`);
  const lh = 13, listH = lines.length * lh + 22;
  const list = `<svg width="${tw}" height="${listH}"><rect width="100%" height="100%" fill="#111"/><text x="4" y="14" fill="#ff0" font-size="12" font-family="monospace">${r.page}</text>${lines.map((l, i) => `<text x="4" y="${28 + i * lh}" fill="#eee" font-size="11" font-family="monospace">${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`).join('')}</svg>`;
  const tile = await sharp({ create: { width: tw, height: th + listH, channels: 3, background: '#333' } }).composite([{ input: buf, left: 0, top: 0 }, { input: Buffer.from(list), left: 0, top: th }]).jpeg({ quality: 70 }).toBuffer();
  tiles.push({ buf: tile, h: th + listH });
}
const rowH = [];
for (let i = 0; i < tiles.length; i += cols) rowH.push(Math.max(...tiles.slice(i, i + cols).map((t) => t.h)));
const total = rowH.reduce((a, b) => a + b, 0);
const comps = tiles.map((t, i) => ({ input: t.buf, left: (i % cols) * tw, top: rowH.slice(0, Math.floor(i / cols)).reduce((a, b) => a + b, 0) }));
await sharp({ create: { width: cols * tw, height: total, channels: 3, background: '#333' } }).composite(comps).jpeg({ quality: 70 }).toFile(outJpg);
console.log(results.map((r) => `${r.page}: ${r.boxes.length} boxes, ${r.boxes.filter((b) => b.match && b.match.score >= 0.6).length} matched`).join('\n'));
