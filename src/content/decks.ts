import type { Indexes } from './index';
import type { Group, Image, Question, Term } from './types';

export interface Deck {
  id: string;
  title: string;
  blurb: string;
  labIds: string[];
}

export function allDecks(idx: Indexes): Deck[] {
  const labs = idx.content.labs.map((l) => ({ id: l.id, title: `Lab ${l.order} · ${l.title}`, blurb: l.blurb, labIds: [l.id] }));
  return [...labs, { id: 'exam1', title: 'Exam 1 practical', blurb: 'all five labs, weighted by size', labIds: idx.content.labs.map((l) => l.id) }];
}

export function deckById(idx: Indexes, id: string): Deck | undefined {
  return allDecks(idx).find((d) => d.id === id);
}

export function deckGroups(idx: Indexes, deck: Deck): Group[] {
  return deck.labIds.flatMap((l) => idx.groupsByLab.get(l) ?? []);
}

export function selectedGroups(idx: Indexes, deck: Deck, sel: string[] | undefined): Group[] {
  const all = deckGroups(idx, deck);
  if (!sel || !sel.length) return all;
  const s = new Set(sel);
  const chosen = all.filter((g) => s.has(g.id));
  return chosen.length ? chosen : all;
}

export function deckTerms(idx: Indexes, groups: Group[]): Term[] {
  return groups.flatMap((g) => idx.termsByGroup.get(g.id) ?? []);
}

export function deckImages(idx: Indexes, groups: Group[]): Image[] {
  const seen = new Set<string>();
  const out: Image[] = [];
  for (const g of groups) for (const img of idx.imagesByGroup.get(g.id) ?? []) if (!seen.has(img.id)) { seen.add(img.id); out.push(img); }
  return out;
}

export function deckQuestions(idx: Indexes, deck: Deck, groups: Group[]): Question[] {
  const gids = new Set(groups.map((g) => g.id));
  return deck.labIds.flatMap((l) => idx.questionsByLab.get(l) ?? []).filter((q) => !q.groupId || gids.has(q.groupId));
}
