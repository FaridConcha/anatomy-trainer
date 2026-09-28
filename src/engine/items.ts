export type ItemKind = 'sticker' | 'mc' | 'match' | 'flash' | 'short' | 'wordform';

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
  | { kind: 'flash'; id: string; termId: string; front: string; back: string; label: string }
  | { kind: 'short'; id: string; questionId: string; prompt: string; modelAnswer: string; termIds: string[] }
  | { kind: 'wordform'; id: string; termId: string; prompt: string; answer: string; note?: string };

export type Mode = 'sticker' | 'mc' | 'match' | 'flash' | 'short' | 'wordform' | 'practical';

export interface AnswerResult {
  itemId: string;
  ok: boolean;
  spelling?: boolean;
  given?: string;
  expected: string;
  progressIds: string[];
}

export const modeInfo: Record<Mode, { title: string; blurb: string; needsImages: boolean }> = {
  sticker: { title: 'Sticker', blurb: 'Type the name of the marked structure. The exam format.', needsImages: true },
  mc: { title: 'Multiple choice', blurb: 'Four options from the same group.', needsImages: false },
  match: { title: 'Match', blurb: 'Pair the stickers on one image with their names.', needsImages: true },
  flash: { title: 'Flashcards', blurb: 'Definitions, locations, what passes through.', needsImages: false },
  short: { title: 'Stations', blurb: 'Short-answer questions from the handouts.', needsImages: false },
  wordform: { title: 'Word forms', blurb: 'Singular to plural, spelling traps.', needsImages: false },
  practical: { title: 'Practical simulation', blurb: 'Timed stations, no feedback until the end.', needsImages: true },
};
