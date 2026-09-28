// Hand-authored entries for the Lab 3 figures and the histology muscle worksheet.
// Coordinates are fractions of the source image; crops convert hotspots/masks to crop space.
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
const manifest = JSON.parse(readFileSync('scripts/images.manifest.json', 'utf8')).filter((m) => !m.id.startsWith('skin.') && !m.id.startsWith('hist.muscle-'));
const P = (x, y, termId) => ({ termId, shape: { kind: 'point', x, y, r: 0.03 } });
const M = (x, y, w, h) => ({ x, y, w, h });
async function entry(e) {
  const meta = await sharp(e.from).metadata();
  const [cx, cy, cw, ch] = e.cropF ?? [0, 0, 1, 1];
  const rel = (x, y) => [(x - cx) / cw, (y - cy) / ch];
  const hotspots = e.hotspots.map((h) => { const [x, y] = rel(h.shape.x, h.shape.y); return { ...h, shape: { ...h.shape, x: +x.toFixed(4), y: +y.toFixed(4) } }; });
  const masks = (e.masks ?? []).map((m) => { const [x0, y0] = rel(m.x, m.y), [x1, y1] = rel(m.x + m.w, m.y + m.h); return M(+x0.toFixed(4), +y0.toFixed(4), +(x1 - x0).toFixed(4), +(y1 - y0).toFixed(4)); });
  manifest.push({ id: e.id, whiteOutBlack: e.whiteOutBlack, from: e.from, crop: e.cropF ? [Math.round(cx * meta.width), Math.round(cy * meta.height), Math.round(cw * meta.width), Math.round(ch * meta.height)] : undefined, labId: e.labId, groupIds: e.groupIds, title: e.title, hotspots, masks });
}
await entry({ id: 'skin.block', whiteOutBlack: true, from: 'raw/lab3/img-000.png', labId: 'lab3', groupIds: ['skin.layers', 'skin.appendages', 'skin.receptors'], title: 'Skin block diagram',
  hotspots: [P(0.885, 0.115, 'skin.appendages.hair-shaft'), P(0.905, 0.225, 'skin.appendages.sweat-pore'), P(0.905, 0.29, 'skin.layers.epidermis'), P(0.895, 0.46, 'skin.layers.dermis'), P(0.93, 0.685, 'skin.layers.hypodermis'), P(0.915, 0.795, 'skin.appendages.eccrine-sweat-gland'),
    P(0.06, 0.225, 'skin.appendages.epidermal-ridges'), P(0.06, 0.26, 'skin.appendages.dermal-papillae'), P(0.065, 0.315, 'skin.receptors.tactile-corpuscle'), P(0.045, 0.465, 'skin.appendages.hair-follicle'), P(0.065, 0.51, 'skin.appendages.sebaceous-gland'), P(0.05, 0.555, 'skin.receptors.hair-receptor'), P(0.08, 0.62, 'skin.appendages.apocrine-sweat-gland'), P(0.035, 0.68, 'skin.appendages.hair-bulb'),
    P(0.25, 0.865, 'skin.appendages.arrector-pili-muscle'), P(0.3, 0.92, 'skin.receptors.lamellated-corpuscle')],
  masks: [M(0.855, 0.1, 0.07, 0.035), M(0.855, 0.21, 0.11, 0.035), M(0.86, 0.275, 0.1, 0.035), M(0.86, 0.445, 0.08, 0.035), M(0.855, 0.655, 0.145, 0.065), M(0.855, 0.765, 0.13, 0.065),
    M(0, 0.21, 0.125, 0.032), M(0, 0.245, 0.125, 0.032), M(0, 0.285, 0.135, 0.065), M(0, 0.45, 0.095, 0.032), M(0, 0.495, 0.135, 0.032), M(0, 0.54, 0.105, 0.032), M(0, 0.605, 0.165, 0.032), M(0, 0.665, 0.075, 0.032),
    M(0.185, 0.85, 0.13, 0.035), M(0.185, 0.89, 0.23, 0.065), M(0, 0.39, 0.125, 0.032), M(0, 0.755, 0.1, 0.06), M(0.855, 0.85, 0.145, 0.06), M(0.855, 0.945, 0.145, 0.04)] });
await entry({ id: 'skin.epidermis', from: 'raw/lab3/img-014.png', cropF: [0, 0.06, 0.385, 0.85], labId: 'lab3', groupIds: ['skin.strata', 'skin.layers'], title: 'Epidermis, photomicrograph',
  hotspots: [P(0.2, 0.18, 'skin.strata.stratum-corneum'), P(0.25, 0.315, 'skin.strata.stratum-lucidum'), P(0.25, 0.36, 'skin.strata.stratum-granulosum'), P(0.2, 0.55, 'skin.strata.stratum-spinosum'), P(0.28, 0.76, 'skin.strata.stratum-basale'), P(0.15, 0.88, 'skin.layers.dermis'), P(0.1, 0.45, 'skin.layers.epidermis')] });
await entry({ id: 'skin.dermis', from: 'raw/lab3/img-038.png', labId: 'lab3', groupIds: ['skin.layers'], title: 'Dermis: micrograph and SEM',
  hotspots: [P(0.29, 0.38, 'skin.layers.papillary-layer'), P(0.34, 0.67, 'skin.layers.reticular-layer'), P(0.15, 0.3, 'skin.layers.epidermis'), P(0.85, 0.2, 'skin.layers.papillary-layer'), P(0.85, 0.75, 'skin.layers.reticular-layer')],
  masks: [M(0.69, 0.42, 0.31, 0.055), M(0.69, 0.94, 0.31, 0.06)] });
await entry({ id: 'hist.muscle-smooth-w', from: 'raw/histology/hist-21.png', cropF: [0.47, 0.07, 0.185, 0.26], labId: 'lab2', groupIds: ['tissue.muscle'], title: 'Smooth muscle', hotspots: [{ termId: 'tissue.muscle.smooth-muscle', shape: { kind: 'whole' } }] });
await entry({ id: 'hist.muscle-cardiac-w', from: 'raw/histology/hist-21.png', cropF: [0.47, 0.39, 0.185, 0.24], labId: 'lab2', groupIds: ['tissue.muscle'], title: 'Cardiac muscle', hotspots: [{ termId: 'tissue.muscle.cardiac-muscle', shape: { kind: 'whole' } }] });
await entry({ id: 'hist.muscle-skeletal-w', from: 'raw/histology/hist-21.png', cropF: [0.46, 0.71, 0.19, 0.225], labId: 'lab2', groupIds: ['tissue.muscle'], title: 'Skeletal muscle', hotspots: [{ termId: 'tissue.muscle.skeletal-muscle', shape: { kind: 'whole' } }] });
writeFileSync('scripts/images.manifest.json', JSON.stringify(manifest, null, 1));
console.log(manifest.length, 'entries');
