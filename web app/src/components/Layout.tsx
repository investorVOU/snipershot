import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { AutoTrader } from './AutoTrader'
import { AutoTraderStatus } from './AutoTraderStatus'

export function Layout() {
  return (
    <div className="min-h-screen bg-dark-bg flex">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <AutoTrader />
        <AutoTraderStatus />
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
