import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PumpfunToken } from '../services/pumpfun';
import { supabase } from '../services/supabase';

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

  const syncWatchlistAdd = useCallback((token: WatchlistToken) => {
    void supabase.from('watchlist').upsert({
      mint: token.mint,
      token_name: token.name,
      token_symbol: token.symbol,
      image_uri: token.imageUri ?? '',
      added_at: new Date(token.addedAt).toISOString(),
    }, { onConflict: 'mint' }).catch(() => {});
  }, []);

  const syncWatchlistRemove = useCallback((mint: string) => {
    void supabase.from('watchlist').delete().eq('mint', mint).catch(() => {});
  }, []);

  const addToWatchlist = useCallback((token: PumpfunToken) => {
    setWatchlist((prev) => {
      if (prev.some((t) => t.mint === token.mint)) return prev;
      const entry: WatchlistToken = { ...token, addedAt: Date.now() };
      const next: WatchlistToken[] = [entry, ...prev];
      save(next);
      syncWatchlistAdd(entry);
      return next;
    });
  }, [save, syncWatchlistAdd]);

  const removeFromWatchlist = useCallback((mint: string) => {
    setWatchlist((prev) => {
      const next = prev.filter((t) => t.mint !== mint);
      save(next);
      syncWatchlistRemove(mint);
      return next;
    });
  }, [save, syncWatchlistRemove]);

  const toggleWatchlist = useCallback((token: PumpfunToken) => {
    setWatchlist((prev) => {
      const exists = prev.some((t) => t.mint === token.mint);
      if (exists) {
        syncWatchlistRemove(token.mint);
        const next = prev.filter((t) => t.mint !== token.mint);
        save(next);
        return next;
      } else {
        const entry: WatchlistToken = { ...token, addedAt: Date.now() };
        syncWatchlistAdd(entry);
        const next = [entry, ...prev];
        save(next);
        return next;
      }
    });
  }, [save, syncWatchlistAdd, syncWatchlistRemove]);

  const isWatched = useCallback((mint: string) => watchlist.some((t) => t.mint === mint), [watchlist]);

  return { watchlist, addToWatchlist, removeFromWatchlist, toggleWatchlist, isWatched };
}
