import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { Image, Hotspot } from '../content/types';
import { imageUrl } from '../content/load';
import { getUserImageUrl } from '../storage/idb';

export interface StickerSpec {
  hotspotIndex: number;
  label: string | number;
  state?: 'sel' | 'done' | 'wrong';
}

interface Props {
  image: Image;
  stickers?: StickerSpec[];
  focus?: number;
  zoom?: boolean;
  onZoomToggle?: (zoom: boolean) => void;
  showMasks?: boolean;
  onStickerTap?: (hotspotIndex: number) => void;
  onPointerDown?: (p: { x: number; y: number }) => void;
  onPointerUp?: (p: { x: number; y: number }) => void;
  children?: ReactNode;
  tools?: ReactNode;
}

export function markerOf(h: Hotspot): { x: number; y: number } {
  if (h.marker) return h.marker;
  const s = h.shape;
  if (s.kind === 'point') return { x: s.x, y: s.y };
  if (s.kind === 'rect') return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
  return { x: 0.5, y: 0.5 };
}

export function useImageSrc(image: Image): string | null {
  const [src, setSrc] = useState<string | null>(image.src.startsWith('idb:') ? null : imageUrl(image.src));
  useEffect(() => {
    let alive = true;
    if (image.src.startsWith('idb:')) {
      getUserImageUrl(image.src.slice(4)).then((u) => alive && setSrc(u));
    } else setSrc(imageUrl(image.src));
    return () => {
      alive = false;
    };
  }, [image.src]);
  return src;
}

export function ImageStage({ image, stickers = [], focus, zoom = false, onZoomToggle, showMasks = true, onStickerTap, onPointerDown, onPointerUp, children, tools }: Props) {
  const W = image.width;
  const H = image.height;
  const svgRef = useRef<SVGSVGElement>(null);
  const src = useImageSrc(image);

  let vx = 0, vy = 0, vw = W, vh = H;
  const focusHs = focus !== undefined ? image.hotspots[focus] : undefined;
  const canZoom = !!focusHs && focusHs.shape.kind !== 'whole';
  if (zoom && focusHs && canZoom) {
    const m = markerOf(focusHs);
    const s = focusHs.shape;
    const cx = s.kind === 'point' ? s.x : m.x;
    const cy = s.kind === 'point' ? s.y : m.y;
    vw = W * 0.45;
    vh = vw * 0.9;
    vx = Math.max(0, Math.min(W - vw, cx * W - vw / 2));
    vy = Math.max(0, Math.min(H - vh, cy * H - vh / 2));
  }
  const r = vw * 0.032;

  const toImage = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current!;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x / W, y: p.y / H };
  };

  return (
    <div className="imgstage">
      <svg
        ref={svgRef}
        viewBox={`${vx} ${vy} ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown ? (e) => onPointerDown(toImage(e)) : undefined}
        onPointerUp={onPointerUp ? (e) => onPointerUp(toImage(e)) : undefined}
      >
        {src && <image href={src} x={0} y={0} width={W} height={H} />}
        {showMasks && image.masks.map((m, i) => <rect key={i} className="mask" x={m.x * W} y={m.y * H} width={m.w * W} height={m.h * H} rx={2} />)}
        {children}
        {stickers.map((s, i) => {
          const h = image.hotspots[s.hotspotIndex];
          if (!h || h.shape.kind === 'whole') return null;
          const m = markerOf(h);
          const x = m.x * W;
          const y = m.y * H;
          return (
            <g key={s.hotspotIndex} className={`sticker ${s.state ?? ''}`} transform={`rotate(${((i % 3) - 1) * 7} ${x} ${y})`} onClick={onStickerTap ? () => onStickerTap(s.hotspotIndex) : undefined}>
              <circle cx={x} cy={y} r={r} />
              <text x={x} y={y} fontSize={r * 1.15}>
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="tools">
        {tools}
        {onZoomToggle && canZoom && (
          <>
            <button aria-pressed={!zoom} onClick={() => onZoomToggle(false)}>Whole</button>
            <button aria-pressed={zoom} onClick={() => onZoomToggle(true)}>Zoom</button>
          </>
        )}
      </div>
    </div>
  );
}
