import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useContent } from '../../App';
import { siblingsOf } from '../../content/index';
import type { Term } from '../../content/types';
import type { AnswerResult, Item } from '../../engine/items';
import { acceptsExact, gradeAnswer, isCorrect, normalize, type Grade } from '../../engine/match';
import { progressStore, useProgress } from '../../storage/local';
import { recordConfusion } from '../../engine/progress';
import { ImageStage } from '../ImageStage';
import { Explain } from '../Explain';

interface Props {
  item: Item;
  onAnswer: (r: AnswerResult) => void;
  onDone: () => void;
}

export function ItemView(props: Props) {
  switch (props.item.kind) {
    case 'sticker':
      return <StickerItem {...props} item={props.item} />;
    case 'mc':
      return <McItem {...props} item={props.item} />;
    case 'match':
      return <MatchItem {...props} item={props.item} />;
    case 'recall':
      return <RecallItem {...props} item={props.item} />;
    case 'short':
      return <ShortItem {...props} item={props.item} />;
    case 'wordform':
      return <WordformItem {...props} item={props.item} />;
  }
}

function useStrict() {
  const p = useProgress();
  return [p.settings.strict, (v: boolean) => progressStore.update((s) => ({ ...s, settings: { ...s.settings, strict: v } }))] as const;
}

export function hintFor(term: Term, groupTitle: string): string {
  const name = term.name;
  return `${groupTitle} · ${name.replace(/[^a-z]/gi, '').length} letters, starts with “${name[0].toUpperCase()}”`;
}

// Typed answer against a term. First attempt is scored; a miss gets a hint and a second try, then the answer
// must be typed correctly before moving on. Shared by sticker and recall items.
function TypedAnswer({ term, itemId, extra, onAnswer, onDone, onGrade }: { term: Term; itemId: string; extra?: string; onAnswer: (r: AnswerResult) => void; onDone: () => void; onGrade?: (g: Grade) => void }) {
  const idx = useContent();
  const [strict, setStrict] = useStrict();
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<'first' | 'retry' | 'retype' | 'done'>('first');
  const [grade, setGrade] = useState<Grade | null>(null);
  const [note, setNote] = useState<{ tone: string; text: string } | null>(null);
  const [hinted, setHinted] = useState(false);
  const [unsure, setUnsure] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const group = idx.groupsById.get(term.groupId)!;
  useEffect(() => inputRef.current?.focus(), [phase]);

  const finish = (tone: string, text: string) => {
    setNote({ tone, text });
    setPhase('done');
    onDone();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (phase === 'done') return;
    if (phase === 'retype') {
      if (normalize(value) === normalize(term.name)) finish('correct', `Locked in: ${term.name}`);
      else setNote({ tone: 'wrong', text: `Not quite. Type it exactly: ${term.name}` });
      return;
    }
    const g = gradeAnswer(value, term, siblingsOf(idx, term), strict);
    if (g.verdict === 'sibling' && g.siblingId) progressStore.update((s) => recordConfusion(s, term.id, g.siblingId!));
    if (phase === 'first') {
      setGrade(g);
      onGrade?.(g);
      onAnswer({ itemId, ok: isCorrect(g) || g.verdict === 'partial', spelling: g.verdict === 'close' || g.verdict === 'partial' || hinted, confident: !unsure && !hinted, given: value, expected: term.name, progressIds: [term.id] });
      if (g.verdict === 'correct') return finish('correct', hinted ? `Correct with a hint: ${term.name}` : `Correct: ${term.name}`);
      if (g.verdict === 'close') {
        setNote({ tone: 'close', text: `Close, the spelling is ${term.name}. Type it correctly once so it sticks.` });
        setValue('');
        setPhase('retype');
        return;
      }
      if (g.verdict === 'partial') {
        setNote({ tone: 'close', text: 'Which bone? A grader wants the full name. Try again with the bone included.' });
        setPhase('retry');
        return;
      }
      setNote({ tone: 'wrong', text: `${g.verdict === 'sibling' ? `That is the ${g.siblingName}. ` : ''}Try once more. Hint: ${hintFor(term, group.title)}` });
      setValue('');
      setPhase('retry');
      return;
    }
    // second attempt
    if (isCorrect(g)) return finish('correct', `Got it on the second try: ${term.name}`);
    setNote({ tone: 'wrong', text: `The answer is ${term.name}. Type it correctly to move on.` });
    setValue('');
    setPhase('retype');
  };

  return (
    <>
      <form className="answer" onSubmit={submit}>
        <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder={phase === 'retype' ? term.name : 'type the name…'} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} disabled={phase === 'done'} />
        <button className="btn" type="submit" disabled={phase === 'done'}>{phase === 'retype' ? 'Lock in' : 'Check'}</button>
      </form>
      {note && <div className={`feedback ${note.tone}`}>{note.text}{grade?.spelling && phase === 'done' && strict && <small>strict spelling is on; a near-miss counted as wrong</small>}</div>}
      {phase === 'first' && (
        <div className="toggles">
          <label className="toggle"><input type="checkbox" checked={unsure} onChange={(e) => setUnsure(e.target.checked)} /> Not sure</label>
          {hinted ? <span className="toggle">Hint: {hintFor(term, group.title)}</span> : <button className="toggle" type="button" onClick={() => setHinted(true)}>Hint (half credit)</button>}
          <label className="toggle"><input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} /> Strict spelling</label>
          {extra && <span className="toggle">{extra}</span>}
        </div>
      )}
      {phase === 'done' && <Explain termId={term.id} />}
    </>
  );
}

