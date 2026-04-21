import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Globe, Eye, Loader2, Crosshair } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'

type Mode = 'login' | 'signup'

const ONBOARDING_KEY = 'snipershot_onboarding_done'

export function LoginPage() {
  const navigate = useNavigate()
  const { user, isGuest, isLoading, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithTwitter, continueAsGuest } = useAuth()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [showResend, setShowResend] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (isLoading) return
    const onboarded = localStorage.getItem(ONBOARDING_KEY)
    if (!onboarded) { navigate('/onboarding', { replace: true }); return }
    if (user || isGuest) navigate('/feed', { replace: true })
  }, [user, isGuest, isLoading, navigate])

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) { setError('Enter email and password'); return }
    setError(''); setInfo(''); setShowResend(false); setBusy(true)
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email.trim(), password)
        setInfo('Account created! Check your email to confirm, then sign in.')
        setMode('login')
      } else {
        await signInWithEmail(email.trim(), password)
        navigate('/feed', { replace: true })
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
    setError(''); setBusy(true)
    try { await signInWithGoogle() } catch (e) { setError(e instanceof Error ? e.message : 'Google sign-in failed') }
    finally { setBusy(false) }
  }

  const handleTwitter = async () => {
    setError(''); setBusy(true)
    try { await signInWithTwitter() } catch (e) { setError(e instanceof Error ? e.message : 'Twitter sign-in failed') }
    finally { setBusy(false) }
  }

  const handleGuest = () => {
    continueAsGuest()
    navigate('/feed', { replace: true })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f16] flex flex-col items-center justify-center gap-4">
        <div className="w-24 h-24 rounded-[28px] bg-[#121925] border border-[#2d3745] flex items-center justify-center">
          <Crosshair size={48} className="text-brand" />
        </div>
        <span className="text-dark-text font-extrabold text-3xl tracking-tight">SniperShot</span>
        <Loader2 size={24} className="text-brand animate-spin mt-4" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0f16] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Hero */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-[28px] bg-[#121925] border-[1.5px] border-[#2d3745] flex items-center justify-center shadow-2xl">
            <Crosshair size={44} className="text-brand" />
          </div>
          <h1 className="text-dark-text font-extrabold text-[30px] tracking-tight">SniperShot</h1>
          <p className="text-[#7e8a99] text-[15px] text-center leading-relaxed">
            Snipe Solana memecoins{'\n'}the moment they launch
          </p>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-2.5">
          {/* Mode toggle */}
          <div className="flex bg-[#121925] rounded-xl p-1 gap-1">
            {(['login', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setInfo('') }}
                className={`flex-1 py-[9px] rounded-[10px] text-sm font-semibold transition-colors ${
                  mode === m ? 'bg-brand text-[#08110d]' : 'text-[#7e8a99]'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

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

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          {info && <p className="text-brand text-sm text-center">{info}</p>}
          {showResend && (
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-brand text-sm text-center underline disabled:opacity-40"
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend confirmation email'}
            </button>
          )}

          <button
            onClick={handleEmailAuth}
            disabled={busy}
            className="btn-primary w-full justify-center py-4 text-base"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <><Mail size={16} /> {mode === 'login' ? 'Sign In with Email' : 'Create Account'}</>}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#202b38]" />
          <span className="text-[#475261] text-xs">or continue with</span>
          <div className="flex-1 h-px bg-[#202b38]" />
        </div>

        {/* Social */}
        <div className="flex gap-3">
          <button
            onClick={handleGoogle}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 bg-[#121925] border border-[#202b38] rounded-xl py-3.5 text-[#dce1e6] text-sm font-semibold hover:bg-[#1a2535] transition-colors disabled:opacity-50"
          >
            <Globe size={16} /> Google
          </button>
          <button
            onClick={handleTwitter}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 bg-[#121925] border border-[#202b38] rounded-xl py-3.5 text-[#dce1e6] text-sm font-semibold hover:bg-[#1a2535] transition-colors disabled:opacity-50"
          >
            <span className="font-extrabold text-base leading-none">𝕏</span> Twitter / X
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#202b38]" />
          <span className="text-[#475261] text-xs">or</span>
          <div className="flex-1 h-px bg-[#202b38]" />
        </div>

        {/* Guest */}
        <button
          onClick={handleGuest}
          className="flex items-center justify-center gap-2 border-[1.5px] border-brand/30 bg-brand/[0.07] rounded-xl py-3.5 text-brand text-[15px] font-bold hover:bg-brand/10 transition-colors"
        >
          <Eye size={16} /> Browse as Guest
        </button>

        <p className="text-[#3c4653] text-[10px] text-center leading-4">
          By continuing you accept our Terms of Service.{'\n'}
          0.5% platform fee on all swaps.
        </p>
      </div>
    </div>
  )
}
