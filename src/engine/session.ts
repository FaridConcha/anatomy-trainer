import type { Indexes } from '../content/index';
import { deckImages, deckQuestions, deckTerms, selectedGroups, type Deck } from '../content/decks';
import { flashItems, matchItems, mcItems, shortItems, stickerItems, wordformItems } from './generate';
import type { Item, Mode } from './items';
import { weightFor, type ProgressState } from './progress';
import { seededRng, shuffle, weightedSample, type Rng } from './rng';

export interface SessionSpec {
  deck: Deck;
  mode: Mode;
  groupIds?: string[];
  count: number;
  seed?: number;
}

function progressIds(item: Item): string[] {
  switch (item.kind) {
    case 'sticker':
    case 'flash':
    case 'wordform':
      return [item.termId];
    case 'mc':
      return [item.progressId];
    case 'short':
      return item.termIds.length ? item.termIds : [item.questionId];
    case 'match':
      return [];
  }
}

export function itemWeight(item: Item, progress: ProgressState): number {
  const ids = progressIds(item);
  if (!ids.length) return 3;
  return ids.reduce((s, id) => s + weightFor(progress.terms[id]), 0) / ids.length;
}

function poolFor(idx: Indexes, spec: SessionSpec, mode: Mode, rng: Rng): Item[] {
  const groups = selectedGroups(idx, spec.deck, spec.groupIds);
  const terms = deckTerms(idx, groups);
  const termIds = new Set(terms.map((t) => t.id));
  const images = deckImages(idx, groups);
  const questions = deckQuestions(idx, spec.deck, groups);
  switch (mode) {
    case 'sticker':
      return stickerItems(images, termIds);
    case 'mc':
      return mcItems(idx, terms, images, questions, rng);
    case 'match':
      return matchItems(images, termIds, rng);
    case 'flash':
      return flashItems(idx, terms);
    case 'short':
      return shortItems(questions);
    case 'wordform':
      return wordformItems(idx, terms);
    case 'practical':
      return [];
  }
}

export function buildSession(idx: Indexes, progress: ProgressState, spec: SessionSpec): Item[] {
  const rng = seededRng(spec.seed ?? Date.now());
  if (spec.mode === 'practical') {
    const stickers = shuffle(poolFor(idx, spec, 'sticker', rng), rng);
    const shorts = shuffle(poolFor(idx, spec, 'short', rng), rng);
    const nShort = Math.min(shorts.length, Math.round(spec.count * 0.15));
    const nSticker = Math.min(stickers.length, spec.count - nShort);
    const picked = [...dedupeByTerm(stickers).slice(0, nSticker), ...shorts.slice(0, nShort)];
    if (picked.length < spec.count) {
      const mc = shuffle(poolFor(idx, spec, 'mc', rng), rng).filter((i) => i.kind === 'mc' && !i.imageId);
      picked.push(...mc.slice(0, spec.count - picked.length));
    }
    return shuffle(picked, rng);
  }
  const pool = poolFor(idx, spec, spec.mode, rng);
  const distinct = spec.mode === 'sticker' ? dedupeByTerm(shuffle(pool, rng)) : pool;
  return weightedSample(distinct, (i) => itemWeight(i, progress), Math.min(spec.count, distinct.length), rng);
}

function dedupeByTerm(items: Item[]): Item[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = i.kind === 'sticker' ? i.termId : i.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function poolSize(idx: Indexes, spec: SessionSpec): number {
  const rng = seededRng(1);
  if (spec.mode === 'practical') return dedupeByTerm(poolFor(idx, spec, 'sticker', rng)).length + poolFor(idx, spec, 'short', rng).length;
  const pool = poolFor(idx, spec, spec.mode, rng);
  return spec.mode === 'sticker' ? dedupeByTerm(pool).length : pool.length;
}

export { progressIds };