function StickerItem({ item, onAnswer, onDone }: Props & { item: Extract<Item, { kind: 'sticker' }> }) {
  const idx = useContent();
  const progress = useProgress();
  const image = idx.imagesById.get(item.imageId)!;
  const term = idx.termsById.get(item.termId)!;
  const hotspot = image.hotspots[item.hotspotIndex];
  const whole = hotspot.shape.kind === 'whole';
  const [zoom, setZoom] = useState(progress.settings.zoomDefault);
  const [state, setState] = useState<'done' | 'wrong' | undefined>();
  const groupTitle = idx.groupsById.get(term.groupId)?.title;
  const prompt = hotspot.prompt ?? (whole ? 'What tissue is this?' : <>What structure is sticker <b>1</b> on? <span className="hint">({groupTitle})</span></>);
  return (
    <>
      <ImageStage image={image} stickers={whole ? [] : [{ hotspotIndex: item.hotspotIndex, label: 1, state }]} focus={item.hotspotIndex} zoom={zoom} onZoomToggle={setZoom} />
      <div className="prompt">{prompt}</div>
      <TypedAnswer term={term} itemId={item.id} extra={image.view} onAnswer={onAnswer} onDone={onDone} onGrade={(g) => setState(isCorrect(g) || g.verdict === 'partial' ? 'done' : 'wrong')} />
    </>
  );
}

function RecallItem({ item, onAnswer, onDone }: Props & { item: Extract<Item, { kind: 'recall' }> }) {
  const idx = useContent();
  const term = idx.termsById.get(item.termId)!;
  return (
    <>
      <div className="card">
        <div className="eyebrow">{item.label}</div>
        <div style={{ fontSize: 17, marginTop: 6 }}>{item.prompt}</div>
      </div>
      <TypedAnswer term={term} itemId={item.id} onAnswer={onAnswer} onDone={onDone} />
    </>
  );
}

