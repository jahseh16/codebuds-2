import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, MessageCircle, Sparkles, Heart, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { matches as matchesApi } from '../lib/api'
import { getAvatarUrl } from '../lib/utils'
import { displayUsername } from '../lib/username'
import type { Match, Profile } from '../lib/types'

/* ─── Match Card ──────────────────────────────────────── */
function MatchCard({ match, other }: { match: Match; other: Profile }) {
  const navigate = useNavigate()

  return (
    <div className="rounded-2xl bg-bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 animate-fade-in border border-border-light">
      <div className="flex items-center gap-3">
        <div className="relative">
          <img
            src={getAvatarUrl(other.avatar_url, other.username)}
            alt={other.full_name}
            className="h-14 w-14 rounded-full object-cover ring-2 ring-accent/30"
          />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent">
            <Heart className="h-2.5 w-2.5 text-white" fill="currentColor" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-text-primary truncate">{other.full_name}</p>
          <p className="text-xs text-text-muted">@{displayUsername(other.username)}</p>
          {other.city && (
            <p className="text-[10px] text-text-muted mt-0.5">{other.city}</p>
          )}
        </div>
        <button
          onClick={() => navigate(`/messages/${other.username}`)}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-[0_0_16px_rgba(124,58,237,0.3)]"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Chat
        </button>
      </div>

      {/* Shared interests */}
      {other.interests && other.interests.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {other.interests.slice(0, 4).map(i => (
            <span key={i} className="rounded-md bg-bg-input px-1.5 py-0.5 text-[10px] text-text-muted">{i}</span>
          ))}
        </div>
      )}

      {/* Looking for */}
      {other.looking_for && other.looking_for.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {other.looking_for.map(lf => (
            <span key={lf} className="rounded-full bg-accent-muted px-2 py-0.5 text-[9px] font-medium text-accent">
              {lf.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      <p className="mt-2 text-[10px] text-text-muted">
        Matched {new Date(match.created_at).toLocaleDateString()}
      </p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MATCHES PAGE
   ═══════════════════════════════════════════════════════════ */
export function Matches() {
  const { profile, requireAuth } = useAuth()
  const [matchList, setMatchList] = useState<(Match & { other: Profile })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!profile) return
    setLoading(true)
    matchesApi.list()
      .then((data) => setMatchList(data as (Match & { other: Profile })[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [profile])

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Heart className="h-10 w-10 text-text-muted mb-3" />
        <p className="text-sm text-text-secondary">Sign in to see your matches</p>
      </div>
    )
  }

  const filtered = matchList.filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      m.other.full_name.toLowerCase().includes(q) ||
      m.other.username.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-text-primary md:text-2xl flex items-center gap-2">
          Matches
          {matchList.length > 0 && (
            <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-accent px-2 text-[11px] font-bold text-white">
              {matchList.length}
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">Your mutual connections — start a conversation!</p>
      </header>

      {/* Search */}
      {matchList.length > 0 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search matches..."
          className="w-full rounded-xl bg-bg-input px-4 py-3 text-sm text-text-primary transition-all placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
        />
      )}

      {/* Matches grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map(m => (
            <MatchCard key={m.id} match={m} other={m.other} />
          ))}
        </div>
      ) : matchList.length === 0 ? (
        <div className="animate-fade-in rounded-2xl bg-bg-card p-10 text-center sm:p-12 md:p-20">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted md:h-16 md:w-16">
            <Sparkles className="h-7 w-7 text-accent md:h-8 md:w-8" />
          </div>
          <p className="text-base font-medium text-text-primary md:text-lg">No matches yet</p>
          <p className="mt-1 text-sm text-text-muted">Go to Discover and send vibes to find your people!</p>
        </div>
      ) : (
        <div className="animate-fade-in rounded-2xl bg-bg-card p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-text-muted mb-2" />
          <p className="text-sm font-medium text-text-primary">No matches found</p>
          <p className="mt-1 text-xs text-text-muted">Try a different search term.</p>
        </div>
      )}
    </div>
  )
}
