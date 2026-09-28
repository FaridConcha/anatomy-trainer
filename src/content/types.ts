export type LabId = 'lab1' | 'lab2' | 'lab3' | 'lab4' | 'lab5';

export interface Lab {
  id: LabId;
  title: string;
  order: number;
  blurb: string;
}

export type GroupKind = 'structure' | 'tissue' | 'vocab' | 'foramen' | 'wordform' | 'spelling';

export interface Group {
  id: string;
  labId: LabId;
  title: string;
  region: string;
  kind: GroupKind;
  distractorPool?: string;
}

export interface TermFacts {
  definition?: string;
  location?: string;
  transmits?: string;
  category?: string;
  plural?: string;
  note?: string;
}

export interface Term {
  id: string;
  groupId: string;
  name: string;
  aliases?: string[];
  facts?: TermFacts;
  strict?: boolean;
}

export type HotspotShape =
  | { kind: 'point'; x: number; y: number; r: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'whole' };

export interface Hotspot {
  termId: string;
  shape: HotspotShape;
  marker?: { x: number; y: number };
  prompt?: string;
}

export interface Mask {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Image {
  id: string;
  src: string;
  width: number;
  height: number;
  labId: LabId;
  groupIds: string[];
  title?: string;
  hotspots: Hotspot[];
  masks: Mask[];
  source: 'content' | 'user';
  credit?: string;
}

export interface Question {
  id: string;
  labId: LabId;
  groupId?: string;
  kind: 'mc' | 'short';
  prompt: string;
  options?: string[];
  answerIndex?: number;
  modelAnswer?: string;
  termIds?: string[];
}

export interface Content {
  version: number;
  labs: Lab[];
  groups: Group[];
  terms: Term[];
  images: Image[];
  questions: Question[];
}
