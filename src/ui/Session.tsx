import { useEffect, useMemo, useRef, useState } from 'react';
import { useContent } from '../App';
import { deckById } from '../content/decks';
import type { AnswerResult, Item, Mode } from '../engine/items';
import { modeInfo } from '../engine/items';
import { addSession, recordAnswer } from '../engine/progress';
import { buildSession, progressIds } from '../engine/session';
import { navigate } from '../router';
import { progressStore, useProgress } from '../storage/local';
import { ItemView } from './modes/ItemView';
import { Report } from './Report';

export const reviewQueue: { items: Item[]; deckId: string } = { items: [], deckId: 'exam1' };

export function SessionScreen({ deckId, mode }: { deckId: string; mode: string }) {
  const idx = useContent();
  const progress = useProgress();
  const deck = deckById(idx, deckId);
  const isReview = mode === 'review';
  const practical = mode === 'practical';
  const [seed] = useState(() => Date.now());

  const items = useMemo<Item[]>(() => {
    if (isReview) return reviewQueue.items;
    if (!deck) return [];
    const count = practical ? progress.settings.practicalCount : progress.settings.sessionCount;
    return buildSession(idx, progressStore.get(), { deck, mode: mode as Mode, groupIds: progress.settings.groupSel[deck.id], count, seed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, deck?.id, mode, seed]);

  const [i, setI] = useState(0);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [done, setDone] = useState(false);
  const [finished, setFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(progress.settings.practicalSeconds);
  const answeredRef = useRef(false);
  const item = items[i];

  useEffect(() => {
    answeredRef.current = false;
    setDone(false);
    if (!practical) return;
    setTimeLeft(progress.settings.practicalSeconds);
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, practical]);

  const finish = (all: AnswerResult[]) => {
    const missed = all.filter((r) => !r.ok).flatMap((r) => r.progressIds);
    progressStore.update((s) => {
      let next = s;
      if (practical) for (const r of all) for (const id of r.progressIds) next = recordAnswer(next, id, r.ok, itemKindOf(r, items), r.spelling);
      return addSession(next, { at: Date.now(), deckId: deck?.id ?? deckId, mode, total: all.length, correct: all.filter((r) => r.ok).length, missedIds: missed });
    });
    setFinished(true);
  };

  const advance = (all: AnswerResult[]) => {
    if (i + 1 >= items.length) finish(all);
    else setI(i + 1);
  };

  const onAnswer = (r: AnswerResult) => {
    if (!practical) progressStore.update((s) => r.progressIds.reduce((acc, id) => recordAnswer(acc, id, r.ok, item.kind, r.spelling), s));
    setResults((rs) => [...rs, r]);
  };

  const onDone = () => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    setDone(true);
  };

  useEffect(() => {
    if (!practical || !item) return;
    if (done) {
      const t = setTimeout(() => advance(results), 250);
      return () => clearTimeout(t);
    }
    if (timeLeft <= 0 && !answeredRef.current) {
      const r: AnswerResult = { itemId: item.id, ok: false, given: '', expected: expectedOf(item, idx), progressIds: progressIds(item) };
      answeredRef.current = true;
      setResults((rs) => {
        const all = [...rs, r];
        setTimeout(() => advance(all), 0);
        return all;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, timeLeft, practical, item?.id]);

  if (!deck && !isReview) return <div className="screen"><div className="banner">Unknown deck.</div></div>;
  if (!items.length) return <div className="screen"><div className="bar"><button className="back" onClick={() => navigate(`deck/${deckId}`)}>‹ Back</button></div><div className="banner">Nothing to practise here yet.</div></div>;
  if (finished) return <Report deckId={deck?.id ?? deckId} mode={mode} items={items} results={results} />;

  const title = isReview ? 'Review misses' : modeInfo[mode as Mode]?.title ?? mode;

  return (
    <div className="screen">
      <div className="bar">
        <button className="back" onClick={() => navigate(`deck/${deckId}`)}>‹ {deck?.title.split(' · ')[0] ?? 'Back'}</button>
        <span className="title">{title}</span>
        {practical ? <span className={`timer ${timeLeft <= 10 ? 'low' : ''}`}>{Math.max(0, timeLeft)}s</span> : <span className="meta">{i + 1} / {items.length}</span>}
      </div>
      <div className="progress"><i className="acc" style={{ width: `${((i + (done ? 1 : 0)) / items.length) * 100}%` }} /></div>
      <ItemView key={item.id} item={item} reveal={!practical} onAnswer={onAnswer} onDone={onDone} />
      {done && !practical && (
        <button className="btn" onClick={() => advance(results)}>
          {i + 1 >= items.length ? 'Finish' : 'Next ›'}
        </button>
      )}
    </div>
  );
}

function itemKindOf(r: AnswerResult, items: Item[]) {
  return items.find((it) => it.id === r.itemId)?.kind ?? 'sticker';
}

export function expectedOf(item: Item, idx: ReturnType<typeof useContent>): string {
  switch (item.kind) {
    case 'sticker':
    case 'flash':
      return idx.termsById.get(item.termId)?.name ?? item.termId;
    case 'mc':
      return item.options[item.answerIndex];
    case 'short':
      return item.modelAnswer;
    case 'wordform':
      return item.answer;
    case 'match':
      return 'all pairs';
  }
}
