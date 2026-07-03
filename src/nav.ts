import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Route strings: 'players' | 'menu' | '<game>' | '<game>/<sceneId>'.
// On web the route lives in the URL hash so browser back/forward work; on
// native it's plain state.

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

function readHash(): string {
  if (!isWeb) return 'players';
  const h = window.location.hash.replace(/^#\/?/, '');
  return h || 'players';
}

export function useRoute(): [string, (r: string, opts?: { replace?: boolean }) => void] {
  const [route, setRoute] = useState<string>(() => readHash());

  useEffect(() => {
    if (!isWeb) return;
    const onPop = () => setRoute(readHash());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  const navigate = (r: string, opts?: { replace?: boolean }) => {
    setRoute(r);
    if (isWeb) {
      const url = `#/${r}`;
      if (opts?.replace) {
        window.history.replaceState(null, '', url);
      } else if (window.location.hash !== url) {
        window.history.pushState(null, '', url);
      }
    }
  };

  return [route, navigate];
}

export function routeParts(route: string): { screen: string; param?: string } {
  const [screen, param] = route.split('/');
  return { screen, param };
}