function McItem({ item, onAnswer, onDone }: Props & { item: Extract<Item, { kind: 'mc' }> }) {
  const idx = useContent();
  const progress = useProgress();
  const [picks, setPicks] = useState<number[]>([]);
  const [unsure, setUnsure] = useState(false);
  const [zoom, setZoom] = useState(progress.settings.zoomDefault);
  const image = item.imageId ? idx.imagesById.get(item.imageId) : undefined;
  const done = picks.includes(item.answerIndex) || picks.length >= 2;
  const choose = (k: number) => {
    if (done || picks.includes(k)) return;
    const next = [...picks, k];
    setPicks(next);
    if (k !== item.answerIndex && item.termId && item.optionTermIds) progressStore.update((s) => recordConfusion(s, item.termId!, item.optionTermIds![k]));
    if (picks.length === 0) onAnswer({ itemId: item.id, ok: k === item.answerIndex, confident: !unsure, given: item.options[k], expected: item.options[item.answerIndex], progressIds: [item.progressId] });
    if (k === item.answerIndex || next.length >= 2) onDone();
  };
  const answer = item.options[item.answerIndex];
  return (
    <>
      {image && item.hotspotIndex !== undefined && (
        <ImageStage image={image} stickers={image.hotspots[item.hotspotIndex].shape.kind === 'whole' ? [] : [{ hotspotIndex: item.hotspotIndex, label: 1 }]} focus={item.hotspotIndex} zoom={zoom} onZoomToggle={setZoom} />
      )}
      <div className="prompt">{item.prompt}</div>
      <div className="opts">
        {item.options.map((o, k) => (
          <button key={k} className="opt" disabled={done || picks.includes(k)} data-state={done && k === item.answerIndex ? 'right' : picks.includes(k) && k !== item.answerIndex ? 'wrong' : ''} onClick={() => choose(k)}>
            <span className="key">{'ABCD'[k]}</span>
            {o}
          </button>
        ))}
      </div>
      {picks.length === 0 && <div className="toggles"><label className="toggle"><input type="checkbox" checked={unsure} onChange={(e) => setUnsure(e.target.checked)} /> Not sure</label>{image?.view && <span className="toggle">{image.view}</span>}</div>}
      {picks.length > 0 && (
        <div className={`feedback ${picks[0] === item.answerIndex ? 'correct' : done ? (picks.includes(item.answerIndex) ? 'close' : 'wrong') : 'close'}`}>
          {picks[0] === item.answerIndex ? `Correct: ${answer}` : picks.includes(item.answerIndex) ? `Second pick, so it still counts as a miss: ${answer}. It will come back.` : done ? `The answer is ${answer}.` : 'Not that one. One more try, then the answer is shown.'}
        </div>
      )}
      {done && item.termId && <Explain termId={item.termId} />}
    </>
  );
}

function MatchItem({ item, onAnswer, onDone }: Props & { item: Extract<Item, { kind: 'match' }> }) {
  const idx = useContent();
  const image = idx.imagesById.get(item.imageId)!;
  const [order] = useState(() => item.hotspotIndexes.slice().sort(() => Math.random() - 0.5));
  const [sel, setSel] = useState<number | null>(null);
  const [pairs, setPairs] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<[string, string] | null>(null);
  const [wrongOnce, setWrongOnce] = useState<Set<string>>(new Set());
  const stickers = item.hotspotIndexes.map((hi, k) => ({ hotspotIndex: hi, label: k + 1, state: pairs[hi] ? ('done' as const) : sel === hi ? ('sel' as const) : undefined }));
  const termOf = (hi: number) => idx.termsById.get(image.hotspots[hi].termId)!;

  const pickTerm = (termId: string) => {
    if (sel === null) {
      setMsg(['close', 'Tap a sticker first.']);
      return;
    }
    const t = termOf(sel);
    if (t.id === termId) {
      const next = { ...pairs, [sel]: termId };
      setPairs(next);
      const ok = !wrongOnce.has(termId);
      onAnswer({ itemId: `${item.id}:${termId}`, ok, given: t.name, expected: t.name, progressIds: [termId] });
      setMsg(['correct', `${item.hotspotIndexes.indexOf(sel) + 1} = ${t.name}`]);
      if (Object.keys(next).length === item.hotspotIndexes.length) onDone();
    } else {
      setWrongOnce((w) => new Set(w).add(t.id));
      const wrong = idx.termsById.get(termId)!;
      setMsg(['wrong', `Sticker ${item.hotspotIndexes.indexOf(sel) + 1} is not the ${wrong.name}. Try again.`]);
    }
    setSel(null);
  };

  return (
    <>
      <ImageStage image={image} stickers={stickers} onStickerTap={(hi) => { if (!pairs[hi]) { setSel(hi); setMsg(null); } }} />
      <div className="chips">
        {order.map((hi) => {
          const t = termOf(hi);
          const done = Object.values(pairs).includes(t.id);
          return (
            <button key={t.id} className={`chip ${done ? 'done' : ''}`} disabled={done} onClick={() => pickTerm(t.id)}>
              {t.name}
            </button>
          );
        })}
      </div>
      {msg ? <div className={`feedback ${msg[0]}`}>{msg[1]}</div> : <div className="hint">Tap a sticker, then its name.</div>}
    </>
  );
}

