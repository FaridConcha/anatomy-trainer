import type { Image } from '../content/types';
import { defaultProgress, defaultSettings, type ProgressState } from '../engine/progress';
import { blobToDataUrl, dataUrlToBlob, listUserImages, putUserImage } from './idb';

interface Backup {
  version: 1;
  exportedAt: string;
  progress: ProgressState;
  userImages: { image: Image; dataUrl: string; createdAt: number }[];
}

export async function exportAll(progress: ProgressState): Promise<Blob> {
  const recs = await listUserImages().catch(() => []);
  const userImages = await Promise.all(recs.map(async (r) => ({ image: r.image, dataUrl: await blobToDataUrl(r.blob), createdAt: r.createdAt })));
  const backup: Backup = { version: 1, exportedAt: new Date().toISOString(), progress, userImages };
  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

export async function importAll(file: File): Promise<{ progress: ProgressState; userImages: number }> {
  const backup = JSON.parse(await file.text()) as Backup;
  if (backup.version !== 1 || !backup.progress) throw new Error('not a trainer backup');
  const progress: ProgressState = { ...defaultProgress(), ...backup.progress, settings: { ...defaultSettings, ...backup.progress.settings } };
  let n = 0;
  for (const u of backup.userImages ?? []) {
    await putUserImage({ image: u.image, blob: await dataUrlToBlob(u.dataUrl), createdAt: u.createdAt });
    n++;
  }
  return { progress, userImages: n };
}
