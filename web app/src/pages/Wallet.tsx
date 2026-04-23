import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Wallet, Copy, Check, ExternalLink, QrCode, Send, RefreshCw, ArrowUpRight, ArrowDownLeft, X, Key, Eye, EyeOff, AlertTriangle, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { exportPrivateKeyBase58 } from '../services/walletService'
import { shortenAddress, toHttpUrl } from '../services/format'
import { fetchSOLPrice } from '../services/birdeye'
import { getSolBalance as fetchWalletSolBalance, sendSOL as executeSendSOL } from '../services/solana'
import { supabase } from '../services/supabase'
import { SwapPanel } from '../components/swap/SwapPanel'
import { CORE_SWAP_TOKENS, SOL_MINT, USDC_MINT, dedupeSwapTokens } from '../lib/tokens/catalog'
import { useSwap } from '../hooks/useSwap'
import type { SwapTokenOption } from '../types'
import { listRecentSwapHistory } from '../lib/supabase/swapRepository'

const HELIUS_RPC = import.meta.env.VITE_SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com'

const SOL_LOGO = 'https://statics.solscan.io/solscan-img/solana_icon.svg'

// Pinned tokens always shown as dedicated rows (like SOL)
const PINNED_TOKENS = [
  {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    name: 'USD Coin',
    symbol: 'USDC',
    logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  {
    mint: 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3',
    name: 'Seeker',
    symbol: 'SKR',
    logo: 'https://gateway.irys.xyz/uP1dFvCofZQT26m3SKOCttXrir3ORBR1B8wPhP6tv7M?ext=png',
  },
] as const

// Well-known token overrides — used to enrich the generic SPL list
const KNOWN_TOKEN_LOGOS: Record<string, { name: string; symbol: string; logo: string }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    name: 'USD Coin', symbol: 'USDC',
    logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3: {
    name: 'Seeker', symbol: 'SKR',
    logo: 'https://gateway.irys.xyz/uP1dFvCofZQT26m3SKOCttXrir3ORBR1B8wPhP6tv7M?ext=png',
  },
  So11111111111111111111111111111111111111112: {
    name: 'Wrapped SOL', symbol: 'SOL',
    logo: SOL_LOGO,
  },
}

interface SPLBalance {
  mint: string
  symbol: string
  name: string
  imageUri: string
  uiAmount: number
}

interface TxItem {
  signature: string
  type: string
  timestamp: number
  fee: number
  description?: string
}

async function getTokenBalance(walletAddress: string, mint: string): Promise<number> {
  try {
    const res = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getTokenAccountsByOwner',
        params: [walletAddress, { mint }, { encoding: 'jsonParsed' }],
      }),
    })
    const data = await res.json() as { result?: { value?: Array<{ account: { data: { parsed: { info: { tokenAmount: { uiAmount: number } } } } } }> } }
    const accounts = data.result?.value ?? []
    return accounts.reduce((sum, acc) => sum + (acc.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0)
  } catch { return 0 }
}

