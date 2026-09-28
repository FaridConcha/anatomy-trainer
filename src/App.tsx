import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { buildIndexes, withImages, type Indexes } from './content/index';
import { loadContent } from './content/load';
import type { Content, Image } from './content/types';
import { useHash } from './router';
import { requestPersistence } from './storage/local';
import { listUserImages } from './storage/idb';
import { Home } from './ui/Home';
import { DeckScreen } from './ui/Deck';
import { SessionScreen } from './ui/Session';
import { SettingsScreen } from './ui/Settings';
import { AuthorScreen } from './author/Author';
import { TabBar } from './ui/TabBar';

const ContentCtx = createContext<{ idx: Indexes; refreshUserImages: () => Promise<void> } | null>(null);

export function useContent(): Indexes {
  const c = useContext(ContentCtx);
  if (!c) throw new Error('content not loaded');
  return c.idx;
}

export function useRefreshUserImages() {
  return useContext(ContentCtx)!.refreshUserImages;
}

export function App() {
  const [content, setContent] = useState<Content | null>(null);
  const [userImages, setUserImages] = useState<Image[]>([]);
  const [error, setError] = useState<string | null>(null);
  const route = useHash();

  const refreshUserImages = async () => {
    try {
      setUserImages((await listUserImages()).map((r) => r.image));
    } catch {
      /* IndexedDB unavailable */
    }
  };

  useEffect(() => {
    loadContent().then(setContent).catch((e) => setError(String(e)));
    refreshUserImages();
    requestPersistence();
  }, []);

  const idx = useMemo(() => (content ? buildIndexes(withImages(content, userImages)) : null), [content, userImages]);

  if (error) return <div className="app"><div className="screen"><div className="banner">Could not load content: {error}</div></div></div>;
  if (!idx) return <div className="app"><div className="screen"><div className="hint">Loading…</div></div></div>;

  const [head, a, b] = route.path;
  let screen;
  if (head === 'deck' && a) screen = <DeckScreen deckId={a} />;
  else if (head === 'play' && a && b) screen = <SessionScreen deckId={a} mode={b} />;
  else if (head === 'review') screen = <SessionScreen deckId={a ?? 'exam1'} mode="review" />;
  else if (head === 'settings') screen = <SettingsScreen />;
  else if (head === 'author') screen = <AuthorScreen imageId={a} />;
  else screen = <Home />;

  return (
    <ContentCtx.Provider value={{ idx, refreshUserImages }}>
      <div className="app">
        {screen}
        <TabBar current={head ?? ''} />
      </div>
    </ContentCtx.Provider>
  );
}
