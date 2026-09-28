import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useContent } from '../../App';
import { siblingsOf } from '../../content/index';
import type { AnswerResult, Item } from '../../engine/items';
import { gradeAnswer, isCorrect, normalize, type Grade } from '../../engine/match';
import { progressStore, useProgress } from '../../storage/local';
import { Feedback } from '../Feedback';
import { ImageStage } from '../ImageStage';

interface Props {
  item: Item;
  reveal: boolean;
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
    case 'flash':
      return <FlashItem {...props} item={props.item} />;
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

function StickerItem({ item, reveal, onAnswer, onDone }: Props & { item: Extract<Item, { kind: 'sticker' }> }) {
  const idx = useContent();
  const progress = useProgress();
  const [strict, setStrict] = useStrict();
  const image = idx.imagesById.get(item.imageId)!;
  const term = idx.termsById.get(item.termId)!;
  const hotspot = image.hotspots[item.hotspotIndex];
  const whole = hotspot.shape.kind === 'whole';
  const [zoom, setZoom] = useState(progress.settings.zoomDefault);
  const [value, setValue] = useState('');
  const [grade, setGrade] = useState<Grade | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (grade) return;
    const g = gradeAnswer(value, term, siblingsOf(idx, term), strict);
    setGrade(g);
    onAnswer({ itemId: item.id, ok: isCorrect(g), spelling: g.verdict === 'close', given: value, expected: term.name, progressIds: [term.id] });
    onDone();
  };

  const prompt = hotspot.prompt ?? (whole ? 'What tissue is this?' : <>What structure is sticker <b>1</b> on?</>);
  return (
    <>
      <ImageStage image={image} stickers={whole ? [] : [{ hotspotIndex: item.hotspotIndex, label: 1, state: grade ? (isCorrect(grade) ? 'done' : 'wrong') : undefined }]} focus={item.hotspotIndex} zoom={zoom} onZoomToggle={setZoom} />
      <div className="prompt">{prompt}</div>
      <form className="answer" onSubmit={submit}>
        <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder="type the name…" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} disabled={!!grade} />
        <button className="btn" type="submit" disabled={!!grade}>Check</button>
      </form>
      {grade && reveal && <Feedback grade={grade} given={value} strictNote={strict} />}
      {!grade && (
        <div className="toggles">
          <label className="toggle"><input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} /> Strict spelling</label>
          {image.title && <span className="toggle">{image.title}</span>}
        </div>
      )}
    </>
  );
}

function McItem({ item, reveal, onAnswer, onDone }: Props & { item: Extract<Item, { kind: 'mc' }> }) {
  const idx = useContent();
  const progress = useProgress();
  const [picked, setPicked] = useState<number | null>(null);
  const [zoom, setZoom] = useState(progress.settings.zoomDefault);
  const image = item.imageId ? idx.imagesById.get(item.imageId) : undefined;
  const choose = (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    const ok = k === item.answerIndex;
    onAnswer({ itemId: item.id, ok, given: item.options[k], expected: item.options[item.answerIndex], progressIds: [item.progressId] });
    onDone();
  };
  return (
    <>
      {image && item.hotspotIndex !== undefined && (
        <ImageStage image={image} stickers={image.hotspots[item.hotspotIndex].shape.kind === 'whole' ? [] : [{ hotspotIndex: item.hotspotIndex, label: 1 }]} focus={item.hotspotIndex} zoom={zoom} onZoomToggle={setZoom} />
      )}
      <div className="prompt">{item.prompt}</div>
      <div className="opts">
        {item.options.map((o, k) => (
          <button key={k} className="opt" disabled={picked !== null} data-state={picked === null || !reveal ? '' : k === item.answerIndex ? 'right' : picked === k ? 'wrong' : ''} onClick={() => choose(k)}>
            <span className="key">{'ABCD'[k]}</span>
            {o}
          </button>
        ))}
      </div>
    </>
  );
}

function MatchItem({ item, reveal, onAnswer, onDone }: Props & { item: Extract<Item, { kind: 'match' }> }) {
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
      setMsg(['wrong', reveal ? `Sticker ${item.hotspotIndexes.indexOf(sel) + 1} is not the ${wrong.name}. Try again.` : 'Try again.']);
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

function FlashItem({ item, onAnswer, onDone }: Props & { item: Extract<Item, { kind: 'flash' }> }) {
  const [flipped, setFlipped] = useState(false);
  const rate = (ok: boolean) => {
    onAnswer({ itemId: item.id, ok, expected: item.back, progressIds: [item.termId] });
    onDone();
  };
  return (
    <>
      <button className="card flash" onClick={() => setFlipped((f) => !f)}>
        <div className="eyebrow">{flipped ? item.label : 'term'}</div>
        <div className="term">{flipped ? '' : item.front}</div>
        <div className="ans">{flipped ? item.back : 'tap to flip'}</div>
      </button>
      {flipped ? (
        <div className="row">
          <button className="btn secondary grow" onClick={() => rate(false)}>Again</button>
          <button className="btn grow" onClick={() => rate(true)}>Got it</button>
        </div>
      ) : (
        <div className="hint">Say the answer out loud, then flip.</div>
      )}
    </>
  );
}

function ShortItem({ item, reveal, onAnswer, onDone }: Props & { item: Extract<Item, { kind: 'short' }> }) {
  const idx = useContent();
  const [value, setValue] = useState('');
  const [revealed, setRevealed] = useState(false);
  const q = idx.content.questions.find((x) => x.id === item.questionId);
  const group = q?.groupId ? idx.groupsById.get(q.groupId) : undefined;
  const mark = (ok: boolean) => {
    onAnswer({ itemId: item.id, ok, given: value, expected: item.modelAnswer, progressIds: item.termIds.length ? item.termIds : [item.questionId] });
    onDone();
  };
  const submitPractical = () => {
    if (!reveal) {
      onAnswer({ itemId: item.id, ok: normalize(value).length > 0, given: value, expected: item.modelAnswer, progressIds: item.termIds.length ? item.termIds : [item.questionId] });
      onDone();
    } else setRevealed(true);
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
        <button className="btn" onClick={submitPractical}>{reveal ? 'Reveal answer' : 'Submit'}</button>
      )}
      {!reveal && <div className="hint">Written stations are self-marked in the report.</div>}
    </>
  );
}

function WordformItem({ item, reveal, onAnswer, onDone }: Props & { item: Extract<Item, { kind: 'wordform' }> }) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (result !== null) return;
    const ok = normalize(value) === normalize(item.answer);
    setResult(ok);
    onAnswer({ itemId: item.id, ok, given: value, expected: item.answer, progressIds: [item.termId] });
    onDone();
  };
  return (
    <>
      <div className="card"><div className="eyebrow">exact spelling</div><div style={{ fontSize: 18, marginTop: 6 }}>{item.prompt}</div></div>
      <form className="answer" onSubmit={submit}>
        <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder="type it…" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} disabled={result !== null} />
        <button className="btn" type="submit" disabled={result !== null}>Check</button>
      </form>
      {result !== null && reveal && (
        <div className={`feedback ${result ? 'correct' : 'wrong'}`}>
          {result ? <>Correct: <b>{item.answer}</b></> : <>No. It is <b>{item.answer}</b>.</>}
          {item.note && <small>{item.note}</small>}
        </div>
      )}
    </>
  );
}
