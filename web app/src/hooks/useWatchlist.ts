import { useState, useEffect, useCallback } from 'react'

const WATCHLIST_KEY = 'snapshot_watchlist'

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_KEY)
      if (raw) setWatchlist(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  const persist = (list: string[]) => {
    setWatchlist(list)
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list))
  }

  const addToWatchlist = useCallback((mint: string) => {
    setWatchlist((prev) => {
      if (prev.includes(mint)) return prev
      const next = [mint, ...prev]
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const removeFromWatchlist = useCallback((mint: string) => {
    setWatchlist((prev) => {
      const next = prev.filter((m) => m !== mint)
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const toggleWatchlist = useCallback((mint: string) => {
    setWatchlist((prev) => {
      const isIn = prev.includes(mint)
      const next = isIn ? prev.filter((m) => m !== mint) : [mint, ...prev]
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const isWatched = useCallback((mint: string) => watchlist.includes(mint), [watchlist])

  return { watchlist, addToWatchlist, removeFromWatchlist, toggleWatchlist, isWatched }
}
