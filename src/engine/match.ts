import type { Term } from '../content/types';

export type Verdict = 'correct' | 'close' | 'sibling' | 'wrong';

export interface Grade {
  verdict: Verdict;
  canonical: string;
  distance?: number;
  siblingName?: string;
  spelling?: boolean;
}

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|a|an) /, '')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

export function tolerance(len: number): number {
  if (len <= 4) return 0;
  if (len <= 8) return 1;
  if (len <= 14) return 2;
  return 3;
}

function forms(t: Term): string[] {
  const all = [t.name, ...(t.aliases ?? [])].map(normalize);
  const sorted = all.map((f) => f.split(' ').sort().join(' '));
  const joined = all.map((f) => f.replace(/ /g, ''));
  return Array.from(new Set([...all, ...sorted, ...joined]));
}

function bestDistance(n: string, fs: string[]): { d: number; form: string } {
  const nSorted = n.split(' ').sort().join(' ');
  const nJoined = n.replace(/ /g, '');
  let best = { d: Infinity, form: '' };
  for (const f of fs) {
    for (const cand of [n, nSorted, nJoined]) {
      const d = levenshtein(cand, f);
      if (d < best.d) best = { d, form: f };
    }
  }
  return best;
}

export function gradeAnswer(input: string, target: Term, siblings: Term[], strict: boolean): Grade {
  const canonical = target.name;
  const n = normalize(input);
  if (!n) return { verdict: 'wrong', canonical };
  const variants = [n, n.split(' ').sort().join(' '), n.replace(/ /g, '')];
  const targetForms = forms(target);
  if (variants.some((v) => targetForms.includes(v))) return { verdict: 'correct', canonical };

  const others = siblings.filter((s) => s.id !== target.id);
  for (const s of others) {
    const sf = forms(s);
    if (variants.some((v) => sf.includes(v))) return { verdict: 'sibling', canonical, siblingName: s.name };
  }

  const own = bestDistance(n, targetForms);
  const near = own.d <= tolerance(own.form.length);
  let nearestSibling: { d: number; name: string } | null = null;
  for (const s of others) {
    const b = bestDistance(n, forms(s));
    if (b.d <= tolerance(b.form.length) && (!nearestSibling || b.d < nearestSibling.d)) nearestSibling = { d: b.d, name: s.name };
  }
  if (near && (!nearestSibling || own.d <= nearestSibling.d)) {
    if (strict || target.strict) return { verdict: 'wrong', canonical, distance: own.d, spelling: true };
    return { verdict: 'close', canonical, distance: own.d, spelling: true };
  }
  if (nearestSibling) return { verdict: 'sibling', canonical, siblingName: nearestSibling.name };
  return { verdict: 'wrong', canonical };
}

export function isCorrect(g: Grade): boolean {
  return g.verdict === 'correct' || g.verdict === 'close';
}