async function getSPLBalances(address: string, userId?: string): Promise<SPLBalance[]> {
  try {
    const res = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getTokenAccountsByOwner',
        params: [address, { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }],
      }),
    })
    const data = await res.json() as { result?: { value?: Array<{ account: { data: { parsed: { info: { mint: string; tokenAmount: { uiAmount: number } } } } } }> } }
    const onChain = (data.result?.value ?? [])
      .map((acc) => ({
        mint: acc.account.data.parsed.info.mint,
        uiAmount: acc.account.data.parsed.info.tokenAmount.uiAmount ?? 0,
      }))
      .filter((t) => t.uiAmount > 0)

    if (onChain.length === 0) return []

    // Enrich with token metadata from Supabase positions
    const metaMap = new Map<string, { symbol: string; name: string; imageUri: string }>()
    if (userId) {
      const mints = onChain.map((t) => t.mint)
      const { data: posRows } = await supabase
        .from('positions')
        .select('mint, token_symbol, token_name, token_image_uri')
        .eq('user_pubkey', userId)
        .in('mint', mints)
      const { data: tradeRows } = await supabase
        .from('trades')
        .select('mint, token_symbol, token_name, token_image_uri')
        .eq('user_pubkey', userId)
        .in('mint', mints)
      ;([...(posRows ?? []), ...(tradeRows ?? [])] as Record<string, unknown>[]).forEach((r) => {
        const m = r.mint as string
        if (m && !metaMap.has(m)) {
          metaMap.set(m, {
            symbol: (r.token_symbol as string) ?? m.slice(0, 4).toUpperCase(),
            name: (r.token_name as string) ?? 'Unknown',
            imageUri: (r.token_image_uri as string) ?? '',
          })
        }
      })
    }

    return onChain.map((t) => {
      const known = KNOWN_TOKEN_LOGOS[t.mint]
      const meta = metaMap.get(t.mint)
      const symbol = known?.symbol ?? meta?.symbol ?? t.mint.slice(0, 4).toUpperCase()
      const logo = known?.logo ?? meta?.imageUri ?? ''
      return {
        mint: t.mint,
        symbol,
        name: known?.name ?? meta?.name ?? t.mint.slice(0, 8) + '…',
        imageUri: logo,
        uiAmount: t.uiAmount,
      }
    })
  } catch { return [] }
}

async function getTxHistory(address: string): Promise<TxItem[]> {
  const heliusKey = import.meta.env.VITE_HELIUS_API_KEY
  if (!heliusKey) throw new Error('Missing Helius API key')
  const res = await fetch(`https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${heliusKey}&limit=20`)
  if (!res.ok) throw new Error(`Transaction history unavailable (${res.status})`)
  const data = await res.json() as Array<{ signature: string; type: string; timestamp: number; fee: number; description?: string }>
  return data.map((t) => ({ signature: t.signature, type: t.type ?? 'UNKNOWN', timestamp: t.timestamp * 1000, fee: t.fee ?? 0, description: t.description }))
}

