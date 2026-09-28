// Builds the histology part of scripts/images.manifest.json from detected boxes plus hand-set overrides.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const det = JSON.parse(readFileSync('scripts/hist-boxes.json', 'utf8'));
const byFile = Object.fromEntries(det.map(d => [d.file.split('/').pop(), d]));
const pages = {
  'hist-02.png': ['simple-squamous', 'tissue.epithelial', 'tissue.epithelial.simple-squamous-epithelium', 'Simple squamous epithelium'],
  'hist-03.png': ['hyaline-cartilage', 'tissue.connective.cartilage', 'tissue.connective.cartilage.hyaline-cartilage', 'Hyaline cartilage'],
  'hist-04.png': ['fibrocartilage', 'tissue.connective.cartilage', 'tissue.connective.cartilage.fibrocartilage', 'Fibrocartilage'],
  'hist-05.png': ['areolar', 'tissue.connective.fibrous', 'tissue.connective.fibrous.areolar-tissue', 'Areolar tissue'],
  'hist-06.png': ['urothelium', 'tissue.epithelial', 'tissue.epithelial.urothelium', 'Urothelium'],
  'hist-07.png': ['elastic-cartilage', 'tissue.connective.cartilage', 'tissue.connective.cartilage.elastic-cartilage', 'Elastic cartilage'],
  'hist-08.png': ['bone', 'tissue.connective.other', 'tissue.connective.other.bone', 'Bone'],
  'hist-09.png': ['pseudostratified', 'tissue.epithelial', 'tissue.epithelial.pseudostratified-columnar-epithelium', 'Pseudostratified columnar epithelium'],
  'hist-10.png': ['keratinized', 'tissue.epithelial', 'tissue.epithelial.keratinized-stratified-squamous-epithelium', 'Keratinized stratified squamous epithelium'],
  'hist-11.png': ['reticular', 'tissue.connective.fibrous', 'tissue.connective.fibrous.reticular-tissue', 'Reticular tissue'],
  'hist-12.png': ['adipose', 'tissue.connective.fibrous', 'tissue.connective.fibrous.adipose-tissue', 'Adipose tissue'],
  'hist-13.png': ['blood', 'tissue.connective.other', 'tissue.connective.other.blood', 'Blood'],
  'hist-14.png': ['dense-irregular', 'tissue.connective.fibrous', 'tissue.connective.fibrous.dense-irregular-connective-tissue', 'Dense irregular connective tissue'],
  'hist-15.png': ['dense-regular', 'tissue.connective.fibrous', 'tissue.connective.fibrous.dense-regular-connective-tissue', 'Dense regular connective tissue'],
  'hist-16.png': ['simple-columnar', 'tissue.epithelial', 'tissue.epithelial.simple-columnar-epithelium', 'Simple columnar epithelium'],
  'hist-17.png': ['simple-cuboidal', 'tissue.epithelial', 'tissue.epithelial.simple-cuboidal-epithelium', 'Simple cuboidal epithelium'],
  'hist-18.png': ['nonkeratinized', 'tissue.epithelial', 'tissue.epithelial.nonkeratinized-stratified-squamous-epithelium', 'Nonkeratinized stratified squamous epithelium'],
  'hist-19.png': ['stratified-cuboidal', 'tissue.epithelial', 'tissue.epithelial.stratified-cuboidal-epithelium', 'Stratified cuboidal epithelium'],
  'hist-20.png': ['nervous', 'tissue.nervous', 'tissue.nervous.nervous-tissue', 'Nervous tissue'],
  'muscle-1.png': ['smooth-muscle', 'tissue.muscle', 'tissue.muscle.smooth-muscle', 'Smooth muscle'],
  'muscle-2.png': ['cardiac-muscle', 'tissue.muscle', 'tissue.muscle.cardiac-muscle', 'Cardiac muscle'],
};
// Boxes in 300px-thumbnail units [x, y, w, h]. `extra` adds to detected boxes; `replace` discards them.
const extra = { 'hist-02.png': [[90, 195, 135, 130]], 'hist-13.png': [[65, 205, 150, 145]], 'hist-18.png': [[90, 200, 100, 150]] };
const replace = {
  'hist-03.png': [[35, 37, 100, 115], [155, 39, 90, 58], [155, 102, 90, 52]],
  'hist-04.png': [[65, 52, 165, 140], [65, 197, 170, 150]],
  'hist-07.png': [[55, 72, 85, 135], [145, 72, 80, 135], [55, 222, 180, 145]],
  'hist-12.png': [[58, 47, 77, 130], [145, 47, 80, 130]],
  'hist-19.png': [[65, 57, 80, 120], [150, 57, 62, 120], [65, 182, 148, 155]],
};
const manifest = existsSync('scripts/images.manifest.json') ? JSON.parse(readFileSync('scripts/images.manifest.json', 'utf8')).filter(m => !m.id.startsWith('hist.')) : [];
for (const [file, [slug, groupId, termId, title]] of Object.entries(pages)) {
  const d = byFile[file]; const k = d.width / 300;
  const boxes = replace[file] ? [] : d.boxes.map(b => [b.x, b.y, b.w, b.h]);
  for (const e of [...(extra[file] ?? []), ...(replace[file] ?? [])]) boxes.push(e.map(v => Math.round(v * k)));
  boxes.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  boxes.forEach((crop, i) => manifest.push({ id: `hist.${slug}-${i + 1}`, from: `raw/histology/${file}`, crop, labId: 'lab2', groupIds: [groupId], title, hotspots: [{ termId, shape: { kind: 'whole' } }] }));
}
writeFileSync('scripts/images.manifest.json', JSON.stringify(manifest, null, 1));
console.log(manifest.filter(m => m.id.startsWith('hist.')).length, 'histology images');
