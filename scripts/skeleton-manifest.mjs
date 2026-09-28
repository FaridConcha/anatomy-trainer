// Turns detected answer boxes + hand overrides into manifest entries with hotspots and masks.
// Overrides (scripts/skeleton-overrides.json), all coordinates as fractions of the full page:
//   { "<page>": { crop:[x,y,w,h], title, groups:[...], drop:[idx...], set:{ "idx":"termId" },
//                 add:[{ box:[x,y,w,h], termId }], masks:[[x,y,w,h]...] } }
import { readFileSync, writeFileSync } from 'node:fs';
const det = JSON.parse(readFileSync('scripts/skeleton-boxes.json', 'utf8'));
const ov = JSON.parse(readFileSync('scripts/skeleton-overrides.json', 'utf8'));
const content = JSON.parse(readFileSync('public/content.json', 'utf8'));
const termIds = new Set(content.terms.map((t) => t.id));
const groupOf = Object.fromEntries(content.terms.map((t) => [t.id, t.groupId]));
const labOf = Object.fromEntries(content.groups.map((g) => [g.id, g.labId]));
const manifest = JSON.parse(readFileSync('scripts/images.manifest.json', 'utf8')).filter((m) => !m.id.startsWith('skel.'));
const MX = 0.012, MY = 0.009;
let bad = 0;
for (const page of det) {
  const o = ov[page.page];
  if (!o) continue;
  const W = page.width, H = page.height;
  const [cx, cy, cw, ch] = o.crop;
  const boxes = [];
  const extraMasks = [];
  page.boxes.forEach((b, i) => {
    if (o.maskDropped?.includes(i)) extraMasks.push([b.x / W, b.y / H, b.w / W, b.h / H]);
    if (o.drop?.includes(i)) return;
    const forced = o.set?.[String(i)];
    const termId = forced ?? (b.match && b.match.score >= 0.75 && o.groups.includes(groupOf[b.match.termId]) ? b.match.termId : null);
    if (!termId) return;
    boxes.push({ x: b.x / W, y: b.y / H, w: b.w / W, h: b.h / H, termId });
  });
  for (const a of o.add ?? []) boxes.push({ x: a.box[0], y: a.box[1], w: a.box[2], h: a.box[3], termId: a.termId, prompt: a.prompt, nomask: !!a.prompt });
  for (const b of boxes) if (!termIds.has(b.termId)) { console.error(`${page.page}: unknown term ${b.termId}`); bad++; }
  const rel = (x, y) => [(x - cx) / cw, (y - cy) / ch];
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const hotspots = boxes.map((b) => {
    const [px, py] = rel(b.x + b.w / 2, b.y + b.h / 2);
    return { termId: b.termId, shape: { kind: 'point', x: +clamp(px).toFixed(4), y: +clamp(py).toFixed(4), r: 0.03 }, ...(b.prompt ? { prompt: b.prompt } : {}) };
  });
  const maskRects = [...boxes.filter((b) => !b.nomask).map((b) => [b.x - MX, b.y - MY, b.w + 2 * MX, b.h + 2 * MY]), ...(o.masks ?? []), ...extraMasks.map(([x, y, w, h]) => [x - MX, y - MY, w + 2 * MX, h + 2 * MY])];
  const masks = maskRects.map(([x, y, w, h]) => {
    const [x0, y0] = rel(x, y), [x1, y1] = rel(x + w, y + h);
    return { x: +clamp(x0).toFixed(4), y: +clamp(y0).toFixed(4), w: +(clamp(x1) - clamp(x0)).toFixed(4), h: +(clamp(y1) - clamp(y0)).toFixed(4) };
  }).filter((m) => m.w > 0 && m.h > 0);
  const groups = Array.from(new Set(boxes.map((b) => groupOf[b.termId])));
  manifest.push({ id: `skel.${page.page}`, from: page.file, crop: [Math.round(cx * W), Math.round(cy * H), Math.round(cw * W), Math.round(ch * H)], labId: labOf[groups[0]] ?? 'lab5', groupIds: groups, title: o.title, view: o.view ?? o.title, hotspots, masks });
  console.log(`${page.page}: ${hotspots.length} hotspots, ${masks.length} masks, groups ${groups.join(', ')}`);
}
if (bad) process.exit(1);
writeFileSync('scripts/images.manifest.json', JSON.stringify(manifest, null, 1));
