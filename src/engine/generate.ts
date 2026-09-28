import type { Indexes } from '../content/index';
import type { Group, Image, Question, Term, TermFacts } from '../content/types';
import type { Item } from './items';
import { studyWeight, type ProgressState } from './progress';
import { shuffle, weightedSample, type Rng } from './rng';

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

function options(idx: Indexes, term: Term, rng: Rng): { options: string[]; optionTermIds: string[]; answerIndex: number } | null {
  const ds = distractorsFor(idx, term, 3, rng);
  if (ds.length < 2) return null;
  const ts = shuffle([term, ...ds], rng);
  return { options: ts.map((t) => t.name), optionTermIds: ts.map((t) => t.id), answerIndex: ts.indexOf(term) };
}

type FactKey = 'transmits' | 'location' | 'definition';
const factOrder: FactKey[] = ['transmits', 'location', 'definition'];

function factPrompt(key: FactKey, f: TermFacts): string {
  if (key === 'transmits') return `Which opening transmits: ${f.transmits}?`;
  if (key === 'location') return `Which tissue or structure is found in: ${f.location}?`;
  return `Which term matches: “${f.definition}”`;
}

function askableFacts(term: Term, group: Group): FactKey[] {
  if (group.kind === 'spelling' || group.kind === 'wordform') return [];
  return factOrder.filter((k) => term.facts?.[k]);
}

export function mcForImage(idx: Indexes, img: Image, hotspotIndex: number, rng: Rng): Item | null {
  const h = img.hotspots[hotspotIndex];
  const term = idx.termsById.get(h.termId)!;
  const o = options(idx, term, rng);
  if (!o) return null;
  const prompt = h.prompt ?? (h.shape.kind === 'whole' ? 'What tissue is this?' : 'The sticker marks the…');
  return { kind: 'mc', id: `mc:img:${img.id}:${hotspotIndex}`, termId: term.id, progressId: term.id, prompt, imageId: img.id, hotspotIndex, ...o };
}

export function mcForFact(idx: Indexes, term: Term, key: FactKey, rng: Rng): Item | null {
  const o = options(idx, term, rng);
  if (!o) return null;
  return { kind: 'mc', id: `mc:fact:${term.id}:${key}`, termId: term.id, progressId: term.id, prompt: factPrompt(key, term.facts!), ...o };
}

export function recallForFact(idx: Indexes, term: Term, key: FactKey): Item {
  const g = idx.groupsById.get(term.groupId)!;
  return { kind: 'recall', id: `recall:${term.id}:${key}`, termId: term.id, prompt: factPrompt(key, term.facts!), label: g.title };
}

export function wordformFor(idx: Indexes, term: Term): Item | null {
  const g = idx.groupsById.get(term.groupId)!;
  if (g.kind === 'wordform' && term.facts?.plural) return { kind: 'wordform', id: `wf:${term.id}`, termId: term.id, prompt: `Plural of ${term.name}`, answer: term.facts.plural, alts: term.facts.plurals, note: term.facts.note };
  if (g.kind === 'spelling' && term.facts?.definition) return { kind: 'wordform', id: `sp:${term.id}`, termId: term.id, prompt: `Spell the term: ${term.facts.definition}`, answer: term.name, alts: term.aliases, note: term.facts.note };
  return null;
}

export function stickerItems(images: Image[], termIds: Set<string>): Item[] {
  return images.flatMap((img) =>
    img.hotspots.flatMap((h, i) => (termIds.has(h.termId) ? [{ kind: 'sticker' as const, id: `sticker:${img.id}:${i}`, termId: h.termId, imageId: img.id, hotspotIndex: i }] : [])),
  );
}

export function mcItems(idx: Indexes, terms: Term[], images: Image[], questions: Question[], rng: Rng): Item[] {
  const out: Item[] = [];
  const termIds = new Set(terms.map((t) => t.id));
  for (const img of images) img.hotspots.forEach((h, i) => { if (termIds.has(h.termId)) { const it = mcForImage(idx, img, i, rng); if (it) out.push(it); } });
  for (const term of terms) for (const key of askableFacts(term, idx.groupsById.get(term.groupId)!)) { const it = mcForFact(idx, term, key, rng); if (it) out.push(it); }
  out.push(...bankMcItems(questions));
  return out;
}

export function bankMcItems(questions: Question[]): Item[] {
  return questions.flatMap((q) => (q.kind === 'mc' && q.options && q.answerIndex !== undefined ? [{ kind: 'mc' as const, id: `mc:q:${q.id}`, questionId: q.id, progressId: q.id, prompt: q.prompt, options: q.options, answerIndex: q.answerIndex }] : []));
}

export function shortItems(questions: Question[]): Item[] {
  return questions.filter((q) => q.kind === 'short' && q.modelAnswer).map((q) => ({ kind: 'short' as const, id: `short:${q.id}`, questionId: q.id, prompt: q.prompt, modelAnswer: q.modelAnswer!, termIds: q.termIds ?? [] }));
}

export function askable(idx: Indexes, term: Term): boolean {
  const g = idx.groupsById.get(term.groupId)!;
  if (g.kind === 'wordform' || g.kind === 'spelling') return !!wordformFor(idx, term);
  return (idx.imagesByTerm.get(term.id)?.length ?? 0) > 0 || askableFacts(term, g).length > 0;
}