function ShortItem({ item, onAnswer, onDone }: Props & { item: Extract<Item, { kind: 'short' }> }) {
  const idx = useContent();
  const [value, setValue] = useState('');
  const [revealed, setRevealed] = useState(false);
  const q = idx.content.questions.find((x) => x.id === item.questionId);
  const group = q?.groupId ? idx.groupsById.get(q.groupId) : undefined;
  const ids = item.termIds.length ? item.termIds : [item.questionId];
  const mark = (ok: boolean) => {
    onAnswer({ itemId: item.id, ok, given: value, expected: item.modelAnswer, progressIds: ids });
    onDone();
  };
  return (
    <>
      <div className="card">
        {group && <div className="eyebrow">{group.title}</div>}
        <div style={{ fontSize: 16, marginTop: 6 }}>{item.prompt}</div>
      </div>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="your answer…" disabled={revealed} />
      {revealed ? (
        <>
          <div className="model"><b>Model answer.</b> {item.modelAnswer}</div>
          <div className="row">
            <button className="btn secondary grow" onClick={() => mark(false)}>I missed it</button>
            <button className="btn grow" onClick={() => mark(true)}>I had it</button>
          </div>
        </>
      ) : (
        <button className="btn" onClick={() => setRevealed(true)}>Reveal answer</button>
      )}
    </>
  );
}

function WordformItem({ item, onAnswer, onDone }: Props & { item: Extract<Item, { kind: 'wordform' }> }) {
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<'first' | 'retype' | 'done'>('first');
  const [note, setNote] = useState<{ tone: string; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), [phase]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (phase === 'done') return;
    const ok = acceptsExact(value, [item.answer, ...(item.alts ?? [])]);
    if (phase === 'first') {
      onAnswer({ itemId: item.id, ok, given: value, expected: item.answer, progressIds: [item.termId] });
      if (ok) { setNote({ tone: 'correct', text: `Correct: ${item.answer}` }); setPhase('done'); onDone(); return; }
      setNote({ tone: 'wrong', text: `It is ${item.answer}${item.note ? ` (${item.note})` : ''}. Type it correctly to move on.` });
      setValue('');
      setPhase('retype');
      return;
    }
    if (ok) { setNote({ tone: 'correct', text: `Locked in: ${item.answer}` }); setPhase('done'); onDone(); }
    else setNote({ tone: 'wrong', text: `Not quite. Type it exactly: ${item.answer}` });
  };
  return (
    <>
      <div className="card"><div className="eyebrow">exact spelling</div><div style={{ fontSize: 18, marginTop: 6 }}>{item.prompt}</div></div>
      <form className="answer" onSubmit={submit}>
        <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder={phase === 'retype' ? item.answer : 'type it…'} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} disabled={phase === 'done'} />
        <button className="btn" type="submit" disabled={phase === 'done'}>{phase === 'retype' ? 'Lock in' : 'Check'}</button>
      </form>
      {note && <div className={`feedback ${note.tone}`}>{note.text}</div>}
      {phase === 'done' && <Explain termId={item.termId} />}
    </>
  );
}
