import type { Indexes } from '../content/index';
import type { Group, Image, Question, Term } from '../content/types';
import type { Item } from './items';
import { shuffle, type Rng } from './rng';

export function distractorsFor(idx: Indexes, term: Term, n: number, rng: Rng): Term[] {
  const group = idx.groupsById.get(term.groupId)!;
  const exclude = new Set([term.id]);
  const names = new Set([term.name, ...(term.aliases ?? [])].map((s) => s.toLowerCase()));
  const chosen: Term[] = [];
  const take = (cands: Term[]) => {
    for (const c of shuffle(cands, rng)) {
      if (chosen.length >= n) return;
      if (exclude.has(c.id) || names.has(c.name.toLowerCase())) continue;
      exclude.add(c.id);
      names.add(c.name.toLowerCase());
      chosen.push(c);
    }
  };
  const pooled = group.distractorPool
    ? idx.content.groups.filter((g) => g.distractorPool === group.distractorPool).flatMap((g) => idx.termsByGroup.get(g.id) ?? [])
    : idx.termsByGroup.get(group.id) ?? [];
  take(pooled);
  if (chosen.length < n) take(idx.content.groups.filter((g) => g.region === group.region && g.kind === group.kind).flatMap((g) => idx.termsByGroup.get(g.id) ?? []));
  if (chosen.length < n) take(idx.content.groups.filter((g) => g.labId === group.labId).flatMap((g) => idx.termsByGroup.get(g.id) ?? []));
  return chosen;
}

export function stickerItems(images: Image[], termIds: Set<string>): Item[] {
  return images.flatMap((img) =>
    img.hotspots.flatMap((h, i) => (termIds.has(h.termId) ? [{ kind: 'sticker' as const, id: `sticker:${img.id}:${i}`, termId: h.termId, imageId: img.id, hotspotIndex: i }] : [])),
  );
}

export function matchItems(images: Image[], termIds: Set<string>, rng: Rng): Item[] {
  return images.flatMap((img) => {
    const usable = img.hotspots.map((h, i) => ({ h, i })).filter(({ h }) => termIds.has(h.termId) && h.shape.kind !== 'whole');
    const distinct = new Map<string, number>();
    for (const { h, i } of shuffle(usable, rng)) if (!distinct.has(h.termId)) distinct.set(h.termId, i);
    if (distinct.size < 3) return [];
    const picked = Array.from(distinct.values()).slice(0, 6);
    return [{ kind: 'match' as const, id: `match:${img.id}`, imageId: img.id, hotspotIndexes: picked }];
  });
}

function options(idx: Indexes, term: Term, rng: Rng): { options: string[]; answerIndex: number } | null {
  const ds = distractorsFor(idx, term, 3, rng);
  if (ds.length < 2) return null;
  const opts = shuffle([term, ...ds].map((t) => t.name), rng);
  return { options: opts, answerIndex: opts.indexOf(term.name) };
}

export function mcItems(idx: Indexes, terms: Term[], images: Image[], questions: Question[], rng: Rng): Item[] {
  const out: Item[] = [];
  const termIds = new Set(terms.map((t) => t.id));
  for (const img of images) {
    img.hotspots.forEach((h, i) => {
      if (!termIds.has(h.termId)) return;
      const term = idx.termsById.get(h.termId)!;
      const o = options(idx, term, rng);
      if (!o) return;
      const prompt = h.shape.kind === 'whole' ? 'What tissue is this?' : 'The sticker marks the…';
      out.push({ kind: 'mc', id: `mc:img:${img.id}:${i}`, termId: term.id, progressId: term.id, prompt, imageId: img.id, hotspotIndex: i, ...o });
    });
  }
  for (const term of terms) {
    const f = term.facts ?? {};
    const g = idx.groupsById.get(term.groupId)!;
    const prompts: [string, string][] = [];
    if (f.definition && g.kind !== 'spelling') prompts.push(['definition', `Which term matches: “${f.definition}”`]);
    if (f.location) prompts.push(['location', `Which tissue is found in: ${f.location}?`]);
    if (f.transmits) prompts.push(['transmits', `Which opening transmits: ${f.transmits}?`]);
    if (f.note && g.kind === 'spelling') prompts.push(['spelling', `${f.definition}. Which spelling is correct?`]);
    for (const [key, prompt] of prompts) {
      const o = options(idx, term, rng);
      if (o) out.push({ kind: 'mc', id: `mc:fact:${term.id}:${key}`, termId: term.id, progressId: term.id, prompt, ...o });
    }
  }
  for (const q of questions) {
    if (q.kind !== 'mc' || !q.options || q.answerIndex === undefined) continue;
    out.push({ kind: 'mc', id: `mc:q:${q.id}`, questionId: q.id, progressId: q.id, prompt: q.prompt, options: q.options, answerIndex: q.answerIndex });
  }
  return out;
}

export function flashItems(idx: Indexes, terms: Term[]): Item[] {
  const out: Item[] = [];
  for (const t of terms) {
    const f = t.facts ?? {};
    const g = idx.groupsById.get(t.groupId)!;
    const cat = f.category ? ` · ${f.category}` : '';
    if (f.definition) out.push({ kind: 'flash', id: `flash:${t.id}:def`, termId: t.id, front: t.name, back: f.definition, label: `${g.title}${cat}` });
    if (f.location) out.push({ kind: 'flash', id: `flash:${t.id}:loc`, termId: t.id, front: t.name, back: f.location, label: 'where in the body' });
    if (f.transmits) out.push({ kind: 'flash', id: `flash:${t.id}:tx`, termId: t.id, front: t.name, back: f.transmits, label: `passes through · ${f.category ?? ''}` });
    if (f.plural) out.push({ kind: 'flash', id: `flash:${t.id}:pl`, termId: t.id, front: t.name, back: `${f.plural}${f.note ? ` (${f.note})` : ''}`, label: 'plural' });
  }
  return out;
}

export function shortItems(questions: Question[]): Item[] {
  return questions.filter((q) => q.kind === 'short' && q.modelAnswer).map((q) => ({ kind: 'short' as const, id: `short:${q.id}`, questionId: q.id, prompt: q.prompt, modelAnswer: q.modelAnswer!, termIds: q.termIds ?? [] }));
}

export function wordformItems(idx: Indexes, terms: Term[]): Item[] {
  const out: Item[] = [];
  for (const t of terms) {
    const g = idx.groupsById.get(t.groupId)!;
    if (g.kind === 'wordform' && t.facts?.plural) out.push({ kind: 'wordform', id: `wf:${t.id}`, termId: t.id, prompt: `Plural of ${t.name}`, answer: t.facts.plural, note: t.facts.note });
    if (g.kind === 'spelling' && t.facts?.definition) out.push({ kind: 'wordform', id: `sp:${t.id}`, termId: t.id, prompt: `Spell the term: ${t.facts.definition}`, answer: t.name, note: t.facts.note });
  }
  return out;
}

export function groupsWithImages(idx: Indexes, groups: Group[]): Set<string> {
  return new Set(groups.filter((g) => (idx.imagesByGroup.get(g.id) ?? []).length > 0).map((g) => g.id));
}
