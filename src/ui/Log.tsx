import { useContent } from '../App';
import { topConfusions } from '../engine/progress';
import { navigate } from '../router';
import { useProgress } from '../storage/local';

// Everything the student has got wrong, in one place: recent misses, spelling slips, confused pairs.
export function LogScreen() {
  const idx = useContent();
  const progress = useProgress();
  const recent: { id: string; when: number }[] = [];
  const seen = new Set<string>();
  for (const s of progress.sessions) for (const id of s.missedIds) if (!seen.has(id) && idx.termsById.has(id)) { seen.add(id); recent.push({ id, when: s.at }); }
  const spelling = Object.entries(progress.terms).filter(([id, t]) => t.spellingMisses > 0 && idx.termsById.has(id)).sort((a, b) => b[1].spellingMisses - a[1].spellingMisses);
  const pairs = topConfusions(progress, 10);
  const name = (id: string) => idx.termsById.get(id)?.name ?? id;
  const groupOf = (id: string) => idx.groupsById.get(idx.termsById.get(id)?.groupId ?? '')?.title ?? '';
  const ago = (t: number) => { const d = Math.floor((Date.now() - t) / 86400000); return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };

  return (
    <div className="screen">
      <div className="bar"><button className="back" onClick={() => navigate('')}>‹ Decks</button><span className="title">Mistake log</span><span className="meta">{recent.length} terms</span></div>
      {!recent.length && !spelling.length && !pairs.length && <div className="model"><b>Nothing logged yet.</b> Misses from Study and Practical sessions collect here.</div>}
      {spelling.length > 0 && (
        <>
          <div className="row"><span className="eyebrow grow">Spelling slips</span><button className="btn sm accent" onClick={() => navigate('play/exam1/study?spell=1')}>Spelling drill</button></div>
          <div className="misses">{spelling.slice(0, 12).map(([id, t]) => <div key={id} className="miss"><span>{name(id)}</span><span>{t.spellingMisses}× · {groupOf(id)}</span></div>)}</div>
        </>
      )}
      {pairs.length > 0 && (
        <>
          <div className="eyebrow">Pairs you mix up</div>
          <div className="pairs">{pairs.map((p) => <div key={p.termId + p.otherId} className="pair"><span><b>{name(p.termId)}</b> answered as {name(p.otherId)}</span><span>{p.n}×</span></div>)}</div>
        </>
      )}
      {recent.length > 0 && (
        <>
          <div className="eyebrow">Recent misses</div>
          <div className="misses">{recent.slice(0, 30).map((m) => <div key={m.id} className="miss"><span>{name(m.id)}</span><span>{groupOf(m.id)} · {ago(m.when)}</span></div>)}</div>
        </>
      )}
    </div>
  );
}
