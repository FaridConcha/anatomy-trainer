import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIndexes } from '../content/index';
import { allDecks, deckGroups } from '../content/decks';
import type { Content } from '../content/types';
import { distractorsFor } from './generate';
import type { Mode } from './items';
import { defaultProgress } from './progress';
import { seededRng } from './rng';
import { buildSession, poolSize } from './session';

const content = JSON.parse(readFileSync(new URL('../../public/content.json', import.meta.url), 'utf8')) as Content;
const idx = buildIndexes(content);
const progress = defaultProgress();
const modes: Mode[] = ['sticker', 'mc', 'match', 'flash', 'short', 'wordform', 'practical'];

describe('content', () => {
  it('has every hotspot pointing at a known term', () => {
    for (const img of content.images) for (const h of img.hotspots) expect(idx.termsById.has(h.termId), `${img.id} → ${h.termId}`).toBe(true);
  });
  it('gives every lab deck at least sticker, mc, flash and short items', () => {
    for (const deck of allDecks(idx)) {
      const sizes = Object.fromEntries(modes.map((m) => [m, poolSize(idx, { deck, mode: m, count: 0 })]));
      for (const m of ['mc', 'flash', 'short'] as Mode[]) expect(sizes[m], `${deck.id} ${m}`).toBeGreaterThan(0);
      if (deck.id !== 'lab1') expect(sizes.sticker, `${deck.id} sticker`).toBeGreaterThan(0);
    }
  });
});

describe('buildSession', () => {
  it('builds a session of the requested size for each lab and mode with content', () => {
    for (const deck of allDecks(idx)) {
      for (const mode of modes) {
        const size = poolSize(idx, { deck, mode, count: 0 });
        if (!size) continue;
        const items = buildSession(idx, progress, { deck, mode, count: 12, seed: 7 });
        expect(items.length, `${deck.id} ${mode}`).toBe(Math.min(12, mode === 'practical' ? items.length : size));
        expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
      }
    }
  });
  it('never repeats a term within a sticker session', () => {
    const deck = allDecks(idx).find((d) => d.id === 'lab5')!;
    const items = buildSession(idx, progress, { deck, mode: 'sticker', count: 40, seed: 3 });
    const terms = items.map((i) => (i.kind === 'sticker' ? i.termId : i.id));
    expect(new Set(terms).size).toBe(terms.length);
  });
  it('mixes short-answer stations into a practical', () => {
    const deck = allDecks(idx).find((d) => d.id === 'exam1')!;
    const items = buildSession(idx, progress, { deck, mode: 'practical', count: 20, seed: 11 });
    expect(items.length).toBe(20);
    expect(items.some((i) => i.kind === 'short')).toBe(true);
    expect(items.filter((i) => i.kind === 'sticker').length).toBeGreaterThan(10);
  });
});

describe('distractorsFor', () => {
  it('draws from the same group first and never returns the target or its aliases', () => {
    const term = idx.termsById.get('humerus.capitulum')!;
    const ds = distractorsFor(idx, term, 3, seededRng(1));
    expect(ds.length).toBe(3);
    for (const d of ds) {
      expect(d.groupId).toBe('humerus');
      expect(d.id).not.toBe(term.id);
    }
  });
  it('uses the shared pool for tissues so an epithelium is not offered against a muscle', () => {
    const term = idx.termsById.get('tissue.connective.cartilage.fibrocartilage')!;
    const ds = distractorsFor(idx, term, 3, seededRng(2));
    for (const d of ds) expect(idx.groupsById.get(d.groupId)!.distractorPool).toBe('connective');
  });
  it('widens to the region when a group is tiny', () => {
    const term = idx.termsById.get('fibula.apex')!;
    const ds = distractorsFor(idx, term, 3, seededRng(3));
    expect(ds.length).toBe(3);
    expect(deckGroups(idx, allDecks(idx)[4]).some((g) => g.id === 'tibia')).toBe(true);
  });
});
