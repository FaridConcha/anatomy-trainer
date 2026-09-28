import type { Content } from './types';

export async function loadContent(): Promise<Content> {
  const res = await fetch(`${import.meta.env.BASE_URL}content.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`content.json: ${res.status}`);
  return (await res.json()) as Content;
}

export function imageUrl(src: string): string {
  if (src.startsWith('idb:') || src.startsWith('blob:') || src.startsWith('data:')) return src;
  return `${import.meta.env.BASE_URL}${src}`;
}
