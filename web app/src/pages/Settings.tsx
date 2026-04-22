import { useState } from 'react'
import { Settings, Bell, Shield, Palette, LogOut, Trash2, AlertTriangle, ChevronRight, Moon, Sun } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useNavigate } from 'react-router-dom'
import { loadSniperConfig, saveSniperConfig, type SniperConfig } from '../services/sniperConfig'

export function SettingsPage() {
  const navigate = useNavigate()
  const { user, isGuest, signOut, deleteAccount } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const [config, setConfig] = useState<SniperConfig>(loadSniperConfig)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const saveConfig = (updates: Partial<SniperConfig>) => {
    const next = { ...config, ...updates }
    setConfig(next)
    saveSniperConfig(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setDeleting(true)
    try {
      await deleteAccount()
      navigate('/', { replace: true })
    } catch {
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 pt-5 pb-3 border-b border-dark-border">
        <div className="flex items-center gap-2">
          <Settings size={20} className="text-brand" />
          <h1 className="text-dark-text font-bold text-xl">Settings</h1>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto flex flex-col gap-4">
        {/* Account */}
        {!isGuest && user && (
          <Section title="Account">
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-dark-text font-medium text-sm">{user.email}</div>
                <div className="text-dark-subtext text-xs mt-0.5">Signed in</div>
              </div>
              <button onClick={handleSignOut} className="flex items-center gap-1.5 text-dark-subtext hover:text-red-400 text-sm font-semibold transition-colors">
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </Section>
        )}

        {/* Sniper config */}
        <Section title="Auto Sniper" icon={<Shield size={14} className="text-brand" />}>
          <NumberField
            label="Take Profit"
            value={config.takeProfitPercent}
            unit="%"
            onChange={(v) => saveConfig({ takeProfitPercent: v })}
          />
          <NumberField
            label="Stop Loss"
            value={config.stopLossPercent}
            unit="%"
            onChange={(v) => saveConfig({ stopLossPercent: v })}
          />
          <NumberField
            label="Default Amount"
            value={config.defaultAmount}
            unit="SOL"
            step={0.01}
            onChange={(v) => saveConfig({ defaultAmount: v })}
          />
          <NumberField
            label="Default Slippage"
            value={config.defaultSlippage}
            unit="%"
            onChange={(v) => saveConfig({ defaultSlippage: v })}
          />
          <Toggle
            label="Auto Snipe"
            description="Automatically snipe safe tokens"
            value={config.autoSnipe}
            onChange={(v) => saveConfig({ autoSnipe: v })}
          />
          {config.autoSnipe && (
            <NumberField
              label="Max Auto Snipes"
              value={config.maxAutoSnipes}
              unit="tokens"
              onChange={(v) => saveConfig({ maxAutoSnipes: v })}
            />
          )}
          {saved && <p className="text-brand text-xs font-semibold text-right">Saved!</p>}
        </Section>

        {/* Appearance */}
        <Section title="Appearance" icon={<Palette size={14} className="text-brand" />}>
          <Toggle
            label="Dark Mode"
            description={isDark ? 'Dark theme enabled' : 'Light theme enabled'}
            value={isDark}
            onChange={() => toggleTheme()}
          />
        </Section>

        {/* Notifications */}
        <Section title="Notifications" icon={<Bell size={14} className="text-brand" />}>
          <div className="py-2 text-dark-subtext text-sm">
            Push notifications require the mobile app. Browser notifications coming soon.
          </div>
        </Section>

        {/* Platform info */}
        <Section title="Platform">
          <div className="flex items-center justify-between py-2">
            <span className="text-dark-subtext text-sm">Platform Fee</span>
            <span className="text-dark-text font-semibold text-sm">0.5% per swap</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-dark-subtext text-sm">Version</span>
            <span className="text-dark-text font-semibold text-sm">1.0.0</span>
          </div>
        </Section>

        {/* Danger zone */}
        {!isGuest && (
          <div className="rounded-xl border border-red-500/20 p-4">
            <h3 className="text-red-400 font-semibold text-sm mb-1 flex items-center gap-2">
              <AlertTriangle size={14} />
              Danger Zone
            </h3>
            <p className="text-dark-subtext text-xs mb-3">
              Permanently delete your account and all associated data. This cannot be undone.
            </p>

            {deleteConfirm && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-3">
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-xs">Are you absolutely sure? All trades, positions, and data will be deleted forever.</p>
              </div>
            )}

            <div className="flex gap-2">
              {deleteConfirm && (
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 py-2 rounded-lg bg-dark-muted text-dark-subtext text-sm font-semibold"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                  deleteConfirm ? 'flex-1 bg-red-500 text-white' : 'w-full bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'
                }`}
              >
                <Trash2 size={14} />
                {deleting ? 'Deleting…' : deleteConfirm ? 'Yes, Delete Everything' : 'Delete Account'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h2 className="text-dark-text font-semibold text-sm mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h2>
      <div className="flex flex-col divide-y divide-dark-border">
        {children}
      </div>
    </div>
  )
}

function NumberField({ label, value, unit, step = 1, onChange }: { label: string; value: number; unit: string; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-4">
      <span className="text-dark-subtext text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-20 bg-dark-muted border border-dark-border rounded-lg px-2 py-1.5 text-dark-text text-sm text-right focus:outline-none focus:border-brand/50"
        />
        <span className="text-dark-subtext text-sm">{unit}</span>
      </div>
    </div>
  )
}

function Toggle({ label, description, value, onChange }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <div className="text-dark-subtext text-sm">{label}</div>
        {description && <div className="text-dark-faint text-xs mt-0.5">{description}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-6 rounded-full transition-colors relative ${value ? 'bg-brand' : 'bg-dark-muted border border-dark-border'}`}
      >
        <span
          className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
          style={{ left: value ? '22px' : '4px' }}
        />
      </button>
    </div>
  )
}
