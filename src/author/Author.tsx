import { useEffect, useMemo, useRef, useState } from 'react';
import { useContent, useRefreshUserImages } from '../App';
import type { Image, Mask } from '../content/types';
import { navigate } from '../router';
import { deleteUserImage, fileToImageBlob, putUserImage } from '../storage/idb';
import { ImageStage, markerOf } from '../ui/ImageStage';

type Tool = 'point' | 'marker' | 'mask' | 'select';

export function AuthorScreen({ imageId }: { imageId?: string }) {
  const idx = useContent();
  if (!imageId) return <Library />;
  const image = idx.imagesById.get(imageId);
  if (!image) return <div className="screen"><div className="banner">Unknown image.</div></div>;
  return <Editor key={image.id} source={image} />;
}

function Library() {
  const idx = useContent();
  const refresh = useRefreshUserImages();
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const images = idx.content.images.filter((i) => !filter || i.id.includes(filter) || (i.title ?? '').toLowerCase().includes(filter.toLowerCase()));

  const importPhoto = async (file: File) => {
    setBusy(true);
    try {
      const { blob, width, height } = await fileToImageBlob(file);
      const id = `user.${Date.now().toString(36)}`;
      const image: Image = { id, src: `idb:${id}`, width, height, labId: 'lab5', groupIds: [], title: file.name.replace(/\.[^.]+$/, ''), hotspots: [], masks: [], source: 'user' };
      await putUserImage({ image, blob, createdAt: Date.now() });
      await refresh();
      navigate(`author/${id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <div className="bar"><span className="eyebrow">Author</span><span className="meta">{images.length} images</span></div>
      <div className="big">Hotspots and masks</div>
      <label className="btn accent" style={{ cursor: 'pointer' }}>
        {busy ? 'Importing…' : 'Add a photo of a lab model'}
        <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && importPhoto(e.target.files[0])} />
      </label>
      <input className="answer" style={{ padding: 10, borderRadius: 10, border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'inherit', font: 'inherit' }} placeholder="filter by id or title…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="list">
        {images.map((img) => (
          <button key={img.id} onClick={() => navigate(`author/${img.id}`)}>
            <span>{img.title ?? img.id}{img.source === 'user' ? ' · photo' : ''}</span>
            <span className="hint">{img.hotspots.length} hotspots · {img.masks.length} masks</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Editor({ source }: { source: Image }) {
  const idx = useContent();
  const refresh = useRefreshUserImages();
  const [image, setImage] = useState<Image>(() => structuredClone(source));
  const [tool, setTool] = useState<Tool>('point');
  const [selected, setSelected] = useState<number | null>(null);
  const [termFilter, setTermFilter] = useState('');
  const [termId, setTermId] = useState<string>('');
  const [status, setStatus] = useState('');
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Mask | null>(null);
  const [showMasks, setShowMasks] = useState(true);

  const groupTerms = useMemo(() => image.groupIds.flatMap((g) => idx.termsByGroup.get(g) ?? []), [image.groupIds, idx]);
  const assigned = new Set(image.hotspots.map((h) => h.termId));
  const candidates = useMemo(() => {
    const base = termFilter ? idx.content.terms.filter((t) => t.name.includes(termFilter.toLowerCase()) || t.id.includes(termFilter.toLowerCase())) : groupTerms;
    return base.slice(0, 60);
  }, [termFilter, groupTerms, idx]);

  useEffect(() => {
    if (!termId || (termFilter === '' && !groupTerms.some((t) => t.id === termId))) {
      const next = groupTerms.find((t) => !assigned.has(t.id)) ?? groupTerms[0];
      if (next) setTermId(next.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image.groupIds.join(','), image.hotspots.length]);

  const advanceTerm = () => {
    const next = groupTerms.find((t) => !assigned.has(t.id) && t.id !== termId);
    if (next) setTermId(next.id);
  };

  const onDown = (p: { x: number; y: number }) => {
    if (tool === 'mask') dragStart.current = p;
  };
  const onUp = (p: { x: number; y: number }) => {
    if (tool === 'point') {
      if (!termId) return;
      setImage((im) => ({ ...im, hotspots: [...im.hotspots, { termId, shape: { kind: 'point', x: +p.x.toFixed(4), y: +p.y.toFixed(4), r: 0.03 } }] }));
      setSelected(image.hotspots.length);
      advanceTerm();
    } else if (tool === 'marker' && selected !== null) {
      setImage((im) => ({ ...im, hotspots: im.hotspots.map((h, i) => (i === selected ? { ...h, marker: { x: +p.x.toFixed(4), y: +p.y.toFixed(4) } } : h)) }));
    } else if (tool === 'mask' && dragStart.current) {
      const s = dragStart.current;
      const m: Mask = { x: +Math.min(s.x, p.x).toFixed(4), y: +Math.min(s.y, p.y).toFixed(4), w: +Math.abs(p.x - s.x).toFixed(4), h: +Math.abs(p.y - s.y).toFixed(4) };
      if (m.w > 0.005 && m.h > 0.005) setImage((im) => ({ ...im, masks: [...im.masks, m] }));
      dragStart.current = null;
      setDraft(null);
    } else if (tool === 'select') {
      let best = -1, bd = 0.03;
      image.hotspots.forEach((h, i) => {
        const m = markerOf(h);
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        if (d < bd) { bd = d; best = i; }
      });
      setSelected(best >= 0 ? best : null);
    }
  };

  const removeSelected = () => {
    if (selected === null) return;
    setImage((im) => ({ ...im, hotspots: im.hotspots.filter((_, i) => i !== selected) }));
    setSelected(null);
  };
  const removeLastMask = () => setImage((im) => ({ ...im, masks: im.masks.slice(0, -1) }));
  const setSelectedTerm = (id: string) => selected !== null && setImage((im) => ({ ...im, hotspots: im.hotspots.map((h, i) => (i === selected ? { ...h, termId: id } : h)) }));

  const json = JSON.stringify({ ...image, source: undefined }, null, 1);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setStatus('JSON copied. Paste it into content/images/' + image.id + '.json');
    } catch {
      setStatus('Clipboard blocked; select the JSON below and copy it.');
    }
  };
  const save = async () => {
    const rec = await import('../storage/idb').then((m) => m.getUserImage(image.id));
    if (!rec) return;
    await putUserImage({ ...rec, image: { ...image, source: 'user' } });
    await refresh();
    setStatus('Saved to this device.');
  };
  const rotate = async () => {
    const rec = await import('../storage/idb').then((m) => m.getUserImage(image.id));
    if (!rec) return;
    const { blob, width, height } = await fileToImageBlob(new File([rec.blob], 'x.jpg', { type: rec.blob.type }), 90);
    const next: Image = { ...image, width, height, hotspots: [], masks: [] };
    await putUserImage({ image: next, blob, createdAt: rec.createdAt });
    await refresh();
    setImage(next);
    setStatus('Rotated; hotspots cleared.');
  };
  const remove = async () => {
    await deleteUserImage(image.id);
    await refresh();
    navigate('author');
  };
  const toggleGroup = (gid: string) => setImage((im) => ({ ...im, groupIds: im.groupIds.includes(gid) ? im.groupIds.filter((g) => g !== gid) : [...im.groupIds, gid] }));

  const isUser = image.source === 'user';
  const stickers = image.hotspots.map((_, i) => ({ hotspotIndex: i, label: i + 1, state: selected === i ? ('sel' as const) : undefined }));
  const W = image.width, H = image.height;

  return (
    <div className="screen">
      <div className="bar">
        <button className="back" onClick={() => navigate('author')}>‹ Library</button>
        <span className="title">{image.title ?? image.id}</span>
        <span className="meta">{image.hotspots.length} · {image.masks.length}</span>
      </div>
      <div className="author-tools">
        {(['point', 'marker', 'mask', 'select'] as Tool[]).map((t) => (
          <button key={t} aria-pressed={tool === t} onClick={() => setTool(t)}>{{ point: '● Point', marker: '◎ Marker', mask: '▭ Mask', select: '↖ Select' }[t]}</button>
        ))}
        <button onClick={() => setShowMasks((v) => !v)}>{showMasks ? 'Hide masks' : 'Show masks'}</button>
        <button onClick={removeLastMask} disabled={!image.masks.length}>Undo mask</button>
        <button onClick={removeSelected} disabled={selected === null}>Delete hotspot</button>
        {isUser && <button onClick={rotate}>↻ Rotate</button>}
      </div>
      <ImageStage image={image} stickers={stickers} showMasks={showMasks} onPointerDown={onDown} onPointerUp={onUp} onStickerTap={(i) => tool === 'select' && setSelected(i)}>
        {image.hotspots.map((h, i) => h.shape.kind === 'point' && (
          <g key={i} className={`hotpt ${selected === i ? 'sel' : ''}`}><circle cx={h.shape.x * W} cy={h.shape.y * H} r={h.shape.r * W} /></g>
        ))}
        {draft && <rect className="maskdraft" x={draft.x * W} y={draft.y * H} width={draft.w * W} height={draft.h * H} />}
      </ImageStage>
      <div className="hint">
        {tool === 'point' && 'Tap the structure to add a point for the term below; the list moves on to the next unassigned term.'}
        {tool === 'marker' && 'Tap where the sticker number should sit for the selected hotspot (e.g. on the masked answer box).'}
        {tool === 'mask' && 'Press and drag over any text that must be hidden.'}
        {tool === 'select' && 'Tap a sticker to select it, then change its term or delete it.'}
      </div>
      <div className="row">
        <input style={{ flex: 1, minWidth: 0, font: 'inherit', padding: 9, borderRadius: 10, border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'inherit' }} placeholder="search any term…" value={termFilter} onChange={(e) => setTermFilter(e.target.value)} />
      </div>
      <select value={selected !== null ? image.hotspots[selected].termId : termId} onChange={(e) => (selected !== null && tool === 'select' ? setSelectedTerm(e.target.value) : setTermId(e.target.value))}>
        {candidates.map((t) => (
          <option key={t.id} value={t.id}>{assigned.has(t.id) ? '✓ ' : ''}{t.name} · {idx.groupsById.get(t.groupId)?.title}</option>
        ))}
        {selected !== null && !candidates.some((t) => t.id === image.hotspots[selected].termId) && <option value={image.hotspots[selected].termId}>{image.hotspots[selected].termId}</option>}
      </select>
      <div className="eyebrow">Groups on this image</div>
      <div className="chips">
        {idx.content.groups.filter((g) => g.kind === 'structure' || g.kind === 'tissue' || g.kind === 'foramen').map((g) => (
          <button key={g.id} className={`chip ${image.groupIds.includes(g.id) ? 'sel' : 'dim'}`} onClick={() => toggleGroup(g.id)}>{g.title}</button>
        ))}
      </div>
      <div className="row">
        {isUser ? <button className="btn accent grow" onClick={save}>Save</button> : <button className="btn accent grow" onClick={copy}>Copy JSON</button>}
        {isUser && <button className="btn secondary" onClick={remove}>Delete photo</button>}
      </div>
      {status && <div className="hint">{status}</div>}
      <pre className="json">{json}</pre>
    </div>
  );
}

