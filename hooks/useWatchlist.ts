import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PumpfunToken } from '../services/pumpfun';

const WATCHLIST_KEY = 'snapshot_watchlist';

export interface WatchlistToken extends PumpfunToken {
  addedAt: number;
}

export interface WatchlistContextType {
  watchlist: WatchlistToken[];
  toggleWatchlist: (token: PumpfunToken) => void;
  isWatched: (mint: string) => boolean;
}

export const WatchlistContext = createContext<WatchlistContextType>({
  watchlist: [],
  toggleWatchlist: () => {},
  isWatched: () => false,
});

export const useWatchlistContext = () => useContext(WatchlistContext);

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistToken[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(WATCHLIST_KEY)
      .then((raw) => { if (raw) setWatchlist(JSON.parse(raw)); })
      .catch(() => {});
  }, []);

  const save = useCallback((items: WatchlistToken[]) => {
    AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(items)).catch(() => {});
  }, []);

  const addToWatchlist = useCallback((token: PumpfunToken) => {
    setWatchlist((prev) => {
      if (prev.some((t) => t.mint === token.mint)) return prev;
      const next: WatchlistToken[] = [{ ...token, addedAt: Date.now() }, ...prev];
      save(next);
      return next;
    });
  }, [save]);

  const removeFromWatchlist = useCallback((mint: string) => {
    setWatchlist((prev) => {
      const next = prev.filter((t) => t.mint !== mint);
      save(next);
      return next;
    });
  }, [save]);

  const toggleWatchlist = useCallback((token: PumpfunToken) => {
    setWatchlist((prev) => {
      const exists = prev.some((t) => t.mint === token.mint);
      const next = exists
        ? prev.filter((t) => t.mint !== token.mint)
        : [{ ...token, addedAt: Date.now() }, ...prev];
      save(next);
      return next;
    });
  }, [save]);

  const isWatched = useCallback((mint: string) => watchlist.some((t) => t.mint === mint), [watchlist]);

  return { watchlist, addToWatchlist, removeFromWatchlist, toggleWatchlist, isWatched };
}
