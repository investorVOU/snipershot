import React from 'react';
import { WatchlistContext, useWatchlist } from '../hooks/useWatchlist';

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const wl = useWatchlist();
  return (
    <WatchlistContext.Provider
      value={{
        watchlist: wl.watchlist,
        toggleWatchlist: wl.toggleWatchlist,
        isWatched: wl.isWatched,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}
