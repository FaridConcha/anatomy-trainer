import { useContent } from '../App';
import { allDecks, deckGroups, deckTerms } from '../content/decks';
import { mastered } from '../engine/progress';
import { dueTerms } from '../engine/session';
import { navigate } from '../router';
import { useProgress } from '../storage/local';

export function Home() {
  const idx = useContent();
  const progress = useProgress();
  const decks = allDecks(idx);
  const due = dueTerms(idx, progress).length;
  const last = progress.sessions[0];
  const lastDeck = last && decks.find((d) => d.id === last.deckId);

  return (
    <div className="screen">
      <div className="bar">
        <span className="eyebrow">Anatomy &amp; Physiology I</span>
        <span className="meta">{progress.sessions.length} sessions</span>
      </div>
      <div className="big">Where do you want to drill?</div>
      <div className="card row" style={{ gap: 12 }}>
        <div className="grow">
          <div style={{ fontWeight: 600 }}>{due ? `${due} term${due === 1 ? '' : 's'} due today` : 'Nothing due yet'}</div>
          <div className="hint">{due ? 'Misses and terms whose spacing interval ran out, across all labs.' : lastDeck ? `Last: ${lastDeck.title} · ${last.correct}/${last.total} correct` : 'Pick a lab below to start.'}</div>
        </div>
        {due > 0 && <button className="btn sm accent" onClick={() => navigate('play/exam1/study?due=1')}>Study</button>}
      </div>
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
