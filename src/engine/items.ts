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
      answerIndex: number;
      progressId: string;
    }
  | { kind: 'match'; id: string; imageId: string; hotspotIndexes: number[] }
  | { kind: 'recall'; id: string; termId: string; prompt: string; label: string }
  | { kind: 'short'; id: string; questionId: string; prompt: string; modelAnswer: string; termIds: string[] }
  | { kind: 'wordform'; id: string; termId: string; prompt: string; answer: string; note?: string };

export type Mode = 'study' | 'short' | 'practical';

export interface AnswerResult {
  itemId: string;
  ok: boolean;
  spelling?: boolean;
  given?: string;
  expected: string;
  progressIds: string[];
}

export const modeInfo: Record<Mode, { title: string; blurb: string }> = {
  study: { title: 'Study', blurb: 'New terms come as multiple choice; known terms you have to type. The app picks, you answer.' },
  short: { title: 'Stations', blurb: 'The written part: short-answer questions from the handouts, self-marked against a model answer.' },
  practical: { title: 'Practical', blurb: 'Timed stations, no feedback until the end, then a report by region.' },
};
