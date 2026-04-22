import { useState } from 'react'
import { X, Mail, Globe, Eye, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../services/supabase'

type Mode = 'login' | 'signup'

interface AuthModalProps {
  visible: boolean
  onClose: () => void
}

export function AuthModal({ visible, onClose }: AuthModalProps) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithTwitter, continueAsGuest } = useAuth()
  const { colors } = useTheme()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [showResend, setShowResend] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  if (!visible) return null

  const reset = () => { setError(''); setInfo(''); setShowResend(false) }

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) { setError('Enter email and password'); return }
    reset(); setBusy(true)
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email.trim(), password)
        setInfo('Account created! Check your email to confirm, then sign in.')
        setMode('login')
      } else {
        await signInWithEmail(email.trim(), password)
        onClose()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Auth failed'
      if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Please confirm your email first. Check your inbox.')
        setShowResend(true)
      } else {
        setError(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || !email.trim()) return
    try {
      await supabase.auth.resend({ type: 'signup', email: email.trim() })
      setInfo('Confirmation email resent!')
      setResendCooldown(60)
      const iv = setInterval(() => {
        setResendCooldown((c) => { if (c <= 1) { clearInterval(iv); return 0 } return c - 1 })
      }, 1000)
    } catch {
      setError('Failed to resend. Try again.')
    }
  }

  const handleGoogle = async () => {
    reset(); setBusy(true)
    try { await signInWithGoogle() } catch (e) { setError(e instanceof Error ? e.message : 'Google sign-in failed'); setBusy(false) }
  }

  const handleTwitter = async () => {
    reset(); setBusy(true)
    try { await signInWithTwitter() } catch (e) { setError(e instanceof Error ? e.message : 'Twitter sign-in failed'); setBusy(false) }
  }

  const handleGuest = () => {
    continueAsGuest()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,12,18,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl shadow-2xl flex flex-col gap-5 p-6 relative" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}>
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-dark-subtext hover:text-dark-text transition-colors"
        >
          <X size={18} />
        </button>

        {/* Hero */}
        <div className="flex flex-col items-center gap-2 pt-1">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
            <span className="text-brand font-black text-3xl tracking-tight">S</span>
          </div>
          <h2 className="text-dark-text font-extrabold text-xl tracking-tight">Solmint</h2>
          <p className="text-dark-subtext text-xs text-center">Snipe Solana memecoins the moment they launch</p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-xl p-1 gap-1" style={{ backgroundColor: colors.card }}>
          {(['login', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); reset() }}
              className={`flex-1 py-2 rounded-[10px] text-sm font-semibold transition-colors ${
                mode === m ? 'bg-brand text-[#08110d]' : 'text-dark-subtext hover:text-dark-text'
              }`}
            >
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {/* Email form */}
        <div className="flex flex-col gap-2">
          <input
            className="input"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
          />

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          {info && <p className="text-brand text-xs text-center">{info}</p>}
          {showResend && (
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-brand text-xs text-center underline disabled:opacity-40"
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend confirmation email'}
            </button>
          )}

          <button
            onClick={handleEmailAuth}
            disabled={busy}
            className="btn-primary w-full justify-center py-3 text-sm"
          >
            {busy
              ? <Loader2 size={16} className="animate-spin" />
              : <><Mail size={14} /> {mode === 'login' ? 'Sign In with Email' : 'Create Account'}</>
            }
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ backgroundColor: colors.border }} />
          <span className="text-[11px]" style={{ color: colors.textMuted }}>or continue with</span>
          <div className="flex-1 h-px" style={{ backgroundColor: colors.border }} />
        </div>

        {/* Social */}
        <div className="flex gap-2">
          <button
            onClick={handleGoogle}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-dark-text text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}
          >
            <Globe size={14} /> Google
          </button>
          <button
            onClick={handleTwitter}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-dark-text text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}
          >
            <span className="font-extrabold text-sm leading-none">𝕏</span> Twitter
          </button>
        </div>

        {/* Guest */}
        <button
          onClick={handleGuest}
          className="flex items-center justify-center gap-2 border border-brand/30 bg-brand/[0.07] rounded-xl py-3 text-brand text-sm font-bold hover:bg-brand/10 transition-colors"
        >
          <Eye size={14} /> Browse as Guest
        </button>

        <p className="text-[10px] text-center" style={{ color: colors.textMuted }}>
          By continuing you accept our Terms of Service. 0.5% platform fee on swaps.
        </p>
      </div>
    </div>
  )
}
