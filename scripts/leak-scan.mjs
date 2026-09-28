// Flags printed or handwritten words on a skeleton page that match a term name and are not covered by a mask.
import { readFileSync, readdirSync } from 'node:fs';
const content = JSON.parse(readFileSync('public/content.json', 'utf8'));
const ov = JSON.parse(readFileSync('scripts/skeleton-overrides.json', 'utf8'));
const det = JSON.parse(readFileSync('scripts/skeleton-boxes.json', 'utf8'));
const norm = (s) => s.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const names = new Map();
for (const t of content.terms) for (const f of [t.name, ...(t.aliases ?? [])]) { const n = norm(f); if (n.length > 4) names.set(n, t.id); }
let total = 0;
for (const page of det) {
  const o = ov[page.page]; if (!o) continue;
  const img = JSON.parse(readFileSync(`content/images/skel.${page.page}.json`, 'utf8'));
  const hot = new Set(img.hotspots.map((h) => h.termId));
  const html = readFileSync(`raw/skeleton/${page.page}.bbox.html`, 'utf8');
  const words = [...html.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)].map((m) => ({ x: (+m[1] + +m[3]) / 2 / page.width, y: (+m[2] + +m[4]) / 2 / page.height, text: m[5] }));
  const [cx, cy, cw, ch] = o.crop;
  const inside = words.filter((w) => w.x >= cx && w.x <= cx + cw && w.y >= cy && w.y <= cy + ch).sort((a, b) => a.y - b.y || a.x - b.x);
  const covered = (w) => img.masks.some((m) => { const rx = (w.x - cx) / cw, ry = (w.y - cy) / ch; return rx >= m.x && rx <= m.x + m.w && ry >= m.y && ry <= m.y + m.h; });
  // join runs of up to three consecutive words to catch multi-word names
  const leaks = [];
  for (let i = 0; i < inside.length; i++) for (let n = 1; n <= 3 && i + n <= inside.length; n++) {
    const run = inside.slice(i, i + n); const phrase = norm(run.map((w) => w.text).join(' '));
    const id = names.get(phrase);
    if (id && hot.has(id) && run.every((w) => !covered(w))) leaks.push(`${phrase} → ${id} at (${run[0].x.toFixed(2)}, ${run[0].y.toFixed(2)})`);
  }
  if (leaks.length) { total += leaks.length; console.log(`skel.${page.page}:`); for (const l of new Set(leaks)) console.log('  ' + l); }
}
console.log(total ? `${total} possible leak(s)` : 'no unmasked term names found');
