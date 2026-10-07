import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  MapPin,
  Bell,
  BellOff,
  Ban,
  Flag,
  Link2,
  Users,
  Sparkles,
  User,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { profiles as profilesApi } from '../lib/api'
import { getAvatarUrl } from '../lib/utils'
import { displayUsername } from '../lib/username'
import { LOOKING_FOR_OPTIONS } from '../lib/types'

export interface ChatInfoTarget {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
}

/** Minimal shape of the public profile returned by GET /api/profiles/:id */
interface InfoProfile {
  id: string
  username: string
  full_name: string
  bio?: string
  avatar_url?: string | null
  interests?: string[]
  looking_for?: string[]
  skills?: string[]
  city?: string | null
  region?: string | null
  country?: string | null
  country_code?: string | null
  last_active?: string | null
  blocked?: boolean
}

interface ChatInfoPanelProps {
  user: ChatInfoTarget
  online: boolean
  muted: boolean
  blocked: boolean
  /** Unique URLs extracted from the thread (real messages only). */
  sharedLinks: string[]
  /** My interests, to highlight the shared ones. */
  myInterests: string[]
  onToggleMute: () => void
  onBlock: () => void
  onReport: () => void
  /** Render the close button (mobile drawer). */
  onClose?: () => void
  className?: string
}

const LOOKING_FOR_LABELS: Record<string, string> = LOOKING_FOR_OPTIONS.reduce(
  (acc, opt) => ({ ...acc, [opt.value]: opt.label }),
  {} as Record<string, string>
)

/** ISO-3166 alpha-2 → flag emoji (regional indicator symbols). */
function flagEmoji(code?: string | null): string {
  if (!code || code.length !== 2) return ''
  const A = 0x1f1e6
  const base = 'A'.charCodeAt(0)
  const c1 = code[0].toUpperCase().charCodeAt(0) - base
  const c2 = code[1].toUpperCase().charCodeAt(0) - base
  if (c1 < 0 || c1 > 25 || c2 < 0 || c2 > 25) return ''
  return String.fromCodePoint(A + c1, A + c2)
}

/** "just now" / "5m ago" / "3h ago" / "2d ago" — for last seen. */
function relativeTime(iso?: string | null): string {
  if (!iso) return 'a while ago'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 'a while ago'
  const diff = Math.max(0, Date.now() - t)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(t).toLocaleDateString()
}

function labelFor(url: string): string {
  try {
    const u = new URL(url)
    return `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`
  } catch {
    return url
  }
}

/* ═══════════════════════════════════════════════════════════
   Chat info panel — replaces the old right sidebar inside Messages.
   Desktop: static column · Mobile: bottom drawer (passed by parent).
   ═══════════════════════════════════════════════════════════ */
