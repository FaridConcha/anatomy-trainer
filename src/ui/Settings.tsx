import { useState } from 'react';
import { useContent, useRefreshUserImages } from '../App';
import { imageUrl } from '../content/load';
import { navigate } from '../router';
import { exportAll, importAll } from '../storage/exportImport';
import { progressStore, useProgress } from '../storage/local';

export function SettingsScreen() {
  const progress = useProgress();
  const idx = useContent();
  const refresh = useRefreshUserImages();
  const s = progress.settings;
  const set = (patch: Partial<typeof s>) => progressStore.update((st) => ({ ...st, settings: { ...st.settings, ...patch } }));
  const [status, setStatus] = useState('');
  const [confirmImport, setConfirmImport] = useState<File | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;

  const download = async () => {
    setStatus('Fetching every image for offline use…');
    let n = 0;
    for (const img of idx.content.images) {
      try {
        await fetch(imageUrl(img.src));
        n++;
      } catch {
        /* skip */
      }
    }
    setStatus(`Cached ${n} of ${idx.content.images.length} images.`);
  };

  const doExport = async () => {
    const blob = await exportAll(progressStore.get());
    const file = new File([blob], `anatomy-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Anatomy trainer backup' });
      } catch {
        /* cancelled */
      }
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    set({ lastExport: Date.now() });
  };

  const doImport = async () => {
    if (!confirmImport) return;
    try {
      const r = await importAll(confirmImport);
      progressStore.set(r.progress);
      await refresh();
      setStatus(`Imported ${Object.keys(r.progress.terms).length} term records and ${r.userImages} photos.`);
    } catch (e) {
      setStatus(`Import failed: ${String(e)}`);
    }
    setConfirmImport(null);
  };

  const days = s.lastExport ? Math.floor((Date.now() - s.lastExport) / 86400000) : null;

  return (
    <div className="screen">
      <div className="bar"><button className="back" onClick={() => navigate('')}>‹ Decks</button><span className="title">Settings</span><span className="meta" /></div>
      {!standalone && <div className="banner">Install this app (Share → Add to Home Screen, or File → Add to Dock on Mac) and use the installed copy. The installed app keeps its own progress.</div>}
      <div className="eyebrow">Drilling</div>
      <label className="toggle"><input type="checkbox" checked={s.strict} onChange={(e) => set({ strict: e.target.checked })} /> Strict spelling: a near-miss counts as wrong</label>
      <label className="toggle"><input type="checkbox" checked={s.zoomDefault} onChange={(e) => set({ zoomDefault: e.target.checked })} /> Start sticker questions zoomed in</label>
      <div className="row">
        <label className="field grow">Questions per session<input type="number" min={5} max={60} value={s.sessionCount} onChange={(e) => set({ sessionCount: +e.target.value || 15 })} /></label>
        <label className="field grow">Practical stations<input type="number" min={5} max={60} value={s.practicalCount} onChange={(e) => set({ practicalCount: +e.target.value || 20 })} /></label>
        <label className="field grow">Seconds each<input type="number" min={10} max={180} value={s.practicalSeconds} onChange={(e) => set({ practicalSeconds: +e.target.value || 45 })} /></label>
      </div>
      <div className="eyebrow">Backup</div>
      <div className="hint">{days === null ? 'Never exported. Export once a week so progress survives a cleared browser.' : `Last export ${days} day${days === 1 ? '' : 's'} ago.`}</div>
      <div className="row">
        <button className="btn secondary grow" onClick={doExport}>Export progress + photos</button>
        <label className="btn secondary grow" style={{ cursor: 'pointer' }}>
          Import
          <input type="file" accept="application/json" hidden onChange={(e) => setConfirmImport(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      {confirmImport && (
        <div className="banner">
          Replace all progress and photos with {confirmImport.name}?
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm" onClick={doImport}>Replace</button>
            <button className="btn sm secondary" onClick={() => setConfirmImport(null)}>Cancel</button>
          </div>
        </div>
      )}
      <div className="eyebrow">Offline</div>
      <button className="btn secondary" onClick={download}>Download all images for offline use</button>
      <div className="eyebrow">Danger</div>
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
      {status && <div className="hint">{status}</div>}
      <div className="hint">{Object.keys(progress.terms).length} terms tracked · {idx.content.images.length} images · content v{idx.content.version}</div>
    </div>
  );
}
