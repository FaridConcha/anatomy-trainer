import { useMemo, useState } from 'react';
import { useContent } from '../App';
import { deckById, deckGroups, deckImages } from '../content/decks';
import type { Group, Image } from '../content/types';
import { mcForFact, mcForImage } from '../engine/generate';
import type { AnswerResult, Item } from '../engine/items';
import { markToured, recordAnswer } from '../engine/progress';
import { seededRng, shuffle } from '../engine/rng';
import { navigate } from '../router';
import { progressStore, useProgress } from '../storage/local';
import { Explain } from './Explain';
import { ImageStage } from './ImageStage';
import { ItemView } from './modes/ItemView';

type Step = { kind: 'image'; image: Image; hotspotIndexes: number[] } | { kind: 'cards'; termIds: string[] };

export function untouredGroups(groups: Group[], toured: string[]): Group[] {
  return groups.filter((g) => !toured.includes(g.id) && !['wordform', 'spelling'].includes(g.kind));
}

// First meeting with a group: every structure shown and named before any scoring, then a short pretest.
export function TourScreen({ deckId }: { deckId: string }) {
  const idx = useContent();
  const progress = useProgress();
  const deck = deckById(idx, deckId);
  const groups = deck ? untouredGroups(deckGroups(idx, deck), progress.settings.toured ?? []) : [];
  const group = groups[0];
  const [seed] = useState(() => Date.now());

  const steps = useMemo<Step[]>(() => {
    if (!group || !deck) return [];
    const terms = idx.termsByGroup.get(group.id) ?? [];
    const termIds = new Set(terms.map((t) => t.id));
    const out: Step[] = [];
    const shown = new Set<string>();
    for (const img of deckImages(idx, [group])) {
      const his = img.hotspots.map((h, i) => ({ h, i })).filter(({ h }) => termIds.has(h.termId) && !shown.has(h.termId));
      if (!his.length) continue;
      his.forEach(({ h }) => shown.add(h.termId));
      out.push({ kind: 'image', image: img, hotspotIndexes: his.map(({ i }) => i) });
    }
    const rest = terms.filter((t) => !shown.has(t.id) && t.facts && (t.facts.definition || t.facts.location || t.facts.transmits)).map((t) => t.id);
    if (rest.length) out.push({ kind: 'cards', termIds: rest });
    return out;
  }, [group?.id, deck?.id, idx]);

  const pretest = useMemo<Item[]>(() => {
    if (!group) return [];
    const rng = seededRng(seed);
    const terms = shuffle(idx.termsByGroup.get(group.id) ?? [], rng).slice(0, 4);
    return terms.flatMap((t) => {
      const ref = idx.imagesByTerm.get(t.id)?.[0];
      const it = ref ? mcForImage(idx, ref.image, ref.hotspotIndex, rng) : t.facts?.definition || t.facts?.location || t.facts?.transmits ? mcForFact(idx, t, t.facts.transmits ? 'transmits' : t.facts.location ? 'location' : 'definition', rng) : null;
      return it ? [it] : [];
    });
  }, [group?.id, seed, idx]);

  const [si, setSi] = useState(0);
  const [reveal, setReveal] = useState(0);
  const [phase, setPhase] = useState<'tour' | 'pretest'>('tour');
  const [pi, setPi] = useState(0);
  const [pdone, setPdone] = useState(false);

  if (!deck) return <div className="screen"><div className="banner">Unknown deck.</div></div>;
  if (!group) return <div className="screen"><div className="bar"><button className="back" onClick={() => navigate(`deck/${deckId}`)}>‹ Deck</button></div><div className="model"><b>Nothing new here.</b> Every group in this deck has been toured. Study takes it from here.</div></div>;

  const finishGroup = () => {
    progressStore.update((s) => markToured(s, group.id));
    setSi(0); setReveal(0); setPhase('tour'); setPi(0); setPdone(false);
  };

  const step = steps[si];
  const total = steps.reduce((n, s) => n + (s.kind === 'image' ? s.hotspotIndexes.length : s.termIds.length), 0);
  const seen = steps.slice(0, si).reduce((n, s) => n + (s.kind === 'image' ? s.hotspotIndexes.length : s.termIds.length), 0) + reveal;

  if (phase === 'pretest') {
    const item = pretest[pi];
    const onAnswer = (r: AnswerResult) => progressStore.update((s) => r.progressIds.reduce((acc, id) => recordAnswer(acc, id, r.ok, item.kind, r.spelling), s));
    return (
      <div className="screen">
        <div className="bar"><button className="back" onClick={() => navigate(`deck/${deckId}`)}>‹ Deck</button><span className="title">Quick check · {group.title}</span><span className="meta">{pi + 1} / {pretest.length}</span></div>
        <div className="hint">Four questions on what you just saw. Wrong answers are fine: they tell the app what to bring back first.</div>
        {item ? <ItemView key={item.id} item={item} onAnswer={onAnswer} onDone={() => setPdone(true)} /> : <div className="model">Nothing to check for this group.</div>}
        {(pdone || !item) && (
          <button className="btn" onClick={() => { if (pi + 1 < pretest.length) { setPi(pi + 1); setPdone(false); } else finishGroup(); }}>
            {pi + 1 < pretest.length ? 'Next ›' : groups.length > 1 ? `Next group: ${groups[1].title} ›` : 'Finish'}
          </button>
        )}
      </div>
    );
  }

  const advance = () => {
    if (!step) { setPhase('pretest'); return; }
    const count = step.kind === 'image' ? step.hotspotIndexes.length : step.termIds.length;
    if (reveal + 1 < count) setReveal(reveal + 1);
    else if (si + 1 < steps.length) { setSi(si + 1); setReveal(0); }
    else setPhase('pretest');
  };

  return (
    <div className="screen">
      <div className="bar"><button className="back" onClick={() => navigate(`deck/${deckId}`)}>‹ Deck</button><span className="title">Learn · {group.title}</span><span className="meta">{Math.min(seen + 1, total)} / {total}</span></div>
      <div className="progress"><i className="acc" style={{ width: `${total ? ((seen + 1) / total) * 100 : 100}%` }} /></div>
      {step?.kind === 'image' && (
        <>
          <ImageStage image={step.image} stickers={step.hotspotIndexes.slice(0, reveal + 1).map((hi, k) => ({ hotspotIndex: hi, label: k + 1, state: k < reveal ? 'done' : undefined }))} focus={step.hotspotIndexes[reveal]} zoom={false} />
          <div className="prompt">Sticker <b>{reveal + 1}</b> is the <b>{idx.termsById.get(step.image.hotspots[step.hotspotIndexes[reveal]].termId)?.name}</b></div>
          <Explain termId={step.image.hotspots[step.hotspotIndexes[reveal]].termId} />
        </>
      )}
      {step?.kind === 'cards' && (
        <>
          <div className="card"><div className="eyebrow">{group.title}</div><div className="big" style={{ fontSize: 26, marginTop: 6 }}>{idx.termsById.get(step.termIds[reveal])?.name}</div></div>
          <Explain termId={step.termIds[reveal]} />
        </>
      )}
      {!step && <div className="model">This group has no images or facts to show yet.</div>}
      <button className="btn" onClick={advance}>{step && (reveal + 1 < (step.kind === 'image' ? step.hotspotIndexes.length : step.termIds.length) || si + 1 < steps.length) ? 'Next ›' : 'Quick check ›'}</button>
      <div className="hint">Say each name out loud before tapping Next. No scoring here.</div>
    </div>
  );
}
