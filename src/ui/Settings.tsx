import { useState } from 'react';
import { useContent } from '../App';
import { navigate } from '../router';
import { progressStore, useProgress } from '../storage/local';

export function SettingsScreen() {
  const progress = useProgress();
  const idx = useContent();
  const s = progress.settings;
  const set = (patch: Partial<typeof s>) => progressStore.update((st) => ({ ...st, settings: { ...st.settings, ...patch } }));
  const [confirmReset, setConfirmReset] = useState(false);
  const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;

  return (
    <div className="screen">
      <div className="bar"><button className="back" onClick={() => navigate('')}>‹ Decks</button><span className="title">Settings</span><span className="meta" /></div>
      {!standalone && <div className="banner">Install this app (Share → Add to Home Screen, or File → Add to Dock on Mac) and use the installed copy. The installed app keeps its own progress.</div>}
      <div className="eyebrow">Drilling</div>
      <label className="toggle"><input type="checkbox" checked={s.strict} onChange={(e) => set({ strict: e.target.checked })} /> Strict spelling: a near-miss counts as wrong</label>
      <label className="toggle"><input type="checkbox" checked={s.zoomDefault} onChange={(e) => set({ zoomDefault: e.target.checked })} /> Start sticker questions zoomed in</label>
      <div className="row">
        <label className="field grow">Items per study session<input type="number" min={5} max={60} value={s.sessionCount} onChange={(e) => set({ sessionCount: +e.target.value || 15 })} /></label>
        <label className="field grow">Practical stations<input type="number" min={5} max={150} value={s.practicalCount} onChange={(e) => set({ practicalCount: +e.target.value || 100 })} /></label>
        <label className="field grow">Seconds each<input type="number" min={10} max={180} value={s.practicalSeconds} onChange={(e) => set({ practicalSeconds: +e.target.value || 45 })} /></label>
      </div>
      <div className="eyebrow">Progress</div>
      {confirmReset ? (
        <div className="banner">
          Erase all progress on this device?
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm" onClick={() => { progressStore.update((st) => ({ ...st, terms: {}, sessions: [] })); setConfirmReset(false); }}>Erase</button>
            <button className="btn sm secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn secondary" onClick={() => setConfirmReset(true)}>Reset progress</button>
      )}
      <div className="hint">{Object.keys(progress.terms).length} terms tracked · {progress.sessions.length} sessions · {idx.content.images.length} images</div>
    </div>
  );
}
