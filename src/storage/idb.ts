import { createStore, del, get, keys, set } from 'idb-keyval';
import type { Image } from '../content/types';

const store = createStore('anatomy-trainer', 'user-images');

export interface UserImageRecord {
  image: Image;
  blob: Blob;
  createdAt: number;
}

const urlCache = new Map<string, string>();

export async function putUserImage(rec: UserImageRecord): Promise<void> {
  await set(rec.image.id, rec, store);
  const old = urlCache.get(rec.image.id);
  if (old) URL.revokeObjectURL(old);
  urlCache.delete(rec.image.id);
}

export async function getUserImage(id: string): Promise<UserImageRecord | undefined> {
  return get<UserImageRecord>(id, store);
}

export async function listUserImages(): Promise<UserImageRecord[]> {
  const ks = await keys<string>(store);
  const recs = await Promise.all(ks.map((k) => get<UserImageRecord>(k, store)));
  return recs.filter((r): r is UserImageRecord => !!r).sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteUserImage(id: string): Promise<void> {
  await del(id, store);
  const old = urlCache.get(id);
  if (old) URL.revokeObjectURL(old);
  urlCache.delete(id);
}

export async function getUserImageUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const rec = await getUserImage(id);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(id, url);
  return url;
}

export async function fileToImageBlob(file: File, rotate = 0, maxEdge = 1600): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const swap = rotate % 180 !== 0;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
  bitmap.close();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', 0.85));
  return { blob, width: canvas.width, height: canvas.height };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}
