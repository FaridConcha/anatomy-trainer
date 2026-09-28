import { useContent } from '../App';
import type { AnswerResult, Item } from '../engine/items';
import { navigate } from '../router';
import { reviewQueue } from './Session';

export function Report({ deckId, mode, items, results }: { deckId: string; mode: string; items: Item[]; results: AnswerResult[] }) {
  const idx = useContent();
  const correct = results.filter((r) => r.ok).length;
  const spelling = results.filter((r) => r.ok && r.spelling).length;
  const missed = results.filter((r) => !r.ok);

  const rows = new Map<string, { title: string; ok: number; n: number; subs: Map<string, { title: string; ok: number; n: number }> }>();
  for (const r of results) {
    const ids = r.progressIds.length ? r.progressIds : [r.itemId];
    for (const id of ids) {
      const term = idx.termsById.get(id);
      const q = term ? undefined : idx.content.questions.find((x) => x.id === id);
      const group = term ? idx.groupsById.get(term.groupId) : q?.groupId ? idx.groupsById.get(q.groupId) : undefined;
      const labId = group?.labId ?? q?.labId;
      if (!labId) continue;
      const lab = idx.labsById.get(labId)!;
      const row = rows.get(labId) ?? { title: `Lab ${lab.order} · ${lab.title}`, ok: 0, n: 0, subs: new Map() };
      row.n++;
      if (r.ok) row.ok++;
      if (group) {
        const sub = row.subs.get(group.id) ?? { title: group.title, ok: 0, n: 0 };
        sub.n++;
        if (r.ok) sub.ok++;
        row.subs.set(group.id, sub);
      }
      rows.set(labId, row);
    }
  }

  const reviewMisses = () => {
    const missedIds = new Set(missed.map((m) => m.itemId.split(':').slice(0, 3).join(':')));
    const its = items.filter((it) => missedIds.has(it.id) || missed.some((m) => m.itemId.startsWith(it.id)));
    reviewQueue.items = its;
    reviewQueue.deckId = deckId;
    reviewQueue.round = mode === 'review' ? reviewQueue.round + 1 : 1;
    navigate(`review/${deckId}`);
  };

  return (
    <div className="screen">
      <div className="bar">
        <button className="back" onClick={() => navigate(`deck/${deckId}`)}>‹ Deck</button>
        <span className="title">{mode === 'practical' ? 'Practical report' : mode === 'review' ? `Review round ${reviewQueue.round}` : 'Session report'}</span>
        <span className="meta">{results.length} answers</span>
      </div>
      <div className="score">
        <div className="card"><div className="v">{correct}</div><div className="l">correct</div></div>
        <div className="card"><div className="v">{spelling}</div><div className="l">spelling</div></div>
        <div className="card"><div className="v">{missed.length}</div><div className="l">missed</div></div>
      </div>
      <div className="rows">
        {Array.from(rows.values()).map((row) => (
          <div key={row.title} className="rows">
            <Bar title={row.title} ok={row.ok} n={row.n} />
            {Array.from(row.subs.values()).map((s) => (
              <Bar key={s.title} title={`— ${s.title}`} ok={s.ok} n={s.n} sub />
            ))}
          </div>
        ))}
      </div>
      {missed.length === 0 && (
        <div className="model"><b>All correct.</b> {mode === 'review' ? 'Every miss from this run is now answered right. Come back tomorrow and they will be due again.' : 'Nothing to review from this run.'}</div>
      )}
      {missed.length > 0 && (
        <>
          <div className="eyebrow">Misses · review them until a round comes back clean</div>
          <div className="misses">
            {missed.map((m, k) => (
              <div key={k} className="miss">
                <span>{m.expected}</span>
                <span>{m.given ? `wrote: ${m.given}` : 'blank'}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="row">
        {missed.length > 0 && <button className="btn accent grow" onClick={reviewMisses}>{mode === 'review' ? `Again: ${missed.length} still missed` : `Review the ${missed.length} misses`}</button>}
        <button className="btn secondary grow" onClick={() => navigate(`deck/${deckId}`)}>Done</button>
      </div>
    </div>
  );
}

function Bar({ title, ok, n, sub }: { title: string; ok: number; n: number; sub?: boolean }) {
  const pct = n ? (ok / n) * 100 : 0;
  return (
    <div className={`rrow ${sub ? 'sub' : ''}`}>
      <span>{title}</span>
      <span className="progress"><i className={pct < 60 ? 'bad' : ''} style={{ width: `${pct}%` }} /></span>
      <span className="n">{ok}/{n}</span>
    </div>
  );
}
