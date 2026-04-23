import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { AuthModal } from './components/AuthModal'
import { Layout } from './components/Layout'
import { OnboardingPage } from './pages/Onboarding'
import { FeedPage } from './pages/Feed'
import { TokenDetailPage } from './pages/TokenDetail'
import { PortfolioPage } from './pages/Portfolio'
import { WatchlistPage } from './pages/Watchlist'
import { WalletPage } from './pages/Wallet'
import { LeaderboardPage } from './pages/Leaderboard'
import { SettingsPage } from './pages/Settings'
import { ChartDemoPage } from './pages/ChartDemoPage'
import { APP_META_DESCRIPTION, APP_META_TITLE } from './branding'

const ONBOARDING_KEY = 'snipershot_onboarding_done'

function AppRoutes() {
  const { showAuthModal, closeAuthModal } = useAuth()
  const onboarded = localStorage.getItem(ONBOARDING_KEY)

  if (!onboarded) {
    return (
      <>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
        <AuthModal visible={showAuthModal} onClose={closeAuthModal} />
      </>
    )
  }

  return (
    <>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/feed" replace />} />
          <Route path="feed" element={<FeedPage />} />
          <Route path="token/:mint" element={<TokenDetailPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="chart-demo" element={<ChartDemoPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
      <AuthModal visible={showAuthModal} onClose={closeAuthModal} />
    </>
  )
}

export default function App() {
  useEffect(() => {
    document.title = APP_META_TITLE
    const descriptionTag = document.querySelector('meta[name="description"]')
    if (descriptionTag) {
      descriptionTag.setAttribute('content', APP_META_DESCRIPTION)
    }
  }, [])

  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
