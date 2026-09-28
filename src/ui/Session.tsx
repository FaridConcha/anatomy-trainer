import { useEffect, useMemo, useRef, useState } from 'react';
import { useContent } from '../App';
import { deckById } from '../content/decks';
import type { AnswerResult, Item, Mode } from '../engine/items';
import { modeInfo } from '../engine/items';
import { addSession, recordAnswer } from '../engine/progress';
import { buildSession, progressIds } from '../engine/session';
import { navigate, useHash } from '../router';
import { progressStore, useProgress } from '../storage/local';
import { ItemView } from './modes/ItemView';
import { Report } from './Report';

export const reviewQueue: { items: Item[]; deckId: string; round: number } = { items: [], deckId: 'exam1', round: 0 };

export function SessionScreen({ deckId, mode }: { deckId: string; mode: string }) {
  const idx = useContent();
  const progress = useProgress();
  const deck = deckById(idx, deckId);
  const isReview = mode === 'review';
  const practical = mode === 'practical';
  const query = useHash().query;
  const dueOnly = query.get('due') === '1';
  const spellOnly = query.get('spell') === '1';
  const [seed] = useState(() => Date.now());

  const items = useMemo<Item[]>(() => {
    if (isReview) return reviewQueue.items;
    if (!deck) return [];
    const count = practical ? progress.settings.practicalCount : progress.settings.sessionCount;
    return buildSession(idx, progressStore.get(), { deck, mode: mode as Mode, groupIds: deck.id === 'exam1' ? [] : progress.settings.groupSel[deck.id], count, seed, dueOnly, spellOnly });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, deck?.id, mode, seed, dueOnly, spellOnly]);

  const [i, setI] = useState(0);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [done, setDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [finished, setFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(progress.settings.practicalSeconds);
  const answeredRef = useRef(false);
  const item = items[i];

  useEffect(() => {
    answeredRef.current = false;
    setDone(false);
    setTimedOut(false);
    if (!practical) return;
    setTimeLeft(progress.settings.practicalSeconds);
    const t = setInterval(() => {
      if (!answeredRef.current) setTimeLeft((s) => s - 1);
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, practical]);

  const finish = (all: AnswerResult[]) => {
    const missed = all.filter((r) => !r.ok).flatMap((r) => r.progressIds);
    progressStore.update((s) => addSession(s, { at: Date.now(), deckId: deck?.id ?? deckId, mode, total: all.length, correct: all.filter((r) => r.ok).length, missedIds: missed }));
    setFinished(true);
  };

  const advance = () => {
    if (i + 1 >= items.length) finish(results);
    else setI(i + 1);
  };

  const onAnswer = (r: AnswerResult) => {
    answeredRef.current = true;
    progressStore.update((s) => r.progressIds.reduce((acc, id) => recordAnswer(acc, id, r.ok, item.kind, r.spelling, r.confident ?? true), s));
    setResults((rs) => [...rs, r]);
  };

  const onDone = () => setDone(true);

  useEffect(() => {
    if (!practical || !item || timeLeft > 0 || answeredRef.current) return;
    answeredRef.current = true;
    const r: AnswerResult = { itemId: item.id, ok: false, given: '', expected: expectedOf(item, idx), progressIds: progressIds(item) };
    progressStore.update((s) => r.progressIds.reduce((acc, id) => recordAnswer(acc, id, false, item.kind), s));
    setResults((rs) => [...rs, r]);
    setTimedOut(true);
    setDone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, practical, item?.id]);

  if (!deck && !isReview) return <div className="screen"><div className="banner">Unknown deck.</div></div>;
  if (!items.length) return <div className="screen"><div className="bar"><button className="back" onClick={() => navigate(`deck/${deckId}`)}>‹ Back</button></div><div className="banner">Nothing to practise here yet.</div></div>;
  if (finished) return <Report deckId={deck?.id ?? deckId} mode={mode} items={items} results={results} />;

  const title = isReview ? `Review round ${reviewQueue.round}` : dueOnly ? 'Due today' : spellOnly ? 'Spelling drill' : modeInfo[mode as Mode]?.title ?? mode;

  return (
    <div className="screen">
      <div className="bar">
        <button className="back" onClick={() => navigate(`deck/${deckId}`)}>‹ {deck?.title.split(' · ')[0] ?? 'Back'}</button>
        <span className="title">{title}</span>
        {practical && !done ? <span className={`timer ${timeLeft <= 10 ? 'low' : ''}`}>{Math.max(0, timeLeft)}s</span> : <span className="meta">{i + 1} / {items.length}</span>}
      </div>
      <div className="progress"><i className="acc" style={{ width: `${((i + (done ? 1 : 0)) / items.length) * 100}%` }} /></div>
      {timedOut ? (
        <div className="card">
          <div className="eyebrow">time's up</div>
          <div style={{ fontSize: 16, marginTop: 6 }}>The answer was <b>{expectedOf(item, idx)}</b>. It goes back into rotation.</div>
        </div>
      ) : (
        <ItemView key={item.id} item={item} onAnswer={onAnswer} onDone={onDone} />
      )}
      {done && (
        <button className="btn" onClick={advance}>
          {i + 1 >= items.length ? 'Finish' : 'Next ›'}
        </button>
      )}
    </div>
  );
}

export function expectedOf(item: Item, idx: ReturnType<typeof useContent>): string {
  switch (item.kind) {
    case 'sticker':
    case 'recall':
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
