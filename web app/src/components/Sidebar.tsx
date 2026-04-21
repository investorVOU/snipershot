import { NavLink } from 'react-router-dom'
import { Zap, BarChart2, Star, Wallet, Trophy, Settings, LogOut, Crosshair, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/feed', Icon: Zap, label: 'Live Feed' },
  { to: '/portfolio', Icon: BarChart2, label: 'Portfolio' },
  { to: '/watchlist', Icon: Star, label: 'Watchlist' },
  { to: '/wallet', Icon: Wallet, label: 'Wallet' },
  { to: '/leaderboard', Icon: Trophy, label: 'Leaderboard' },
  { to: '/settings', Icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const { user, isGuest, signOut, openAuthModal } = useAuth()

  return (
    <aside className="hidden lg:flex flex-col w-[240px] flex-shrink-0 h-screen sticky top-0 bg-dark-card border-r border-dark-border px-3 py-5">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 mb-8">
        <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
          <Crosshair size={18} className="text-brand" />
        </div>
        <span className="text-dark-text font-bold text-lg tracking-tight">SniperShot</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-brand/10 text-brand'
                  : 'text-dark-subtext hover:text-dark-text hover:bg-dark-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} className={isActive ? 'text-brand' : ''} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User / logout */}
      <div className="mt-auto border-t border-dark-border pt-4">
        {isGuest || !user ? (
          <div className="px-3">
            {isGuest && <div className="text-dark-subtext text-xs mb-2">Guest mode</div>}
            <button onClick={openAuthModal} className="btn-primary text-sm py-2 w-full justify-center flex items-center gap-2">
              <LogIn size={14} /> Sign In
            </button>
          </div>
        ) : (
          <div className="px-3">
            <div className="text-dark-text text-sm font-semibold truncate mb-1">{user?.email ?? 'User'}</div>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 text-dark-subtext hover:text-red-400 text-sm font-semibold transition-colors"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
