import { useEffect, useState } from 'react'
import { Bot, CheckCircle2, CircleAlert } from 'lucide-react'
import { loadSniperConfig } from '../services/sniperConfig'
import { loadActivityLog, type ActivityLogEntry } from '../services/activityLog'

export function AutoTraderStatus() {
  const [enabled, setEnabled] = useState(loadSniperConfig().autoSnipe)
  const [entries, setEntries] = useState<ActivityLogEntry[]>(loadActivityLog().slice(0, 3))

  useEffect(() => {
    const interval = setInterval(() => {
      setEnabled(loadSniperConfig().autoSnipe)
      setEntries(loadActivityLog().slice(0, 3))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (!enabled && entries.length === 0) return null

  return (
    <div className="px-4 pt-3">
      <div className="rounded-2xl border border-dark-border bg-dark-card p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot size={14} className={enabled ? 'text-brand' : 'text-dark-subtext'} />
            <span className="text-dark-text text-sm font-semibold">Auto Trader</span>
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${enabled ? 'bg-brand/15 text-brand' : 'bg-dark-muted text-dark-subtext'}`}>
            {enabled ? 'ACTIVE' : 'IDLE'}
          </span>
        </div>
        {entries.length > 0 && (
          <div className="flex flex-col gap-1">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 text-xs">
                {entry.type === 'error'
                  ? <CircleAlert size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
                  : <CheckCircle2 size={12} className="text-brand mt-0.5 flex-shrink-0" />}
                <div className="min-w-0">
                  <div className="text-dark-text font-semibold">{entry.title}</div>
                  <div className="text-dark-subtext">{entry.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
