import { useState } from 'react'
import { Loader2, Save, Check, Shield, Mail, Lock, Eye, EyeOff, Bell, Palette } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function Settings() {
  const { profile } = useAuth()

  // Account settings
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // Preferences
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [theme, setTheme] = useState('dark')

  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'preferences'>('account')

  const tabs = [
    { id: 'account' as const, label: 'Account', icon: Mail },
    { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'preferences' as const, label: 'Preferences', icon: Bell },
  ]

  async function handleAccountSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSaved(false)
    // Simulate save
    await new Promise((r) => setTimeout(r, 800))
    setSaved(true)
    setLoading(false)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleSecuritySave(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) return
    setLoading(true)
    setSaved(false)
    await new Promise((r) => setTimeout(r, 800))
    setSaved(true)
    setLoading(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setTimeout(() => setSaved(false), 3000)
  }

  async function handlePreferencesSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSaved(false)
    await new Promise((r) => setTimeout(r, 800))
    setSaved(true)
    setLoading(false)
    setTimeout(() => setSaved(false), 3000)
  }

  const inputClass = 'w-full rounded-lg bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 min-h-[44px]'

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <header>
        <h1 className="text-xl font-bold text-text-primary md:text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">Manage your account and preferences.</p>
      </header>

      {/* ─── Tabs ─── */}
      <div className="scrollbar-hidden flex gap-1 overflow-x-auto rounded-xl bg-bg-card p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-all duration-200 min-h-[40px] ${
              activeTab === id
                ? 'bg-accent text-white shadow-[0_0_16px_rgba(124,58,237,0.3)]'
                : 'text-text-muted hover:bg-bg-card-hover hover:text-text-secondary'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ─── Account Tab ─── */}
      {activeTab === 'account' && (
        <form onSubmit={handleAccountSave} className="space-y-5 animate-fade-in">
          <section className="rounded-2xl bg-bg-card/80 backdrop-blur-xl p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">Email</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-muted">Current Email</label>
                <div className="flex items-center gap-2 rounded-lg bg-bg-input px-4 py-3">
                  <Mail className="h-4 w-4 text-text-muted" />
                  <span className="text-sm text-text-secondary">{profile?.username || 'user'}@codebuds.dev</span>
                  <span className="ml-auto rounded-md bg-success-muted px-2 py-0.5 text-[10px] font-bold text-success">Verified</span>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-muted">Change Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="new@email.com"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-bg-card/80 backdrop-blur-xl p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-secondary" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">Display</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-bg-input px-4 py-3">
                <div className="flex items-center gap-3">
                  <Palette className="h-4 w-4 text-text-muted" />
                  <div>
                    <p className="text-sm text-text-primary">Theme</p>
                    <p className="text-xs text-text-muted">Choose your preferred appearance</p>
                  </div>
                </div>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="rounded-lg bg-bg-card-hover px-3 py-2 text-xs font-bold text-white appearance-none cursor-pointer"
                >
                  <option value="dark">Dark</option>
                  <option value="midnight">Midnight</option>
                </select>
              </div>
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#7c3aed] px-6 py-3 text-sm font-bold text-white transition-all hover:from-[#60a5fa] hover:to-[#8b5cf6] hover:shadow-[0_0_24px_rgba(124,58,237,0.35)] active:scale-[0.98] disabled:opacity-50 min-h-[48px]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-success animate-fade-in">
                <Check className="h-4 w-4" />
                Saved
              </span>
            )}
          </div>
        </form>
      )}

      {/* ─── Security Tab ─── */}
      {activeTab === 'security' && (
        <form onSubmit={handleSecuritySave} className="space-y-5 animate-fade-in">
          <section className="rounded-2xl bg-bg-card/80 backdrop-blur-xl p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-danger" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">Change Password</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-muted">Current Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} pl-11 pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-muted">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} pl-11 pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-muted">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} pl-11`}
                  />
                </div>
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="mt-1.5 text-xs text-[#ef4444]">Passwords do not match</p>
                )}
              </div>
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || (newPassword !== '' && newPassword !== confirmPassword)}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#7c3aed] px-6 py-3 text-sm font-bold text-white transition-all hover:from-[#60a5fa] hover:to-[#8b5cf6] hover:shadow-[0_0_24px_rgba(124,58,237,0.35)] active:scale-[0.98] disabled:opacity-50 min-h-[48px]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              Update Password
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-success animate-fade-in">
                <Check className="h-4 w-4" />
                Password Updated
              </span>
            )}
          </div>
        </form>
      )}

      {/* ─── Preferences Tab ─── */}
      {activeTab === 'preferences' && (
        <form onSubmit={handlePreferencesSave} className="space-y-5 animate-fade-in">
          <section className="rounded-2xl bg-bg-card/80 backdrop-blur-xl p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">Notifications</h2>
            </div>
            <div className="space-y-3">
              <label className="flex items-center justify-between rounded-lg bg-bg-input px-4 py-3 cursor-pointer">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-text-muted" />
                  <div>
                    <p className="text-sm text-text-primary">Email Notifications</p>
                    <p className="text-xs text-text-muted">Receive activity updates via email</p>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="h-5 w-9 rounded-full bg-[#27272a] peer-checked:bg-[#7c3aed] transition-colors" />
                  <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                </div>
              </label>

              <label className="flex items-center justify-between rounded-lg bg-bg-input px-4 py-3 cursor-pointer">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-text-muted" />
                  <div>
                    <p className="text-sm text-text-primary">Push Notifications</p>
                    <p className="text-xs text-text-muted">Get real-time browser notifications</p>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={pushNotifications}
                    onChange={(e) => setPushNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="h-5 w-9 rounded-full bg-[#27272a] peer-checked:bg-[#7c3aed] transition-colors" />
                  <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                </div>
              </label>
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#7c3aed] px-6 py-3 text-sm font-bold text-white transition-all hover:from-[#60a5fa] hover:to-[#8b5cf6] hover:shadow-[0_0_24px_rgba(124,58,237,0.35)] active:scale-[0.98] disabled:opacity-50 min-h-[48px]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Preferences
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-success animate-fade-in">
                <Check className="h-4 w-4" />
                Saved
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
