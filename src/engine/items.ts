export type ItemKind = 'sticker' | 'mc' | 'match' | 'recall' | 'short' | 'wordform';

export type Item =
  | { kind: 'sticker'; id: string; termId: string; imageId: string; hotspotIndex: number }
  | {
      kind: 'mc';
      id: string;
      termId?: string;
      questionId?: string;
      prompt: string;
      imageId?: string;
      hotspotIndex?: number;
      options: string[];
      optionTermIds?: string[];
      answerIndex: number;
      progressId: string;
    }
  | { kind: 'match'; id: string; imageId: string; hotspotIndexes: number[] }
  | { kind: 'recall'; id: string; termId: string; prompt: string; label: string }
  | { kind: 'short'; id: string; questionId: string; prompt: string; modelAnswer: string; termIds: string[] }
  | { kind: 'wordform'; id: string; termId: string; prompt: string; answer: string; alts?: string[]; note?: string };

export type Mode = 'study' | 'practical';

export interface AnswerResult {
  itemId: string;
  ok: boolean;
  spelling?: boolean;
  confident?: boolean;
  given?: string;
  expected: string;
  progressIds: string[];
}

export const modeInfo: Record<Mode, { title: string; blurb: string }> = {
  study: { title: 'Study', blurb: 'New terms come as multiple choice, known terms you type, and written station questions are mixed in. The app picks, you answer.' },
  practical: { title: 'Practical', blurb: 'Timed stations in exam order with the same feedback as Study, then a report by region.' },
};
