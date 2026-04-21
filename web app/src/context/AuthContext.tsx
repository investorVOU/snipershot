import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'
import { getOrCreateWallet, deleteWallet, type EmbeddedWallet } from '../services/walletService'

interface AuthContextValue {
  user: User | null
  session: Session | null
  isLoading: boolean
  isGuest: boolean
  wallet: EmbeddedWallet | null
  showAuthModal: boolean
  openAuthModal: () => void
  closeAuthModal: () => void
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithTwitter: () => Promise<void>
  continueAsGuest: () => void
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(false)
  const [wallet, setWallet] = useState<EmbeddedWallet | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const openAuthModal = () => setShowAuthModal(true)
  const closeAuthModal = () => setShowAuthModal(false)

  // Load/create embedded wallet whenever a real user is set
  const hydrateWallet = (u: User | null) => {
    if (u) {
      setWallet(getOrCreateWallet(u.id))
    } else {
      setWallet(null)
    }
  }

  useEffect(() => {
    const loadingTimeout = setTimeout(() => setIsLoading(false), 5000)

    supabase.auth.getSession()
      .then(({ data }) => {
        setSession(data.session)
        setUser(data.session?.user ?? null)
        hydrateWallet(data.session?.user ?? null)
      })
      .catch(() => { /* no active session */ })
      .finally(() => {
        clearTimeout(loadingTimeout)
        setIsLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      hydrateWallet(session?.user ?? null)
      if (session) { setIsGuest(false); setShowAuthModal(false) }
    })

    const guestFlag = localStorage.getItem('snipershot_guest')
    if (guestFlag === 'true') setIsGuest(true)

    return () => subscription.unsubscribe()
  }, [])

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) throw error
  }

  const signInWithTwitter = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'twitter',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) throw error
  }

  const continueAsGuest = () => {
    localStorage.setItem('snipershot_guest', 'true')
    setIsGuest(true)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('snipershot_guest')
    setIsGuest(false)
    setWallet(null)
  }

  const deleteAccount = async () => {
    if (!user) return
    const uid = user.id

    const keysToDelete = [
      'snapshot_feed_cache',
      'snapshot_watchlist',
      'snapshot_positions',
      'snapshot_sniper_config',
      'snapshot_price_alerts',
      'snipershot_guest',
    ]
    keysToDelete.forEach((k) => localStorage.removeItem(k))
    deleteWallet(uid)

    await supabase.from('trades').delete().eq('user_pubkey', uid)
    await supabase.from('fee_events').delete().eq('user_pubkey', uid)
    await supabase.from('positions').delete().eq('user_pubkey', uid)
    await supabase.auth.signOut()
    setWallet(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      isGuest,
      wallet,
      showAuthModal,
      openAuthModal,
      closeAuthModal,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signInWithTwitter,
      continueAsGuest,
      signOut,
      deleteAccount,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
