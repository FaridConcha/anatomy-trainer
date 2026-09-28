import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIndexes } from '../content/index';
import { allDecks } from '../content/decks';
import type { Content } from '../content/types';
import { distractorsFor, studyItems } from './generate';
import type { Mode } from './items';
import { defaultProgress, recordAnswer, today, type ProgressState } from './progress';
import { seededRng } from './rng';
import { buildSession, dueTerms, poolSize } from './session';

const content = JSON.parse(readFileSync(new URL('../../public/content.json', import.meta.url), 'utf8')) as Content;
const idx = buildIndexes(content);
const fresh = defaultProgress();
const modes: Mode[] = ['study', 'practical'];
const deck = (id: string) => allDecks(idx).find((d) => d.id === id)!;

function known(ids: string[], times = 2): ProgressState {
  let p = defaultProgress();
  for (const id of ids) for (let i = 0; i < times; i++) p = recordAnswer(p, id, true, 'mc');
  return p;
}

describe('content', () => {
  it('has every hotspot pointing at a known term', () => {
    for (const img of content.images) for (const h of img.hotspots) expect(idx.termsById.has(h.termId), `${img.id} → ${h.termId}`).toBe(true);
  });
  it('gives every deck a non-empty study pool, and practical pools where images exist', () => {
    for (const d of allDecks(idx)) {
      expect(poolSize(idx, { deck: d, mode: 'study', count: 0 }), `${d.id} study`).toBeGreaterThan(0);
      if (d.id !== 'lab1') expect(poolSize(idx, { deck: d, mode: 'practical', count: 0 }), `${d.id} practical`).toBeGreaterThan(0);
    }
  });
});

describe('buildSession', () => {
  it('fills every lab and mode to the requested size', () => {
    for (const d of allDecks(idx)) {
      for (const mode of modes) {
        const size = poolSize(idx, { deck: d, mode, count: 0 });
        if (!size) continue;
        const items = buildSession(idx, fresh, { deck: d, mode, count: 12, seed: 7 });
        expect(items.length, `${d.id} ${mode}`).toBeGreaterThanOrEqual(Math.min(10, size));
        expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
      }
    }
  });
  it('asks fresh terms by recognition only and mixes in written stations', () => {
    const items = buildSession(idx, fresh, { deck: deck('lab5'), mode: 'study', count: 30, seed: 3 });
    expect(items.every((i) => i.kind === 'mc' || i.kind === 'short')).toBe(true);
    expect(items.some((i) => i.kind === 'mc' && i.imageId)).toBe(true);
    expect(items.filter((i) => i.kind === 'short').length).toBeGreaterThanOrEqual(3);
    expect(items.filter((i) => i.kind === 'short').length).toBeLessThanOrEqual(5);
  });
  it('switches a term to recall once it is known', () => {
    const humerus = idx.termsByGroup.get('humerus')!.map((t) => t.id);
    const p = known(humerus);
    const items = studyItems(idx, p, idx.termsByGroup.get('humerus')!, [], 40, seededRng(1));
    const kinds = new Set(items.map((i) => i.kind));
    expect(kinds.has('sticker') || kinds.has('match')).toBe(true);
    expect(items.some((i) => i.kind === 'mc' && i.termId)).toBe(false);
  });
  it('uses typed recall from a fact prompt when a known term has no image', () => {
    const foramina = idx.termsByGroup.get('skull.foramina')!.filter((t) => !(idx.imagesByTerm.get(t.id)?.length));
    const spine = idx.termsByGroup.get('vertebrae.features')!;
    const p = known([...foramina, ...spine].map((t) => t.id));
    const items = studyItems(idx, p, spine, [], 20, seededRng(2));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.kind === 'recall')).toBe(true);
    expect(items[0].kind === 'recall' && items[0].prompt.length).toBeTruthy();
  });
  it('always types word forms and spelling traps', () => {
    const terms = [...idx.termsByGroup.get('lab1.plurals')!, ...idx.termsByGroup.get('lab1.spelling')!];
    const items = studyItems(idx, fresh, terms, [], 20, seededRng(4));
    expect(items.every((i) => i.kind === 'wordform')).toBe(true);
  });
  it('folds several known stickers on one image into a match round', () => {
    const skull = idx.termsByGroup.get('skull.bones')!;
    const p = known(skull.map((t) => t.id));
    const items = studyItems(idx, p, skull, [], 14, seededRng(5));
    const match = items.filter((i) => i.kind === 'match');
    expect(match.length).toBeGreaterThan(0);
    for (const m of match) if (m.kind === 'match') expect(m.hotspotIndexes.length).toBeGreaterThanOrEqual(4);
  });
  it('restricts a due-only session to due terms', () => {
    let p = recordAnswer(fresh, 'humerus.capitulum', false, 'sticker');
    p = recordAnswer(p, 'humerus.trochlea', false, 'sticker');
    expect(dueTerms(idx, p).map((t) => t.id).sort()).toEqual(['humerus.capitulum', 'humerus.trochlea']);
    const items = buildSession(idx, p, { deck: deck('exam1'), mode: 'study', count: 10, seed: 6, dueOnly: true });
    const termItems = items.filter((i) => i.kind !== 'short' && (i.kind !== 'mc' || i.termId));
    for (const i of termItems) expect(['humerus.capitulum', 'humerus.trochlea']).toContain((i as { termId: string }).termId);
    expect(p.terms['humerus.capitulum'].due).toBe(today());
  });
  it('mixes short-answer stations into a practical', () => {
    const items = buildSession(idx, fresh, { deck: deck('exam1'), mode: 'practical', count: 20, seed: 11 });
    expect(items.length).toBe(20);
    expect(items.some((i) => i.kind === 'short')).toBe(true);
    expect(items.filter((i) => i.kind === 'sticker').length).toBeGreaterThan(10);
  });
});

describe('distractorsFor', () => {
  it('draws from the same group first and never returns the target', () => {
    const term = idx.termsById.get('humerus.capitulum')!;
    const ds = distractorsFor(idx, term, 3, seededRng(1));
    expect(ds.length).toBe(3);
    for (const d of ds) {
      expect(d.groupId).toBe('humerus');
      expect(d.id).not.toBe(term.id);
    }
  });
  it('uses the shared pool for tissues so an epithelium is not offered against cartilage', () => {
    const term = idx.termsById.get('tissue.connective.cartilage.fibrocartilage')!;
    for (const d of distractorsFor(idx, term, 3, seededRng(2))) expect(idx.groupsById.get(d.groupId)!.distractorPool).toBe('connective');
  });
  it('widens to the region when a group is tiny', () => {
    const term = idx.termsById.get('fibula.apex')!;
    expect(distractorsFor(idx, term, 3, seededRng(3)).length).toBe(3);
  });
});
