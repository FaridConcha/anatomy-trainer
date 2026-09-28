import type { Content, Group, Image, Lab, Question, Term } from './types';

export interface ImageRef {
  image: Image;
  hotspotIndex: number;
}

export interface Indexes {
  content: Content;
  labsById: Map<string, Lab>;
  groupsById: Map<string, Group>;
  termsById: Map<string, Term>;
  termsByGroup: Map<string, Term[]>;
  groupsByLab: Map<string, Group[]>;
  imagesById: Map<string, Image>;
  imagesByTerm: Map<string, ImageRef[]>;
  imagesByGroup: Map<string, Image[]>;
  questionsByLab: Map<string, Question[]>;
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

export function buildIndexes(content: Content): Indexes {
  const idx: Indexes = {
    content,
    labsById: new Map(content.labs.map((l) => [l.id, l])),
    groupsById: new Map(content.groups.map((g) => [g.id, g])),
    termsById: new Map(content.terms.map((t) => [t.id, t])),
    termsByGroup: new Map(),
    groupsByLab: new Map(),
    imagesById: new Map(content.images.map((i) => [i.id, i])),
    imagesByTerm: new Map(),
    imagesByGroup: new Map(),
    questionsByLab: new Map(),
  };
  for (const t of content.terms) push(idx.termsByGroup, t.groupId, t);
  for (const g of content.groups) push(idx.groupsByLab, g.labId, g);
  for (const img of content.images) {
    for (const g of img.groupIds) push(idx.imagesByGroup, g, img);
    img.hotspots.forEach((h, i) => push(idx.imagesByTerm, h.termId, { image: img, hotspotIndex: i }));
  }
  for (const q of content.questions) push(idx.questionsByLab, q.labId, q);
  return idx;
}

export function groupOf(idx: Indexes, term: Term): Group {
  return idx.groupsById.get(term.groupId)!;
}

export function siblingsOf(idx: Indexes, term: Term): Term[] {
  return idx.termsByGroup.get(term.groupId) ?? [term];
}

export function withImages(content: Content, extra: Image[]): Content {
  const ids = new Set(extra.map((i) => i.id));
  return { ...content, images: [...content.images.filter((i) => !ids.has(i.id)), ...extra] };
}
