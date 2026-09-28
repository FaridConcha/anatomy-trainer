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
  toured?: string[];
  examDate?: string;
  lastExport?: number;
}

export interface ProgressState {
  version: 1;
  terms: Record<string, TermProgress>;
  confusions: Record<string, Record<string, number>>;
  confidentMisses: Record<string, number>;
  sessions: SessionSummary[];
  settings: Settings;
}

export const defaultSettings: Settings = {
  strict: false,
  zoomDefault: true,
  practicalSeconds: 45,
  practicalCount: 100,
  sessionCount: 15,
  groupSel: {},
};

export function defaultProgress(): ProgressState {
  return { version: 1, terms: {}, confusions: {}, confidentMisses: {}, sessions: [], settings: { ...defaultSettings } };
}

export function today(): number {
  return Math.floor(Date.now() / 86400000);
}

const intervals = [0, 1, 3, 7, 14];

export function recordAnswer(state: ProgressState, id: string, ok: boolean, kind: ItemKind, spelling = false, confident = true): ProgressState {
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
  let confidentMisses = state.confidentMisses;
  if (!ok && confident) confidentMisses = { ...confidentMisses, [id]: (confidentMisses[id] ?? 0) + 1 };
  else if (ok && confidentMisses[id]) {
    confidentMisses = { ...confidentMisses };
    delete confidentMisses[id];
  }
  return { ...state, terms: { ...state.terms, [id]: next }, confidentMisses };
}

export function daysToExam(settings: Settings, now = Date.now()): number | null {
  if (!settings.examDate) return null;
  const exam = new Date(settings.examDate + 'T23:59:59').getTime();
  return Math.ceil((exam - now) / 86400000);
}

// Sampling weight for study: base Leitner weight, confident misses first, and an exam-week ramp that
// stops introducing new material three days out.
export function studyWeight(state: ProgressState, termId: string, day = today()): number {
  const t = state.terms[termId];
  let w = weightFor(t, day);
  if (state.confidentMisses[termId]) w *= 4;
  const d = daysToExam(state.settings);
  if (d !== null && d <= 7) {
    if (!t) w = d <= 3 ? 0 : w * 0.3;
    else if (t.due <= day || t.box <= 2) w *= 2;
  }
  return w;
}

export function weightFor(t: TermProgress | undefined, day = today()): number {
  if (!t) return 6;
  const base = [8, 4, 2, 1, 0.5][t.box - 1];
  return t.due <= day ? base * 2 : base;
}

export function mastered(t: TermProgress | undefined): boolean {
  return !!t && t.box >= 4;
}

// The student answered `otherId` when `termId` was asked.
export function recordConfusion(state: ProgressState, termId: string, otherId: string): ProgressState {
  const row = { ...(state.confusions[termId] ?? {}) };
  row[otherId] = (row[otherId] ?? 0) + 1;
  return { ...state, confusions: { ...state.confusions, [termId]: row } };
}

export function topConfusions(state: ProgressState, limit = 6): { termId: string; otherId: string; n: number }[] {
  const out: { termId: string; otherId: string; n: number }[] = [];
  for (const [termId, row] of Object.entries(state.confusions)) for (const [otherId, n] of Object.entries(row)) out.push({ termId, otherId, n });
  return out.sort((a, b) => b.n - a.n).slice(0, limit);
}

export function markToured(state: ProgressState, groupId: string): ProgressState {
  const toured = Array.from(new Set([...(state.settings.toured ?? []), groupId]));
  return { ...state, settings: { ...state.settings, toured } };
}

export function addSession(state: ProgressState, s: SessionSummary): ProgressState {
  return { ...state, sessions: [s, ...state.sessions].slice(0, 50) };
}
