import { useState } from 'react';
import { useContent } from '../App';
import { deckById, deckGroups, deckTerms } from '../content/decks';
import { modeInfo, type Mode } from '../engine/items';
import { poolSize } from '../engine/session';
import { navigate } from '../router';
import { progressStore, useProgress } from '../storage/local';

const modes: Mode[] = ['study', 'practical'];

export function DeckScreen({ deckId }: { deckId: string }) {
  const idx = useContent();
  const progress = useProgress();
  const [showGroups, setShowGroups] = useState(false);
  const deck = deckById(idx, deckId);
  if (!deck) return <div className="screen"><div className="banner">Unknown deck.</div></div>;
  const isExam = deck.id === 'exam1';
  const groups = deckGroups(idx, deck);
  const sel = isExam ? [] : progress.settings.groupSel[deck.id] ?? [];
  const selected = sel.length ? groups.filter((g) => sel.includes(g.id)) : groups;
  const terms = deckTerms(idx, selected);

  const setSel = (next: string[]) => progressStore.update((s) => ({ ...s, settings: { ...s.settings, groupSel: { ...s.settings.groupSel, [deck.id]: next } } }));
  const toggle = (gid: string) => setSel(sel.includes(gid) ? sel.filter((x) => x !== gid) : [...sel, gid]);

  return (
    <div className="screen">
      <div className="bar">
        <button className="back" onClick={() => navigate('')}>‹ Decks</button>
        <span className="title">{deck.title}</span>
        <span className="meta">{terms.length} terms</span>
      </div>
      <div className="opts">
        {modes.map((m) => {
          const n = poolSize(idx, { deck, mode: m, groupIds: sel, count: 0 });
          const unit = m === 'study' ? 'items' : 'stations';
          return (
            <button key={m} className="opt mode" disabled={n === 0} onClick={() => navigate(`play/${deck.id}/${m}`)}>
              <span className="grow">
                <div style={{ fontWeight: 600, fontSize: 17 }}>{modeInfo[m].title}</div>
                <div className="hint">{n === 0 ? 'Nothing here for the chosen groups.' : modeInfo[m].blurb}</div>
              </span>
              <span className="key" style={{ width: 'auto', textAlign: 'right' }}>{n} {unit}</span>
            </button>
          );
        })}
      </div>
      {!isExam && (
        <>
          <div className="row">
            <span className="hint grow">Focus: {sel.length ? `${sel.length} of ${groups.length} groups` : 'all groups'}</span>
            {sel.length > 0 && <button className="btn sm secondary" onClick={() => setSel([])}>Clear</button>}
            <button className="btn sm secondary" onClick={() => setShowGroups((v) => !v)}>{showGroups ? 'Done' : 'Change'}</button>
          </div>
          {showGroups && (
            <div className="chips">
              {groups.map((g) => (
                <button key={g.id} className={`chip ${sel.includes(g.id) ? 'sel' : ''}`} onClick={() => toggle(g.id)}>
                  {g.title}
                  <small>{(idx.termsByGroup.get(g.id) ?? []).length}</small>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
