import type { Indexes } from '../content/index';
import { deckImages, deckQuestions, deckTerms, selectedGroups, type Deck } from '../content/decks';
import type { Term } from '../content/types';
import { askable, mcItems, shortItems, stickerItems, studyItems } from './generate';
import type { Item, Mode } from './items';
import { today, weightFor, type ProgressState } from './progress';
import { seededRng, shuffle, weightedSample, type Rng } from './rng';

export interface SessionSpec {
  deck: Deck;
  mode: Mode;
  groupIds?: string[];
  count: number;
  seed?: number;
  dueOnly?: boolean;
}

export function progressIds(item: Item): string[] {
  switch (item.kind) {
    case 'sticker':
    case 'recall':
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

export function isDue(progress: ProgressState, termId: string, day = today()): boolean {
  const t = progress.terms[termId];
  return !!t && t.due <= day;
}

export function dueTerms(idx: Indexes, progress: ProgressState): Term[] {
  return idx.content.terms.filter((t) => isDue(progress, t.id) && askable(idx, t));
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

function practicalItems(idx: Indexes, spec: SessionSpec, rng: Rng): Item[] {
  const groups = selectedGroups(idx, spec.deck, spec.groupIds);
  const terms = deckTerms(idx, groups);
  const termIds = new Set(terms.map((t) => t.id));
  const images = deckImages(idx, groups);
  const questions = deckQuestions(idx, spec.deck, groups);
  const stickers = dedupeByTerm(shuffle(stickerItems(images, termIds), rng));
  const shorts = shuffle(shortItems(questions), rng);
  const nShort = Math.min(shorts.length, Math.round(spec.count * 0.15));
  const nSticker = Math.min(stickers.length, spec.count - nShort);
  const picked = [...stickers.slice(0, nSticker), ...shorts.slice(0, nShort)];
  if (picked.length < spec.count) {
    const mc = shuffle(mcItems(idx, terms, images, questions, rng), rng).filter((i) => i.kind === 'mc' && !i.imageId);
    picked.push(...mc.slice(0, spec.count - picked.length));
  }
  return shuffle(picked, rng);
}

export function buildSession(idx: Indexes, progress: ProgressState, spec: SessionSpec): Item[] {
  const rng = seededRng(spec.seed ?? Date.now());
  const groups = selectedGroups(idx, spec.deck, spec.groupIds);
  switch (spec.mode) {
    case 'practical':
      return practicalItems(idx, spec, rng);
    case 'short': {
      const pool = shortItems(deckQuestions(idx, spec.deck, groups));
      return weightedSample(pool, (i) => itemWeight(i, progress), Math.min(spec.count, pool.length), rng);
    }
    case 'study': {
      let terms = deckTerms(idx, groups);
      if (spec.dueOnly) {
        const due = terms.filter((t) => isDue(progress, t.id));
        if (due.length) terms = due;
      }
      return studyItems(idx, progress, terms, deckQuestions(idx, spec.deck, groups), spec.count, rng);
    }
  }
}

export function poolSize(idx: Indexes, spec: SessionSpec): number {
  const groups = selectedGroups(idx, spec.deck, spec.groupIds);
  switch (spec.mode) {
    case 'study':
      return deckTerms(idx, groups).filter((t) => askable(idx, t)).length;
    case 'short':
      return shortItems(deckQuestions(idx, spec.deck, groups)).length;
    case 'practical': {
      const termIds = new Set(deckTerms(idx, groups).map((t) => t.id));
      return dedupeByTerm(stickerItems(deckImages(idx, groups), termIds)).length + shortItems(deckQuestions(idx, spec.deck, groups)).length;
    }
  }
}
