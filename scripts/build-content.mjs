// Merges content/*.json into public/content.json and fails loudly on dangling references.
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'content');
const imagesDir = join(contentDir, 'images');
const outFile = join(root, 'public', 'content.json');

const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const errors = [];
const labs = [];
const groups = [];
const terms = [];
const questions = [];
const images = [];

function expandTerm(groupId, raw) {
  let t;
  if (typeof raw === 'string') {
    const [name, ...aliases] = raw.split('|').map((s) => s.trim()).filter(Boolean);
    t = { name, aliases: aliases.length ? aliases : undefined };
  } else {
    t = { ...raw };
  }
  if (!t.name) errors.push(`${groupId}: term without a name: ${JSON.stringify(raw)}`);
  const id = t.id ?? `${groupId}.${slug(t.name)}`;
  return { id, groupId, name: t.name, aliases: t.aliases, partials: t.partials, facts: t.facts, strict: t.strict };
}

for (const file of readdirSync(contentDir).filter((f) => /^lab\d.*\.json$/.test(f)).sort()) {
  const doc = JSON.parse(readFileSync(join(contentDir, file), 'utf8'));
  if (!doc.lab?.id) errors.push(`${file}: missing lab.id`);
  labs.push(doc.lab);
  for (const g of doc.groups ?? []) {
    const { terms: rawTerms, ...rest } = g;
    if (!rest.id || !rest.title || !rest.kind || !rest.region) errors.push(`${file}: group ${rest.id} needs id, title, kind, region`);
    groups.push({ ...rest, labId: doc.lab.id });
    for (const raw of rawTerms ?? []) terms.push(expandTerm(rest.id, raw));
  }
  (doc.questions ?? []).forEach((q, i) => {
    const id = q.id ?? `${doc.lab.id}.q${String(i + 1).padStart(2, '0')}`;
    if (q.kind === 'mc' && (!Array.isArray(q.options) || typeof q.answerIndex !== 'number'))
      errors.push(`${file}: MC question ${id} needs options and answerIndex`);
    if (q.kind === 'short' && !q.modelAnswer) errors.push(`${file}: short question ${id} needs modelAnswer`);
    questions.push({ ...q, id, labId: doc.lab.id });
  });
}

if (existsSync(imagesDir)) {
  for (const file of readdirSync(imagesDir).filter((f) => f.endsWith('.json')).sort()) {
    const img = JSON.parse(readFileSync(join(imagesDir, file), 'utf8'));
    img.source = 'content';
    img.masks ??= [];
    img.hotspots ??= [];
    const asset = join(root, 'public', img.src ?? '');
    if (!img.src || !existsSync(asset)) errors.push(`${file}: image file missing: public/${img.src}`);
    if (!img.width || !img.height) errors.push(`${file}: width/height required`);
    images.push(img);
  }
}

const termIds = new Set();
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
for (const t of terms) {
  if (termIds.has(t.id)) errors.push(`duplicate term id ${t.id}`);
  termIds.add(t.id);
  // a prompt built from a fact must not contain its own answer
  const answers = [t.name, ...(t.aliases ?? [])].map(norm).filter((a) => a.length > 3);
  for (const key of ['definition', 'location', 'transmits']) {
    const text = t.facts?.[key];
    if (!text) continue;
    const hay = ` ${norm(text)} `;
    for (const a of answers) if (hay.includes(` ${a} `)) errors.push(`${t.id}: ${key} leaks the answer “${a}”`);
  }
}
const groupIds = new Set(groups.map((g) => g.id));
if (groupIds.size !== groups.length) errors.push('duplicate group id');
const labIds = new Set(labs.map((l) => l.id));

for (const img of images) {
  if (!labIds.has(img.labId)) errors.push(`${img.id}: unknown lab ${img.labId}`);
  for (const g of img.groupIds ?? []) if (!groupIds.has(g)) errors.push(`${img.id}: unknown group ${g}`);
  for (const h of img.hotspots) if (!termIds.has(h.termId)) errors.push(`${img.id}: hotspot term not found: ${h.termId}`);
}
for (const q of questions) {
  if (q.groupId && !groupIds.has(q.groupId)) errors.push(`${q.id}: unknown group ${q.groupId}`);
  for (const t of q.termIds ?? []) if (!termIds.has(t)) errors.push(`${q.id}: unknown term ${t}`);
}
for (const g of groups) if (!labIds.has(g.labId)) errors.push(`group ${g.id}: unknown lab ${g.labId}`);

if (errors.length) {
  console.error(`content: ${errors.length} error(s)`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

mkdirSync(dirname(outFile), { recursive: true });
const content = { version: 1, labs: labs.sort((a, b) => a.order - b.order), groups, terms, images, questions };
writeFileSync(outFile, JSON.stringify(content));
console.log(`content: ${labs.length} labs, ${groups.length} groups, ${terms.length} terms, ${images.length} images, ${questions.length} questions → public/content.json`);
