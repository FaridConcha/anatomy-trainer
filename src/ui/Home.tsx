import { useContent } from '../App';
import { allDecks, deckGroups, deckTerms } from '../content/decks';
import { mastered } from '../engine/progress';
import { navigate } from '../router';
import { useProgress } from '../storage/local';

export function Home() {
  const idx = useContent();
  const progress = useProgress();
  const decks = allDecks(idx);
  const last = progress.sessions[0];
  const lastDeck = last && decks.find((d) => d.id === last.deckId);

  return (
    <div className="screen">
      <div className="bar">
        <span className="eyebrow">Anatomy &amp; Physiology I</span>
        <span className="meta">{progress.sessions.length} sessions</span>
      </div>
      <div className="big">Where do you want to drill?</div>
      {lastDeck && (
        <div className="card row" style={{ gap: 12 }}>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>Continue: {lastDeck.title}</div>
            <div className="hint">
              last {last.mode} · {last.correct}/{last.total} correct
            </div>
          </div>
          <button className="btn sm accent" onClick={() => navigate(`deck/${lastDeck.id}`)}>
            Resume
          </button>
        </div>
      )}
      <div className="decks">
        {decks.map((d, i) => {
          const terms = deckTerms(idx, deckGroups(idx, d));
          const done = terms.filter((t) => mastered(progress.terms[t.id])).length;
          const exam = d.id === 'exam1';
          return (
            <button key={d.id} className={`deck ${exam ? 'exam' : ''}`} onClick={() => navigate(`deck/${d.id}`)}>
              <span className="num">{exam ? 'E1' : i + 1}</span>
              <span>
                <div className="name">{d.title}</div>
                <div className="sub">{d.blurb}</div>
                {!exam && (
                  <div className="progress" style={{ marginTop: 6 }}>
                    <i style={{ width: `${terms.length ? (done / terms.length) * 100 : 0}%` }} />
                  </div>
                )}
              </span>
              <span className="stat">
                {done}/{terms.length}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
