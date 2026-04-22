export interface ActivityLogEntry {
  id: string
  type: 'auto-buy' | 'auto-sell' | 'info' | 'error'
  title: string
  detail: string
  createdAt: number
}

const ACTIVITY_LOG_KEY = 'solmint_activity_log'

export function loadActivityLog(): ActivityLogEntry[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_LOG_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ActivityLogEntry[]
  } catch {
    return []
  }
}

export function appendActivityLog(entry: Omit<ActivityLogEntry, 'id' | 'createdAt'>) {
  const next: ActivityLogEntry = {
    ...entry,
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    createdAt: Date.now(),
  }
  const existing = loadActivityLog()
  localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify([next, ...existing].slice(0, 100)))
}
