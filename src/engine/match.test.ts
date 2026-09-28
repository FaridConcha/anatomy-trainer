import { describe, expect, it } from 'vitest';
import { gradeAnswer, levenshtein, normalize } from './match';
import type { Term } from '../content/types';

const t = (id: string, name: string, extra: Partial<Term> = {}): Term => ({ id, groupId: 'humerus', name, ...extra });
const greater = t('humerus.greater-tubercle', 'greater tubercle');
const lesser = t('humerus.lesser-tubercle', 'lesser tubercle');
const capitulum = t('humerus.capitulum', 'capitulum');
const glenoid = t('scapula.glenoid-cavity', 'glenoid cavity', { aliases: ['glenoid fossa'] });
const sulcus = t('humerus.intertubercular-sulcus', 'intertubercular sulcus', { aliases: ['bicipital groove'] });
const rib = t('thorax.true-ribs', 'true ribs');
const ribs = t('thorax.false-ribs', 'false ribs');
const axilla = t('lab1.plurals.axilla', 'axillae', { strict: true });
const sibs = [greater, lesser, capitulum, sulcus];

describe('normalize', () => {
  it('strips case, punctuation, hyphens and leading articles', () => {
    expect(normalize('  The Intér-Tubercular Sulcus! ')).toBe('inter tubercular sulcus');
    expect(normalize('foramen magnum (of occipital)')).toBe('foramen magnum');
  });
});

describe('levenshtein', () => {
  it('counts edits', () => {
    expect(levenshtein('capitulum', 'capitulm')).toBe(1);
    expect(levenshtein('abc', 'abc')).toBe(0);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('gradeAnswer', () => {
  it('accepts exact, case-insensitive, article-prefixed and alias answers', () => {
    expect(gradeAnswer('Greater Tubercle', greater, sibs, false).verdict).toBe('correct');
    expect(gradeAnswer('the greater tubercle', greater, sibs, false).verdict).toBe('correct');
    expect(gradeAnswer('glenoid fossa', glenoid, [glenoid], false).verdict).toBe('correct');
    expect(gradeAnswer('bicipital groove', sulcus, sibs, false).verdict).toBe('correct');
    expect(gradeAnswer('tubercle greater', greater, sibs, false).verdict).toBe('correct');
    expect(gradeAnswer('inter-tubercular sulcus', sulcus, sibs, false).verdict).toBe('correct');
  });

  it('reports a one-letter slip as close, within the length band', () => {
    const g = gradeAnswer('capitulm', capitulum, sibs, false);
    expect(g.verdict).toBe('close');
    expect(g.spelling).toBe(true);
    expect(gradeAnswer('greater tubercel', greater, sibs, false).verdict).toBe('close');
  });

  it('does not forgive slips in very short words', () => {
    const dens = t('v.dens', 'dens');
    expect(gradeAnswer('dans', dens, [dens], false).verdict).toBe('wrong');
  });

  it('turns close into wrong in strict mode or for strict terms', () => {
    expect(gradeAnswer('capitulm', capitulum, sibs, true).verdict).toBe('wrong');
    expect(gradeAnswer('axilae', axilla, [axilla], false).verdict).toBe('wrong');
  });

  it('names the sibling when the answer is another structure in the group', () => {
    const g = gradeAnswer('lesser tubercle', greater, sibs, false);
    expect(g.verdict).toBe('sibling');
    expect(g.siblingName).toBe('lesser tubercle');
    expect(gradeAnswer('lesser tubercel', greater, sibs, false).verdict).toBe('sibling');
  });

  it('does not treat a plural as the singular', () => {
    expect(gradeAnswer('true rib', rib, [rib, ribs], true).verdict).toBe('wrong');
    expect(gradeAnswer('true rib', rib, [rib, ribs], false).verdict).toBe('close');
  });

  it('rejects empty and unrelated answers', () => {
    expect(gradeAnswer('', greater, sibs, false).verdict).toBe('wrong');
    expect(gradeAnswer('femur', greater, sibs, false).verdict).toBe('wrong');
  });
});
