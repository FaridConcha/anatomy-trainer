import { useContent } from '../App';
import { deckById, deckGroups, deckTerms } from '../content/decks';
import { groupsWithImages } from '../engine/generate';
import { modeInfo, type Mode } from '../engine/items';
import { poolSize } from '../engine/session';
import { navigate } from '../router';
import { progressStore, useProgress } from '../storage/local';

export function DeckScreen({ deckId }: { deckId: string }) {
  const idx = useContent();
  const progress = useProgress();
  const deck = deckById(idx, deckId);
  if (!deck) return <div className="screen"><div className="banner">Unknown deck.</div></div>;
  const groups = deckGroups(idx, deck);
  const sel = progress.settings.groupSel[deck.id] ?? [];
  const withImg = groupsWithImages(idx, groups);
  const selected = sel.length ? groups.filter((g) => sel.includes(g.id)) : groups;
  const terms = deckTerms(idx, selected);

  const toggle = (gid: string) => {
    const next = sel.includes(gid) ? sel.filter((x) => x !== gid) : [...sel, gid];
    progressStore.update((s) => ({ ...s, settings: { ...s.settings, groupSel: { ...s.settings.groupSel, [deck.id]: next } } }));
  };
  const clear = () => progressStore.update((s) => ({ ...s, settings: { ...s.settings, groupSel: { ...s.settings.groupSel, [deck.id]: [] } } }));

  const modes: Mode[] = ['sticker', 'mc', 'match', 'flash', 'short', 'wordform', 'practical'];

  return (
    <div className="screen">
      <div className="bar">
        <button className="back" onClick={() => navigate('')}>‹ Decks</button>
        <span className="title">{deck.title}</span>
        <span className="meta">{terms.length} terms</span>
      </div>
      <div className="row">
        <span className="eyebrow grow">Groups {sel.length ? `· ${sel.length} selected` : '· all'}</span>
        {sel.length > 0 && <button className="btn sm secondary" onClick={clear}>All</button>}
      </div>
      <div className="chips">
        {groups.map((g) => (
          <button key={g.id} className={`chip ${sel.includes(g.id) ? 'sel' : ''}`} onClick={() => toggle(g.id)}>
            {g.title}
            <small>{(idx.termsByGroup.get(g.id) ?? []).length}{withImg.has(g.id) ? '' : ' · no image'}</small>
          </button>
        ))}
      </div>
      <div className="eyebrow">Mode</div>
      <div className="opts">
        {modes.map((m) => {
          const n = poolSize(idx, { deck, mode: m, groupIds: sel, count: 0 });
          return (
            <button key={m} className="opt" disabled={n === 0} onClick={() => navigate(`play/${deck.id}/${m}`)}>
              <span className="grow">
                <div style={{ fontWeight: 600 }}>{modeInfo[m].title}</div>
                <div className="hint">{n === 0 ? 'Nothing available for the selected groups yet.' : modeInfo[m].blurb}</div>
              </span>
              <span className="key">{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
