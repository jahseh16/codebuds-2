import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, Heart, X, MapPin, Clock, Sparkles, ChevronDown,
  SlidersHorizontal, Zap, Users, BookOpen, Gamepad2, Briefcase, HeartHandshake,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { discover as discoverApi, vibes as vibesApi } from '../lib/api'
import { getAvatarUrl, getFlagEmoji } from '../lib/utils'
import { displayUsername } from '../lib/username'
import { LOOKING_FOR_OPTIONS, INTEREST_OPTIONS, AGE_RANGE_OPTIONS } from '../lib/types'
import type { Profile } from '../lib/types'

/* ─── Country list for filter ───────────────────────── */
const COUNTRIES: { code: string; name: string }[] = [
  { code: 'AR', name: 'Argentina' }, { code: 'BO', name: 'Bolivia' },
  { code: 'BR', name: 'Brazil' }, { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' }, { code: 'CR', name: 'Costa Rica' },
  { code: 'CU', name: 'Cuba' }, { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' }, { code: 'SV', name: 'El Salvador' },
  { code: 'GT', name: 'Guatemala' }, { code: 'HN', name: 'Honduras' },
  { code: 'MX', name: 'Mexico' }, { code: 'NI', name: 'Nicaragua' },
  { code: 'PA', name: 'Panama' }, { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' }, { code: 'PR', name: 'Puerto Rico' },
  { code: 'ES', name: 'Spain' }, { code: 'UY', name: 'Uruguay' },
  { code: 'VE', name: 'Venezuela' }, { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' }, { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' }, { code: 'PT', name: 'Portugal' },
  { code: 'NL', name: 'Netherlands' }, { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' }, { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' }, { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czech Republic' }, { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' }, { code: 'IE', name: 'Ireland' },
  { code: 'AU', name: 'Australia' }, { code: 'NZ', name: 'New Zealand' },
  { code: 'JP', name: 'Japan' }, { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' }, { code: 'IN', name: 'India' },
  { code: 'RU', name: 'Russia' }, { code: 'UA', name: 'Ukraine' },
  { code: 'TR', name: 'Turkey' }, { code: 'IL', name: 'Israel' },
  { code: 'ZA', name: 'South Africa' }, { code: 'NG', name: 'Nigeria' },
  { code: 'EG', name: 'Egypt' }, { code: 'KE', name: 'Kenya' },
  { code: 'PH', name: 'Philippines' }, { code: 'ID', name: 'Indonesia' },
  { code: 'TH', name: 'Thailand' }, { code: 'VN', name: 'Vietnam' },
  { code: 'MY', name: 'Malaysia' }, { code: 'SG', name: 'Singapore' },
]

/* ─── Looking-for icon map ────────────────────────────── */
const LOOKING_FOR_ICONS: Record<string, typeof Heart> = {
  study_buddy: BookOpen,
  project_collab: Briefcase,
  gaming_buddy: Gamepad2,
  mentor: Users,
  dating: HeartHandshake,
}

const LOOKING_FOR_COLORS: Record<string, string> = {
  study_buddy: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  project_collab: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  gaming_buddy: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  mentor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  dating: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
}

/* ─── VibeCard Component ──────────────────────────────── */
function VibeCard({
  profile: p,
  onConnect,
  onSkip,
  matchScore,
}: {
  profile: Profile & { match_score?: number; shared_interests?: string[] }
  onConnect: () => void
  onSkip: () => void
  matchScore?: number
}) {
  const navigate = useNavigate()

  return (
    <div className="relative w-full max-w-sm mx-auto rounded-2xl bg-bg-card overflow-hidden shadow-2xl shadow-black/40 animate-fade-in">
      {/* Header gradient */}
      <div className="h-24 bg-gradient-to-br from-violet-600/20 via-blue-600/15 to-transparent relative">
        {matchScore != null && matchScore > 0 && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-1 text-[10px] font-bold text-accent backdrop-blur-sm border border-accent/30">
            <Sparkles className="h-3 w-3" />
            {matchScore}% match
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className="flex justify-center -mt-12">
        <img
          src={getAvatarUrl(p.avatar_url, p.username)}
          alt={p.full_name}
          className="w-20 h-20 rounded-full bg-bg-primary object-cover ring-4 ring-bg-card"
        />
      </div>

      {/* Info */}
      <div className="px-5 pt-3 pb-4 text-center">
        <h2 className="text-lg font-bold text-text-primary">{p.full_name}</h2>
        <p className="text-xs text-text-muted">@{displayUsername(p.username)}</p>

        {/* City + Country with flag */}
        {(p.city || p.country) && (
          <p className="mt-1.5 flex items-center justify-center gap-1 text-xs text-text-secondary">
            <MapPin className="h-3 w-3" />
            {getFlagEmoji(p.country_code)} {p.city || ''}{p.city && p.country ? ', ' : ''}{p.country || ''}
          </p>
        )}

        {/* Looking for */}
        {p.looking_for && p.looking_for.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {p.looking_for.map((lf) => {
              const Icon = LOOKING_FOR_ICONS[lf] || Zap
              const color = LOOKING_FOR_COLORS[lf] || 'bg-accent/15 text-accent border-accent/30'
              return (
                <span key={lf} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${color}`}>
                  <Icon className="h-2.5 w-2.5" />
                  {lf.replace(/_/g, ' ')}
                </span>
              )
            })}
          </div>
        )}

        {/* Bio */}
        {p.bio && (
          <p className="mt-3 text-xs text-text-secondary line-clamp-2 leading-relaxed">{p.bio}</p>
        )}

        {/* Shared interests */}
        {p.interests && p.interests.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1">
            {p.interests.slice(0, 5).map((i) => (
              <span key={i} className="rounded-md bg-bg-input px-2 py-0.5 text-[10px] text-text-muted">
                {i}
              </span>
            ))}
            {p.interests.length > 5 && (
              <span className="text-[10px] text-text-muted">+{p.interests.length - 5}</span>
            )}
          </div>
        )}

        {/* Skills */}
        {p.skills && p.skills.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-1">
            {p.skills.slice(0, 4).map((s) => (
              <span key={s} className="rounded-md bg-accent-muted px-2 py-0.5 text-[10px] font-medium text-accent">
                {s}
              </span>
            ))}
          </div>
        )}

        {/* View profile link */}
        <button
          onClick={() => navigate(`/profile/${p.username}`)}
          className="mt-3 text-[11px] text-accent hover:text-accent-hover transition-colors"
        >
          View full profile →
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-6 px-5 pb-5">
        <button
          onClick={onSkip}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-input text-text-muted transition-all hover:bg-danger/10 hover:text-danger hover:scale-110 border border-border-light"
          title="Skip"
        >
          <X className="h-6 w-6" />
        </button>
        <button
          onClick={onConnect}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white transition-all hover:scale-110 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)]"
          title="Send vibe"
        >
          <Heart className="h-7 w-7" />
        </button>
      </div>
    </div>
  )
}

/* ─── Filters Panel ───────────────────────────────────── */
function FiltersPanel({
  filters,
  onChange,
  onClose,
}: {
  filters: { looking_for: string; interests: string; city: string; age_range: string; country: string; region: string }
  onChange: (f: typeof filters) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-bg-card p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-accent" />
            Discover Filters
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg">&times;</button>
        </div>

        <div className="space-y-4">
          {/* Looking for */}
          <div>
            <label className="block text-[11px] font-semibold text-text-muted mb-1.5">Looking for</label>
            <select
              value={filters.looking_for}
              onChange={(e) => onChange({ ...filters, looking_for: e.target.value })}
              className="w-full rounded-xl bg-bg-input px-3 py-2.5 text-sm text-text-primary border border-border-light focus:border-accent focus:outline-none"
            >
              <option value="">Any</option>
              {LOOKING_FOR_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Interests */}
          <div>
            <label className="block text-[11px] font-semibold text-text-muted mb-1.5">Interests</label>
            <select
              value={filters.interests}
              onChange={(e) => onChange({ ...filters, interests: e.target.value })}
              className="w-full rounded-xl bg-bg-input px-3 py-2.5 text-sm text-text-primary border border-border-light focus:border-accent focus:outline-none"
            >
              <option value="">Any</option>
              {INTEREST_OPTIONS.map(i => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>

          {/* City */}
          <div>
            <label className="block text-[11px] font-semibold text-text-muted mb-1.5">City</label>
            <input
              type="text"
              value={filters.city}
              onChange={(e) => onChange({ ...filters, city: e.target.value })}
              placeholder="e.g. Madrid, Buenos Aires..."
              className="w-full rounded-xl bg-bg-input px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted border border-border-light focus:border-accent focus:outline-none"
            />
          </div>

          {/* Age range */}
          <div>
            <label className="block text-[11px] font-semibold text-text-muted mb-1.5">Age range</label>
            <select
              value={filters.age_range}
              onChange={(e) => onChange({ ...filters, age_range: e.target.value })}
              className="w-full rounded-xl bg-bg-input px-3 py-2.5 text-sm text-text-primary border border-border-light focus:border-accent focus:outline-none"
            >
              <option value="">Any</option>
              {AGE_RANGE_OPTIONS.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Country */}
          <div>
            <label className="block text-[11px] font-semibold text-text-muted mb-1.5">Country</label>
            <select
              value={filters.country}
              onChange={(e) => onChange({ ...filters, country: e.target.value })}
              className="w-full rounded-xl bg-bg-input px-3 py-2.5 text-sm text-text-primary border border-border-light focus:border-accent focus:outline-none"
            >
              <option value="">Any</option>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{getFlagEmoji(c.code)} {c.name}</option>
              ))}
            </select>
          </div>

          {/* Region */}
          <div>
            <label className="block text-[11px] font-semibold text-text-muted mb-1.5">Region</label>
            <input
              type="text"
              value={filters.region}
              onChange={(e) => onChange({ ...filters, region: e.target.value })}
              placeholder="e.g. California, Ontario..."
              className="w-full rounded-xl bg-bg-input px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted border border-border-light focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => onChange({ looking_for: '', interests: '', city: '', age_range: '', country: '', region: '' })}
            className="flex-1 rounded-xl bg-bg-input py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Clear all
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   DISCOVER PAGE
   ═══════════════════════════════════════════════════════════ */
export function Discover() {
  const { profile, requireAuth } = useAuth()
  const [profiles, setProfiles] = useState<(Profile & { match_score?: number; shared_interests?: string[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ looking_for: '', interests: '', city: '', age_range: '', country: '', region: '' })
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [sentVibes, setSentVibes] = useState<Set<string>>(new Set())

  const loadProfiles = useCallback(async (cursor?: string, append = false) => {
    if (!profile) return
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError('')

    try {
      const data = await discoverApi.list({
        ...filters,
        limit: 20,
        cursor,
      })
      const items = data.items || []
      if (append) {
        setProfiles(prev => [...prev, ...items])
      } else {
        setProfiles(items)
        setCurrentIndex(0)
      }
      setNextCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
    setLoadingMore(false)
  }, [profile, filters])

  // Initial load
  useEffect(() => {
    if (profile) loadProfiles()
  }, [profile, loadProfiles])

  // Load more when running low
  useEffect(() => {
    if (profiles.length > 0 && currentIndex >= profiles.length - 3 && hasMore && !loadingMore && nextCursor) {
      loadProfiles(nextCursor, true)
    }
  }, [currentIndex, profiles.length, hasMore, loadingMore, nextCursor, loadProfiles])

  async function handleConnect(targetProfile: Profile) {
    if (!requireAuth()) return
    try {
      await vibesApi.send(targetProfile.id)
      setSentVibes(prev => new Set(prev).add(targetProfile.id))
      setCurrentIndex(prev => prev + 1)
    } catch (err) {
      console.error('[Discover] Send vibe failed:', err)
    }
  }

  function handleSkip() {
    setCurrentIndex(prev => prev + 1)
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-muted">
          <Heart className="h-8 w-8 text-accent" />
        </div>
        <h2 className="text-lg font-bold text-text-primary">Find your people</h2>
        <p className="mt-1 text-sm text-text-secondary max-w-xs">
          Sign in to discover developers who share your interests, goals, and vibe.
        </p>
        <button
          onClick={() => requireAuth()}
          className="mt-4 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover"
        >
          Get Started
        </button>
      </div>
    )
  }

  const currentProfile = profiles[currentIndex]
  const remaining = profiles.length - currentIndex

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary md:text-2xl">Discover</h1>
          <p className="mt-1 text-sm text-text-secondary">Find study buddies, collaborators, and more.</p>
        </div>
        <button
          onClick={() => setFiltersOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-bg-card px-3 py-2 text-xs font-medium text-text-secondary transition-all hover:bg-bg-card-hover hover:text-text-primary border border-border-light"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </button>
      </div>

      {/* Active filters */}
      {(filters.looking_for || filters.interests || filters.city || filters.age_range || filters.country || filters.region) && (
        <div className="flex flex-wrap gap-1.5">
          {filters.looking_for && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2.5 py-1 text-[10px] font-medium text-accent">
              {filters.looking_for.replace(/_/g, ' ')}
              <button onClick={() => setFilters(f => ({ ...f, looking_for: '' }))} className="ml-0.5 hover:text-accent-hover">&times;</button>
            </span>
          )}
          {filters.interests && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2.5 py-1 text-[10px] font-medium text-accent">
              {filters.interests}
              <button onClick={() => setFilters(f => ({ ...f, interests: '' }))} className="ml-0.5 hover:text-accent-hover">&times;</button>
            </span>
          )}
          {filters.city && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2.5 py-1 text-[10px] font-medium text-accent">
              {filters.city}
              <button onClick={() => setFilters(f => ({ ...f, city: '' }))} className="ml-0.5 hover:text-accent-hover">&times;</button>
            </span>
          )}
          {filters.country && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2.5 py-1 text-[10px] font-medium text-accent">
              {getFlagEmoji(filters.country)} {COUNTRIES.find(c => c.code === filters.country)?.name || filters.country}
              <button onClick={() => setFilters(f => ({ ...f, country: '' }))} className="ml-0.5 hover:text-accent-hover">&times;</button>
            </span>
          )}
          {filters.region && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2.5 py-1 text-[10px] font-medium text-accent">
              {filters.region}
              <button onClick={() => setFilters(f => ({ ...f, region: '' }))} className="ml-0.5 hover:text-accent-hover">&times;</button>
            </span>
          )}
          {filters.age_range && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2.5 py-1 text-[10px] font-medium text-accent">
              {filters.age_range}
              <button onClick={() => setFilters(f => ({ ...f, age_range: '' }))} className="ml-0.5 hover:text-accent-hover">&times;</button>
            </span>
          )}
        </div>
      )}

      {/* Remaining counter */}
      {remaining > 0 && (
        <div className="text-center text-[11px] text-text-muted">
          {remaining} profile{remaining !== 1 ? 's' : ''} remaining
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-bg-card p-10 text-center animate-fade-in">
          <p className="text-sm font-medium text-text-primary">
            {error.includes('404') || error.includes('non-JSON')
              ? 'Discover is temporarily unavailable'
              : error.includes('fetch') || error.includes('network')
                ? "Couldn't connect to Discover"
                : 'Something went wrong'}
          </p>
          <p className="mt-1 text-xs text-text-muted">{error}</p>
          <button
            onClick={() => { setError(''); loadProfiles() }}
            className="mt-4 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover"
          >
            Try again
          </button>
        </div>
      ) : currentProfile ? (
        <div className="flex justify-center">
          <VibeCard
            key={currentProfile.id}
            profile={currentProfile}
            matchScore={currentProfile.match_score}
            onConnect={() => handleConnect(currentProfile)}
            onSkip={handleSkip}
          />
        </div>
      ) : (
        <div className="animate-fade-in rounded-2xl bg-bg-card p-10 text-center sm:p-12 md:p-20">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted md:h-16 md:w-16">
            <Sparkles className="h-7 w-7 text-accent md:h-8 md:w-8" />
          </div>
          <p className="text-base font-medium text-text-primary md:text-lg">No more profiles to discover</p>
          <p className="mt-1 text-sm text-text-muted">
            {profiles.length === 0
              ? 'Try adjusting your filters to see more people.'
              : 'Check back later for new members.'}
          </p>
          {profiles.length === 0 && (
            <button
              onClick={() => setFilters({ looking_for: '', interests: '', city: '', age_range: '', country: '', region: '' })}
              className="mt-4 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Loading more */}
      {loadingMore && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      )}

      {/* Filters panel */}
      {filtersOpen && (
        <FiltersPanel
          filters={filters}
          onChange={setFilters}
          onClose={() => { setFiltersOpen(false); loadProfiles() }}
        />
      )}
    </div>
  )
}
