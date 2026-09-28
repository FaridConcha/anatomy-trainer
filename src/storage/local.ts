import { useSyncExternalStore } from 'react';
import { defaultProgress, defaultSettings, type ProgressState } from '../engine/progress';

const KEY = 'apx.progress.v1';

function load(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as ProgressState;
    const settings = { ...defaultSettings, ...(parsed.settings ?? {}) };
    if (settings.practicalCount === 20) settings.practicalCount = defaultSettings.practicalCount;
    return { ...defaultProgress(), ...parsed, confusions: parsed.confusions ?? {}, confidentMisses: parsed.confidentMisses ?? {}, settings };
  } catch {
    return defaultProgress();
  }
}

let state: ProgressState = load();
const listeners = new Set<() => void>();

export const progressStore = {
  get: () => state,
  set(next: ProgressState) {
    state = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable; keep in memory */
    }
    listeners.forEach((l) => l());
  },
  update(fn: (s: ProgressState) => ProgressState) {
    progressStore.set(fn(state));
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useProgress(): ProgressState {
  return useSyncExternalStore(progressStore.subscribe, progressStore.get);
}

export function requestPersistence() {
  try {
    navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    /* ignore */
  }
}
