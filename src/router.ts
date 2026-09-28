import { useEffect, useState } from 'react';

export interface Route {
  path: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [p, q = ''] = hash.split('?');
  return { path: p.split('/').filter(Boolean), query: new URLSearchParams(q) };
}

export function useHash(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(to: string) {
  window.location.hash = to.startsWith('#') ? to : `#/${to.replace(/^\//, '')}`;
}