export function ChatInfoPanel({
  user,
  online,
  muted,
  blocked,
  sharedLinks,
  myInterests,
  onToggleMute,
  onBlock,
  onReport,
  onClose,
  className = '',
}: ChatInfoPanelProps) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<InfoProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    profilesApi
      .get(user.id)
      .then((data) => {
        if (!cancelled) setProfile(data as unknown as InfoProfile)
      })
      .catch(() => {
        if (!cancelled) setProfile(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user.id])

  const interests = profile?.interests ?? []
  const lookingFor = profile?.looking_for ?? []
  const sharedInterests = interests.filter((i) =>
    myInterests.some((mine) => mine.toLowerCase() === i.toLowerCase())
  )

  // Approximate location only: city + region + country (never the free-text
  // `location` field, which could contain an exact address).
  const locationParts = [profile?.city, profile?.region, profile?.country].filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0
  )
  const flag = flagEmoji(profile?.country_code)

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header with close (drawer only) */}
      {onClose && (
        <div className="flex items-center justify-between border-b border-border-light px-4 py-3">
          <h3 className="text-sm font-bold text-text-primary">Chat info</h3>
          <button
            onClick={onClose}
            type="button"
            aria-label="Close chat info"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="space-y-5 p-5">
        {/* ── Identity ── */}
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <img
              src={getAvatarUrl(user.avatar_url, user.username)}
              alt={user.full_name}
              className="h-20 w-20 rounded-full object-cover ring-2 ring-accent/30"
            />
            <span
              className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-[3px] border-bg-primary ${
                online ? 'bg-success' : 'bg-slate-500'
              }`}
              aria-label={online ? 'Online' : 'Offline'}
            />
          </div>
          <p className="mt-3 w-full break-words px-2 text-base font-bold text-text-primary">
            {user.full_name}
          </p>
          <p className="text-xs text-text-muted">@{displayUsername(user.username)}</p>
          <p className={`mt-1 text-xs font-medium ${online ? 'text-success' : 'text-text-muted'}`}>
            {online ? 'Online now' : `Last seen ${relativeTime(profile?.last_active)}`}
          </p>
        </div>

        {blocked && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            You blocked this user. They cannot message you.
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
        )}

        {/* ── Bio ── */}
        {profile?.bio && (
          <p className="break-words text-xs leading-relaxed text-text-secondary">{profile.bio}</p>
        )}

        {/* ── Approximate location + flag ── */}
        {locationParts.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <MapPin className="h-4 w-4 shrink-0 text-accent" />
            <span className="break-words">
              {flag && <span className="mr-1.5">{flag}</span>}
              {locationParts.join(', ')}
            </span>
          </div>
        )}

        {/* ── Looking for ── */}
        {lookingFor.length > 0 && (
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
              <Users className="h-3.5 w-3.5" /> Looking for
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {lookingFor.map((lf) => (
                <span
                  key={lf}
                  className="rounded-full border border-accent/30 bg-accent-muted px-2.5 py-1 text-[11px] font-medium text-accent"
                >
                  {LOOKING_FOR_LABELS[lf] || lf.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── Interests (shared ones highlighted) ── */}
        {interests.length > 0 && (
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
              <Sparkles className="h-3.5 w-3.5" /> Interests
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {interests.map((interest) => {
                const isShared = sharedInterests.some(
                  (s) => s.toLowerCase() === interest.toLowerCase()
                )
                return (
                  <span
                    key={interest}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      isShared
                        ? 'border-purple-400/50 bg-purple-500/15 text-purple-200'
                        : 'border-border bg-bg-input text-text-secondary'
                    }`}
                  >
                    {interest}
                  </span>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Shared interests ── */}
        {sharedInterests.length > 0 && (
          <section className="rounded-xl border border-purple-400/30 bg-purple-500/10 p-3">
            <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-purple-300">
              Shared interests
            </h4>
            <p className="text-xs font-medium text-purple-100">
              {sharedInterests.join(' · ')}
            </p>
          </section>
        )}

        {/* ── Actions ── */}
        <div className="space-y-2">
          <button
            onClick={() => navigate(`/profile/${user.username}`)}
            type="button"
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-[0_0_16px_rgba(124,58,237,0.35)] transition-all hover:bg-accent-hover active:scale-[0.98]"
          >
            <User className="h-4 w-4" />
            View profile
          </button>
          <button
            onClick={onToggleMute}
            type="button"
            className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all active:scale-[0.98] ${
              muted
                ? 'border-accent/40 bg-accent-muted text-accent'
                : 'border-border-light bg-bg-card text-text-primary hover:bg-bg-card-hover'
            }`}
          >
            {muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            {muted ? 'Unmute notifications' : 'Mute notifications'}
          </button>
          <button
            onClick={onBlock}
            type="button"
            disabled={blocked}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Ban className="h-4 w-4" />
            {blocked ? 'Blocked' : 'Block'}
          </button>
          <button
            onClick={onReport}
            type="button"
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-medium text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
          >
            <Flag className="h-4 w-4" />
            Report
          </button>
        </div>

        {/* ── Shared links ── */}
        {sharedLinks.length > 0 && (
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
              <Link2 className="h-3.5 w-3.5" /> Shared links
            </h4>
            <div className="space-y-1.5">
              {sharedLinks.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-bg-input px-3 py-2 text-xs text-accent transition-colors hover:bg-bg-card-hover"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{labelFor(url)}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <footer className="px-1 pb-2">
          <p className="text-[11px] leading-relaxed text-text-muted">
            Only approximate profile data is shown here. Location is never exact.
          </p>
        </footer>
      </div>
    </div>
  )
}
