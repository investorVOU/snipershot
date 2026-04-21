import { NavLink } from 'react-router-dom'
import { Zap, BarChart2, Star, Wallet, Settings } from 'lucide-react'

const NAV = [
  { to: '/feed', Icon: Zap, label: 'Feed' },
  { to: '/portfolio', Icon: BarChart2, label: 'Portfolio' },
  { to: '/watchlist', Icon: Star, label: 'Watchlist' },
  { to: '/wallet', Icon: Wallet, label: 'Wallet' },
  { to: '/settings', Icon: Settings, label: 'Settings' },
]

export function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-card border-t border-dark-border flex">
      {NAV.map(({ to, Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-brand' : 'text-dark-subtext'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={20} className={isActive ? 'text-brand' : ''} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