// One item per sampled term, chosen by how well the term is known: recognition first, recall once it sticks.
export function studyItems(idx: Indexes, progress: ProgressState, terms: Term[], questions: Question[], count: number, rng: Rng, opts: { typedOnly?: boolean } = {}): Item[] {
  const shorts = shortItems(questions);
  const shortWeight = (i: Item) => (i.kind === 'short' ? (i.termIds.length ? i.termIds : [i.questionId]).reduce((s, id) => s + studyWeight(progress, id), 0) / Math.max(1, i.termIds.length) : 0);
  const pickedShorts = weightedSample(shorts, shortWeight, Math.min(shorts.length, Math.round(count * 0.15)), rng);
  const pool = terms.filter((t) => askable(idx, t));
  const sampled = weightedSample(pool, (t) => studyWeight(progress, t.id), count - pickedShorts.length, rng);
  // interleave neighbours: a term the student confuses with a sampled one comes along in the same session
  const poolIds = new Set(pool.map((t) => t.id));
  const sampledIds = new Set(sampled.map((t) => t.id));
  for (const t of sampled.slice()) {
    const row = progress.confusions[t.id];
    if (!row) continue;
    const partner = Object.entries(row).sort((a, b) => b[1] - a[1]).map(([id]) => id).find((id) => poolIds.has(id) && !sampledIds.has(id));
    if (!partner) continue;
    sampledIds.add(partner);
    sampled.push(idx.termsById.get(partner)!);
    if (sampled.length > count - pickedShorts.length) {
      const drop = sampled.findIndex((s) => !progress.confusions[s.id] && !Object.values(progress.confusions).some((r) => r[s.id]));
      if (drop >= 0) { sampledIds.delete(sampled[drop].id); sampled.splice(drop, 1); }
    }
  }
  const items: Item[] = [];
  const stickerByImage = new Map<string, { hotspotIndex: number; termId: string }[]>();
  for (const term of sampled) {
    const box = opts.typedOnly ? 2 : progress.terms[term.id]?.box ?? 1;
    const g = idx.groupsById.get(term.groupId)!;
    const wf = wordformFor(idx, term);
    if (wf) { items.push(wf); continue; }
    const refs = idx.imagesByTerm.get(term.id) ?? [];
    if (refs.length) {
      const ref = refs.find((r) => stickerByImage.has(r.image.id)) ?? refs[(progress.terms[term.id]?.seen ?? 0) % refs.length];
      if (box <= 1) {
        const it = mcForImage(idx, ref.image, ref.hotspotIndex, rng);
        if (it) items.push(it);
      } else {
        items.push({ kind: 'sticker', id: `sticker:${ref.image.id}:${ref.hotspotIndex}`, termId: term.id, imageId: ref.image.id, hotspotIndex: ref.hotspotIndex });
        if (ref.image.hotspots[ref.hotspotIndex].shape.kind !== 'whole') {
          const arr = stickerByImage.get(ref.image.id) ?? [];
          arr.push({ hotspotIndex: ref.hotspotIndex, termId: term.id });
          stickerByImage.set(ref.image.id, arr);
        }
      }
      continue;
    }
    const keys = askableFacts(term, g);
    if (!keys.length) continue;
    const key = keys[(progress.terms[term.id]?.seen ?? 0) % keys.length];
    if (box <= 1) {
      const it = mcForFact(idx, term, key, rng);
      if (it) items.push(it);
    } else items.push(recallForFact(idx, term, key));
  }
  // consolidation round: several known terms on one image become a single match item
  let out = items;
  for (const [imageId, hs] of stickerByImage) {
    const distinct = Array.from(new Map(hs.map((h) => [h.termId, h.hotspotIndex])).values());
    if (distinct.length < 4) continue;
    out = out.filter((i) => !(i.kind === 'sticker' && i.imageId === imageId && distinct.includes(i.hotspotIndex)));
    out.push({ kind: 'match', id: `match:${imageId}`, imageId, hotspotIndexes: distinct.slice(0, 6) });
  }
  const bank = shuffle(bankMcItems(questions), rng).slice(0, Math.max(0, Math.round(count * 0.1)));
  return separateNeighbours(shuffle([...out, ...bank, ...pickedShorts], rng), progress);
}

const termOf = (i?: Item): string | undefined => (!i ? undefined : i.kind === 'sticker' || i.kind === 'recall' || i.kind === 'wordform' ? i.termId : i.kind === 'mc' ? i.termId : undefined);

// Confused pairs must not sit next to each other, or the second is answered by elimination.
export function separateNeighbours(items: Item[], progress: ProgressState): Item[] {
  const out = items.slice();
  const confused = (a?: string, b?: string) => !!a && !!b && (!!progress.confusions[a]?.[b] || !!progress.confusions[b]?.[a]);
  for (let i = 1; i < out.length; i++) {
    if (!confused(termOf(out[i - 1]), termOf(out[i]))) continue;
    const j = out.findIndex((it, k) => k > i && !confused(termOf(out[i - 1]), termOf(it)) && !confused(termOf(it), termOf(out[k + 1])));
    if (j > i) [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
