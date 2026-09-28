import type { ItemKind } from './items';

export interface TermProgress {
  box: 1 | 2 | 3 | 4 | 5;
  due: number;
  seen: number;
  correct: number;
  streak: number;
  spellingMisses: number;
  byMode: Partial<Record<ItemKind, { seen: number; correct: number }>>;
  lastSeen: number;
}

export interface SessionSummary {
  at: number;
  deckId: string;
  mode: string;
  total: number;
  correct: number;
  missedIds: string[];
}

export interface Settings {
  strict: boolean;
  zoomDefault: boolean;
  practicalSeconds: number;
  practicalCount: number;
  sessionCount: number;
  groupSel: Record<string, string[]>;
  lastExport?: number;
}

export interface ProgressState {
  version: 1;
  terms: Record<string, TermProgress>;
  sessions: SessionSummary[];
  settings: Settings;
}

export const defaultSettings: Settings = {
  strict: false,
  zoomDefault: true,
  practicalSeconds: 45,
  practicalCount: 20,
  sessionCount: 15,
  groupSel: {},
};

export function defaultProgress(): ProgressState {
  return { version: 1, terms: {}, sessions: [], settings: { ...defaultSettings } };
}

export function today(): number {
  return Math.floor(Date.now() / 86400000);
}

const intervals = [0, 1, 3, 7, 14];

export function recordAnswer(state: ProgressState, id: string, ok: boolean, kind: ItemKind, spelling = false): ProgressState {
  const t = state.terms[id] ?? { box: 1, due: today(), seen: 0, correct: 0, streak: 0, spellingMisses: 0, byMode: {}, lastSeen: 0 };
  const next: TermProgress = { ...t, byMode: { ...t.byMode } };
  next.seen += 1;
  next.lastSeen = Date.now();
  const bm = next.byMode[kind] ?? { seen: 0, correct: 0 };
  next.byMode[kind] = { seen: bm.seen + 1, correct: bm.correct + (ok ? 1 : 0) };
  if (ok) {
    next.correct += 1;
    next.streak += 1;
    next.box = Math.min(5, next.box + 1) as TermProgress['box'];
    next.due = today() + intervals[next.box - 1];
    if (spelling) next.spellingMisses += 1;
  } else {
    next.streak = 0;
    next.box = 1;
    next.due = today();
  }
  return { ...state, terms: { ...state.terms, [id]: next } };
}

export function weightFor(t: TermProgress | undefined, day = today()): number {
  if (!t) return 6;
  const base = [8, 4, 2, 1, 0.5][t.box - 1];
  return t.due <= day ? base * 2 : base;
}

export function mastered(t: TermProgress | undefined): boolean {
  return !!t && t.box >= 4;
}

export function addSession(state: ProgressState, s: SessionSummary): ProgressState {
  return { ...state, sessions: [s, ...state.sessions].slice(0, 50) };
}