function QRCodeDisplay({ value }: { value: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-white p-3 rounded-xl">
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=000000&margin=0`}
          alt="QR Code"
          width={180}
          height={180}
          className="rounded-lg"
        />
      </div>
      <p className="text-dark-subtext text-xs font-mono text-center break-all max-w-[220px]">{value}</p>
    </div>
  )
}

function ExportKeyModal({ wallet, onClose }: { wallet: NonNullable<ReturnType<typeof useAuth>['wallet']>; onClose: () => void }) {
  const [confirmed, setConfirmed] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const privateKey = exportPrivateKeyBase58(wallet)

  const copy = () => {
    navigator.clipboard.writeText(privateKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-dark-card rounded-2xl border border-dark-border p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-dark-text font-bold flex items-center gap-2"><Key size={16} className="text-brand" /> Export Private Key</h2>
          <button onClick={onClose} className="text-dark-subtext hover:text-dark-text"><X size={18} /></button>
        </div>

        {!confirmed ? (
          <>
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-3">
              <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-red-300 text-sm leading-relaxed">
                <p className="font-bold mb-1">Never share your private key</p>
                <p>Anyone with this key has full control of your wallet and all funds. The app will never ask you to send it to support or any admin.</p>
              </div>
            </div>
            <p className="text-dark-subtext text-sm">This wallet is generated in your browser and stored locally on this device, not behind a separate wallet password on our servers. Export it and store it somewhere safe and offline.</p>
            <button
              onClick={() => setConfirmed(true)}
              className="w-full py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 font-bold text-sm hover:bg-red-500/30 transition-colors"
            >
              I understand - show my private key
            </button>
          </>
        ) : (
          <>
            <div className="bg-dark-muted rounded-xl p-3 relative">
              <p className="text-dark-text font-mono text-xs break-all leading-relaxed select-all" style={{ filter: revealed ? 'none' : 'blur(6px)', userSelect: revealed ? 'all' : 'none' }}>
                {privateKey}
              </p>
              {!revealed && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                  <button onClick={() => setRevealed(true)} className="flex items-center gap-2 bg-dark-card border border-dark-border px-4 py-2 rounded-lg text-sm font-semibold text-dark-text hover:border-brand transition-colors">
                    <Eye size={14} /> Reveal
                  </button>
                </div>
              )}
            </div>
            {revealed && (
              <div className="flex gap-2">
                <button onClick={copy} className="flex-1 flex items-center justify-center gap-2 bg-dark-muted border border-dark-border rounded-xl py-2.5 text-sm font-semibold text-dark-text hover:border-brand transition-colors">
                  {copied ? <><Check size={14} className="text-brand" /> Copied!</> : <><Copy size={14} /> Copy Key</>}
                </button>
                <button onClick={() => setRevealed(false)} className="px-3 flex items-center justify-center bg-dark-muted border border-dark-border rounded-xl hover:border-dark-text transition-colors">
                  <EyeOff size={14} className="text-dark-subtext" />
                </button>
              </div>
            )}
            <p className="text-dark-faint text-xs text-center">This is your 64-byte private key in base58 format, importable into any Solana wallet.</p>
          </>
        )}
      </div>
    </div>
  )
}

export function WalletPage() {
  const location = useLocation()
  const { user, wallet, isGuest, openAuthModal } = useAuth()
  const userId = user?.id
  const [solBalance, setSolBalance] = useState<number | null>(null)
  const [solPrice, setSolPrice] = useState(0)
  const [pinnedBalances, setPinnedBalances] = useState<Record<string, number>>({})
  const [splBalances, setSplBalances] = useState<SPLBalance[]>([])
  const [txHistory, setTxHistory] = useState<TxItem[]>([])
  const [txHistoryError, setTxHistoryError] = useState('')
  const [recentSwaps, setRecentSwaps] = useState<import('../types').SwapHistoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [sendAddress, setSendAddress] = useState('')
  const [sendAmount, setSendAmount] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [sendError, setSendError] = useState('')
  const { swap, loading: swapLoading, error: swapError } = useSwap({ wallet })

  const walletAddress = wallet?.publicKey ?? null
  const preferredSwapMint = (location.state as { swapMint?: string } | null)?.swapMint ?? null

  const loadData = useCallback(async () => {
    if (!walletAddress) return
    setLoading(true)
    setTxHistoryError('')
    try {
      const txHistoryPromise = getTxHistory(walletAddress).catch((error) => {
        setTxHistoryError(error instanceof Error ? error.message : 'Unable to load transactions')
        return []
      })

      const [sol, spls, txs, price, swaps, ...pinnedAmounts] = await Promise.all([
        fetchWalletSolBalance(walletAddress).catch(() => 0),
        getSPLBalances(walletAddress, userId),
        txHistoryPromise,
        fetchSOLPrice(),
        listRecentSwapHistory(walletAddress).catch(() => []),
        ...PINNED_TOKENS.map((t) => getTokenBalance(walletAddress, t.mint)),
      ])
      setSolBalance(sol)
      setSplBalances(spls)
      setTxHistory(txs)
      setSolPrice(price as number)
      setRecentSwaps(swaps)
      setPinnedBalances(
        Object.fromEntries(PINNED_TOKENS.map((t, i) => [t.mint, pinnedAmounts[i] as number]))
      )
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    if (walletAddress) void loadData()
  }, [walletAddress, loadData])

  const copyAddress = () => {
    if (!walletAddress) return
    navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const solUSD = solBalance !== null && solPrice > 0 ? solBalance * solPrice : null
  const swapTokens = useMemo<SwapTokenOption[]>(() => dedupeSwapTokens([
    ...CORE_SWAP_TOKENS,
    ...PINNED_TOKENS.map<SwapTokenOption>((token) => ({
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      decimals: token.symbol === 'USDC' ? 6 : 9,
      logoURI: token.logo,
      source: 'wallet',
    })),
    ...splBalances.map<SwapTokenOption>((token) => ({
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      decimals: token.symbol === 'USDC' ? 6 : 9,
      logoURI: toHttpUrl(token.imageUri),
      source: 'wallet',
    })),
  ]), [splBalances])
  const initialInputToken = swapTokens.find((token) => token.mint === SOL_MINT) ?? swapTokens[0]
  const initialOutputToken = swapTokens.find((token) => token.mint === preferredSwapMint)
    ?? swapTokens.find((token) => token.mint === USDC_MINT)
    ?? swapTokens[1]
    ?? swapTokens[0]
  const balanceMap = useMemo<Record<string, number>>(() => ({
    [SOL_MINT]: solBalance ?? 0,
    ...Object.fromEntries(PINNED_TOKENS.map((token) => [token.mint, pinnedBalances[token.mint] ?? 0])),
    ...Object.fromEntries(splBalances.map((token) => [token.mint, token.uiAmount])),
  }), [solBalance, pinnedBalances, splBalances])
  const featuredSwapTokens = useMemo(() => {
    const recentTokens = recentSwaps.flatMap((entry) => [
      swapTokens.find((token) => token.mint === entry.input_mint),
      swapTokens.find((token) => token.mint === entry.output_mint),
    ]).filter((token): token is SwapTokenOption => !!token)
    return dedupeSwapTokens([
      ...CORE_SWAP_TOKENS,
      ...recentTokens,
      ...swapTokens.filter((token) => token.source === 'wallet'),
    ]).slice(0, 6)
  }, [recentSwaps, swapTokens])

  const handleSend = useCallback(async () => {
    if (!wallet) return
    const amount = parseFloat(sendAmount)
    if (!sendAddress.trim()) { setSendError('Enter a destination address'); return }
    if (!amount || amount <= 0) { setSendError('Enter a valid SOL amount'); return }
    if (solBalance !== null && amount > solBalance - 0.001) {
      setSendError(`Max: ${(solBalance - 0.001).toFixed(4)} SOL`)
      return
    }

    setSendBusy(true)
    setSendError('')
    try {
      await executeSendSOL(wallet, sendAddress.trim(), amount)
      setShowSend(false)
      setSendAddress('')
      setSendAmount('')
      await loadData()
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Send failed')
    } finally {
      setSendBusy(false)
    }
  }, [wallet, sendAddress, sendAmount, solBalance, loadData])

  // Not logged in
  if (!user && !isGuest) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-center max-w-xs">
          <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Wallet size={28} className="text-brand" />
          </div>
          <h2 className="text-dark-text font-bold text-lg">Sign in to access your wallet</h2>
          <p className="text-dark-subtext text-sm">Create an account to get a built-in Solana wallet generated in your browser - no extension needed.</p>
          <button onClick={openAuthModal} className="btn-primary w-full justify-center py-3">
            <LogIn size={16} /> Sign In
          </button>
        </div>
      </div>
    )
  }

  // Guest mode
  if (isGuest && !user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-center max-w-xs">
          <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Wallet size={28} className="text-brand" />
          </div>
          <h2 className="text-dark-text font-bold text-lg">Create an account for a wallet</h2>
          <p className="text-dark-subtext text-sm">Guest mode doesn't include a wallet. Sign up for free to get a built-in Solana address on this device.</p>
          <button onClick={openAuthModal} className="btn-primary w-full justify-center py-3">
            <LogIn size={16} /> Create Account
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 pt-5 pb-3 border-b border-dark-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={20} className="text-brand" />
          <h1 className="text-dark-text font-extrabold text-[22px]">Wallet</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dark-border text-dark-subtext text-xs font-semibold hover:text-dark-text hover:border-dark-text transition-colors"
          >
            <Key size={12} /> Export Key
          </button>
          {walletAddress && (
            <button onClick={loadData} disabled={loading} className="text-dark-subtext hover:text-brand transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto flex flex-col gap-4">
        {/* Address card */}
        {walletAddress && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              <span className="text-dark-subtext text-xs font-semibold">Built-in Wallet</span>
              <span className="ml-auto text-dark-faint text-[10px] font-semibold uppercase tracking-wide">Axyrion</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-dark-text font-mono text-sm flex-1 truncate">{shortenAddress(walletAddress, 10)}</span>
              <button onClick={copyAddress} className="text-dark-subtext hover:text-brand transition-colors">
                {copied ? <Check size={14} className="text-brand" /> : <Copy size={14} />}
              </button>
              <button onClick={() => setShowQR(true)} className="text-dark-subtext hover:text-brand transition-colors">
                <QrCode size={14} />
              </button>
              <a href={`https://solscan.io/account/${walletAddress}`} target="_blank" rel="noreferrer" className="text-dark-subtext hover:text-brand transition-colors">
                <ExternalLink size={14} />
              </a>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowSend(true)} className="flex-1 flex items-center justify-center gap-2 bg-brand text-[#08110d] font-bold py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity">
                <Send size={14} /> Send
              </button>
              <button onClick={() => setShowQR(true)} className="flex-1 flex items-center justify-center gap-2 bg-dark-muted text-dark-text font-semibold py-2.5 rounded-xl text-sm hover:bg-dark-border transition-colors border border-dark-border">
                <ArrowDownLeft size={14} /> Receive
              </button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-dark-faint">
              Security note: this wallet&apos;s private key is stored locally in this browser for transaction signing. We are not storing a separate wallet passphrase for you on the backend.
            </p>
          </div>
        )}

        {/* SOL + pinned token rows */}
        <div className="flex flex-col gap-2">
          {/* SOL */}
          <div className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#9945ff20] flex-shrink-0 overflow-hidden flex items-center justify-center">
                <img src={SOL_LOGO} alt="SOL" className="w-7 h-7 object-contain" />
              </div>
              <div>
                <div className="text-dark-text font-semibold">Solana</div>
                <div className="text-dark-subtext text-xs">SOL</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-dark-text font-bold">{loading ? '…' : solBalance !== null ? `◎${solBalance.toFixed(4)}` : '—'}</div>
              {solUSD !== null && <div className="text-dark-subtext text-xs">${solUSD.toFixed(2)}</div>}
            </div>
          </div>

          {/* USDC, SKR and any other pinned tokens */}
          {PINNED_TOKENS.map((pt) => (
            <div key={pt.mint} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-dark-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                  <img
                    src={pt.logo}
                    alt={pt.symbol}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
                <div>
                  <div className="text-dark-text font-semibold">{pt.name}</div>
                  <div className="text-dark-subtext text-xs">{pt.symbol}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-dark-text font-bold">
                  {loading ? '…' : (pinnedBalances[pt.mint] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </div>
                <div className="text-dark-subtext text-xs">{pt.symbol}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty wallet hint */}
        {solBalance !== null && solBalance === 0 && (
          <div className="card p-4 flex items-center gap-3 border-brand/20">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
              <ArrowDownLeft size={18} className="text-brand" />
            </div>
            <div className="flex-1">
              <div className="text-dark-text font-semibold text-sm">Fund your wallet</div>
              <div className="text-dark-subtext text-xs">Send SOL, USDC, or SKR to your address above to get started</div>
            </div>
          </div>
        )}

        {/* Other SPL tokens (excludes pinned mints to avoid duplicates) */}
        {splBalances.filter((t) => !PINNED_TOKENS.some((pt) => pt.mint === t.mint)).length > 0 && (
          <div>
            <h2 className="text-dark-subtext text-xs font-bold tracking-widest uppercase mb-2">Other Tokens</h2>
            <div className="flex flex-col gap-2">
              {splBalances
                .filter((t) => !PINNED_TOKENS.some((pt) => pt.mint === t.mint))
                .map((t) => (
                  <div key={t.mint} className="card p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-dark-muted flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold text-dark-subtext">
                        {toHttpUrl(t.imageUri)
                          ? <img src={toHttpUrl(t.imageUri)} alt={t.symbol} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          : t.symbol.slice(0, 2)
                        }
                      </div>
                      <div>
                        <div className="text-dark-text text-sm font-semibold">{t.name}</div>
                        <div className="text-dark-subtext text-xs">{t.symbol} · <span className="font-mono">{shortenAddress(t.mint)}</span></div>
                      </div>
                    </div>
                    <span className="text-dark-text font-semibold text-sm">{t.uiAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {walletAddress && swapTokens.length > 0 && (
          <SwapPanel
            key={preferredSwapMint ?? 'wallet-swap'}
            tokens={swapTokens}
            initialInputToken={initialInputToken}
            initialOutputToken={initialOutputToken}
            walletConnected={!!wallet && !!user}
            userWallet={walletAddress}
            loading={swapLoading}
            error={swapError}
            balances={balanceMap}
            featuredTokens={featuredSwapTokens}
            recentSwaps={recentSwaps}
            onSwap={async ({ inputToken, outputToken, amount, slippageBps }) => {
              const result = await swap({
                userWallet: walletAddress,
                inputToken,
                outputToken,
                inputAmount: amount,
                slippageBps,
              })
              await loadData()
              return result
            }}
          />
        )}

        {/* Tx history */}
        {txHistoryError && (
          <div>
            <h2 className="text-dark-subtext text-xs font-bold tracking-widest uppercase mb-2">Recent Transactions</h2>
            <div className="card p-3 text-sm text-yellow-400 font-semibold">Unable to load transactions</div>
          </div>
        )}
        {txHistory.length > 0 && (
          <div>
            <h2 className="text-dark-subtext text-xs font-bold tracking-widest uppercase mb-2">Recent Transactions</h2>
            <div className="flex flex-col gap-2">
              {txHistory.map((tx) => (
                <div key={tx.signature} className="card p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === 'SWAP' ? 'bg-brand/10' : 'bg-dark-muted'}`}>
                    {tx.type === 'TRANSFER' ? <ArrowUpRight size={14} className="text-[#14f195]" /> : <ArrowDownLeft size={14} className="text-brand" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-dark-text text-sm font-semibold truncate">{tx.description || tx.type}</div>
                    <div className="text-dark-subtext text-xs">{new Date(tx.timestamp).toLocaleDateString()}</div>
                  </div>
                  <a href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noreferrer" className="text-dark-subtext hover:text-brand transition-colors">
                    <ExternalLink size={13} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* QR Modal */}
      {showQR && walletAddress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowQR(false)}>
          <div className="bg-dark-card rounded-2xl border border-dark-border p-6 flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full">
              <h2 className="text-dark-text font-bold">Receive SOL</h2>
              <button onClick={() => setShowQR(false)} className="text-dark-subtext hover:text-dark-text"><X size={18} /></button>
            </div>
            <QRCodeDisplay value={walletAddress} />
            <button onClick={copyAddress} className="btn-ghost w-full justify-center text-sm">
              {copied ? <><Check size={14} className="text-brand" /> Copied!</> : <><Copy size={14} /> Copy Address</>}
            </button>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {showSend && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowSend(false)}>
          <div className="w-full max-w-sm bg-dark-card rounded-2xl border border-dark-border p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-dark-text font-bold flex items-center gap-2"><Send size={16} className="text-brand" /> Send SOL</h2>
              <button onClick={() => setShowSend(false)} className="text-dark-subtext hover:text-dark-text"><X size={18} /></button>
            </div>
            <div>
              <label className="text-dark-subtext text-sm font-semibold mb-1.5 block">Recipient Address</label>
              <input className="input text-sm" placeholder="Solana wallet address…" value={sendAddress} onChange={(e) => setSendAddress(e.target.value)} />
            </div>
            <div>
              <label className="text-dark-subtext text-sm font-semibold mb-1.5 block">Amount (SOL)</label>
              <div className="relative">
                <input className="input text-sm pr-12" type="number" placeholder="0.1" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-subtext text-sm font-bold">◎</span>
              </div>
              {solBalance !== null && (
                <button onClick={() => setSendAmount((solBalance - 0.001).toFixed(4))} className="text-brand text-xs mt-1">
                  Max: ◎{(solBalance - 0.001).toFixed(4)}
                </button>
              )}
            </div>
            {sendError && <p className="text-red-400 text-sm text-center">{sendError}</p>}
            <button
              onClick={handleSend}
              disabled={sendBusy}
              className="btn-primary w-full justify-center"
            >
              {sendBusy ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              Send SOL
            </button>
          </div>
        </div>
      )}

      {/* Export Key Modal */}
      {showExport && wallet && (
        <ExportKeyModal wallet={wallet} onClose={() => setShowExport(false)} />
      )}
    </div>
  )
}
