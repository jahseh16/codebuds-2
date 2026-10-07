import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, MessageCircle, Layers, User, FolderGit2, Github, ExternalLink, AlertCircle, MapPin, Sparkles, Bookmark, Users, UserPlus, UserMinus, Pencil } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { profiles as profilesApi, posts as postsApi, projects as projectsApi, follows as followsApi, saved as savedApi } from '../lib/api'
import { AvatarModal } from '../components/AvatarModal'
import { ProfileBanner, BannerMedia } from '../components/ProfileBanner'
import { FollowListModal } from '../components/FollowListModal'
import { PostCard } from '../components/PostCard'
import { getAvatarUrl, formatLocation } from '../lib/utils'
import { validateUsername, displayUsername } from '../lib/username'
import { LOOKING_FOR_OPTIONS, INTEREST_OPTIONS, AGE_RANGE_OPTIONS, AVAILABILITY_OPTIONS } from '../lib/types'
import type { Profile as ProfileType, Post, Project } from '../lib/types'

/* ─── helpers ─────────────────────────────────────────── */
function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

/* ─── Country list for dropdown ──────────────────────── */
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

/* ─── badge color map ─────────────────────────────────── */
const BADGE_COLORS: Record<string, string> = {
  vip: 'badge-amber',
  lead: 'badge-violet',
  mentor: 'badge-green',
  pioneer: 'badge-blue',
  bot: 'badge-pink',
}
function badgeColor(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('vip')) return BADGE_COLORS.vip
  if (l.includes('lead') || l.includes('dev')) return BADGE_COLORS.lead
  if (l.includes('mentor')) return BADGE_COLORS.mentor
  if (l.includes('pioneer') || l.includes('bot')) return BADGE_COLORS.pink
  return BADGE_COLORS.blue
}

/* ─── all possible badges for the modal checkboxes ───── */
const ALL_BADGES = [
  { key: 'vip', label: 'VIP', color: 'badge-amber' },
  { key: 'lead', label: 'Lead Dev', color: 'badge-violet' },
  { key: 'mentor', label: 'Mentor', color: 'badge-green' },
  { key: 'pioneer', label: 'Pioneer', color: 'badge-blue' },
  { key: 'bot', label: 'Bot Master', color: 'badge-pink' },
]

/* ═══════════════════════════════════════════════════════════
   PROFILE PAGE
   ═══════════════════════════════════════════════════════════ */
/* Uploaded covers are stored as data URLs (base64 inflates ~33%) and the
   server accepts bodies up to 12mb, so 8MB is the safe ceiling. */
const MAX_BANNER_BYTES = 8 * 1024 * 1024

export function Profile() {
  const { username: routeUsername } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const { profile: myProfile, refreshProfile, updateProfileLocal, requireAuth } = useAuth()
  const [viewProfile, setViewProfile] = useState<ProfileType | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [userPosts, setUserPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [userProjects, setUserProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)

  // Tabs
  const [activeTab, setActiveTab] = useState<'posts' | 'projects' | 'saved'>('posts')
  const [savedPosts, setSavedPosts] = useState<Post[]>([])
  const [savedProjects, setSavedProjects] = useState<Project[]>([])
  const [savedLoading, setSavedLoading] = useState(false)

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [followLoading, setFollowLoading] = useState(false)

  // Follow list modals
  const [followersModalOpen, setFollowersModalOpen] = useState(false)
  const [followingModalOpen, setFollowingModalOpen] = useState(false)

  /* ── edit form state ──────────────────────────────── */
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [bannerError, setBannerError] = useState('')
  const [location, setLocation] = useState('')
  const [openTo, setOpenTo] = useState('collaboration')
  const [skills, setSkills] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [discordUrl, setDiscordUrl] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [xUrl, setXUrl] = useState('')
  const [badgeToggles, setBadgeToggles] = useState<Record<string, boolean>>({})
  // Matching fields
  const [ageRange, setAgeRange] = useState('')
  const [city, setCity] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [lookingFor, setLookingFor] = useState<string[]>([])
  const [availability, setAvailability] = useState('anytime')
  const [visibility, setVisibility] = useState('public')
  const [ageVerified, setAgeVerified] = useState(false)
  // Location fields
  const [country, setCountry] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [region, setRegion] = useState('')
  const [timezone, setTimezone] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bannerFileInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  /* ── resolve profile to display ────────────────────── */
  const isOwnProfile = !routeUsername || routeUsername === myProfile?.username
  const profile = isOwnProfile ? myProfile : viewProfile

  /* ── fetch viewed profile by username ──────────────── */
  useEffect(() => {
    if (!routeUsername || isOwnProfile) {
      setViewProfile(null)
      return
    }
    let cancelled = false
    setViewLoading(true)
    profilesApi.list().then((data) => {
      if (cancelled) return
      const found = (data as ProfileType[]).find((p) => p.username === routeUsername)
      setViewProfile(found ?? null)
      setViewLoading(false)
    }).catch(() => {
      if (!cancelled) setViewLoading(false)
    })
    return () => { cancelled = true }
  }, [routeUsername, isOwnProfile])

  /* ── fetch user's posts ────────────────────────────── */
  useEffect(() => {
    if (!profile) return
    setPostsLoading(true)
    postsApi.byAuthor(profile.id).then((data) => {
      setUserPosts(data as Post[])
    }).catch(() => {}).finally(() => setPostsLoading(false))
  }, [profile?.id])

  /* ── fetch user's projects ──────────────────────────── */
  useEffect(() => {
    if (!profile) return
    setProjectsLoading(true)
    projectsApi.list('created_at', undefined, undefined, undefined).then((data) => {
      setUserProjects((data as Project[]).filter(p => p.author_id === profile.id))
    }).catch(() => {}).finally(() => setProjectsLoading(false))
  }, [profile?.id])

  /* ── fetch follow state + public counters for other profiles ── */
  useEffect(() => {
    if (!profile || isOwnProfile) return
    let cancelled = false

    // Which users I already follow. The API layer always hands back an array;
    // the guard keeps a malformed payload from throwing inside .then().
    followsApi
      .following(myProfile?.id || '')
      .then((following) => {
        if (cancelled) return
        setIsFollowing(Array.isArray(following) && following.some((f) => f?.id === profile.id))
      })
      .catch((err) => console.error('[Profile] Follow state load failed:', err))

    // Contadores públicos: GET /api/profiles/:id es legible por cualquier
    // visitante o usuario autenticado — no solo por el dueño de la cuenta.
    setFollowersCount(profile.followers_count ?? 0)
    setFollowingCount(profile.following_count ?? 0)
    profilesApi
      .get(profile.id)
      .then((data) => {
        if (cancelled || !data) return
        const fc = data.followers_count
        const gc = data.following_count
        if (typeof fc === 'number') setFollowersCount(fc)
        if (typeof gc === 'number') setFollowingCount(gc)
      })
      .catch((err) => console.error('[Profile] Public counters load failed:', err))

    return () => { cancelled = true }
  }, [profile?.id, isOwnProfile, myProfile?.id])

  /* ── follow / unfollow ─────────────────────────────── */
  async function handleFollowToggle() {
    if (!requireAuth() || !profile) return
    setFollowLoading(true)
    try {
      const result = isFollowing
        ? await followsApi.unfollow(profile.id)
        : await followsApi.follow(profile.id)

      const nextIsFollowing = Boolean(result?.isFollowing)
      const nextFollowersCount = Number(result?.followersCount ?? followersCount)
      setIsFollowing(nextIsFollowing)
      setFollowersCount(nextFollowersCount)
    } catch (err) {
      console.error('[Profile] Follow toggle failed:', err)
    } finally {
      setFollowLoading(false)
    }
  }

  /* ── fetch saved items ─────────────────────────────── */
  useEffect(() => {
    if (!profile || !isOwnProfile || activeTab !== 'saved') return
    setSavedLoading(true)
    savedApi.getAll(50).then((data: any) => {
      setSavedPosts(data.items.filter((i: any) => i.type === 'post').map((i: any) => i.data))
      setSavedProjects(data.items.filter((i: any) => i.type === 'project').map((i: any) => i.data))
    }).catch(() => {}).finally(() => setSavedLoading(false))
  }, [profile?.id, isOwnProfile, activeTab])

  /* ── open editor ───────────────────────────────────── */
  const openEditor = useCallback(() => {
    if (!profile) return
    setFullName(profile.full_name)
    setUsername(profile.username)
    setBio(profile.bio)
    setAvatarUrl(profile.avatar_url ?? '')
    setBannerUrl(profile.banner_url ?? '')
    setLocation(profile.location)
    setOpenTo(profile.open_to)
    setSkills(profile.skills.join(', '))
    setGithubUrl(profile.github_url ?? '')
    setLinkedinUrl(profile.linkedin_url ?? '')
    setDiscordUrl('')
    setPortfolioUrl('')
    setXUrl('')
    setBadgeToggles({ vip: true, lead: true, pioneer: true, mentor: true, bot: false })
    // Matching fields
    setAgeRange(profile.age_range || '')
    setCity(profile.city || '')
    setInterests(profile.interests || [])
    setLookingFor(profile.looking_for || [])
    setAvailability(profile.availability || 'anytime')
    setVisibility(profile.visibility || 'public')
    setAgeVerified(profile.age_verified || false)
    // Location fields
    setCountry((profile as any).country || '')
    setCountryCode((profile as any).country_code || '')
    setRegion((profile as any).region || '')
    setTimezone((profile as any).timezone || '')
    setSaved(false)
    setEditing(true)
  }, [profile])

  /* ── close on Escape + body overflow ─────────────── */
  useEffect(() => {
    if (!editing) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) setEditing(false) }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = prev || ''
    }
  }, [editing, saving])

  /* ── save ──────────────────────────────────────────── */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    try {
      const updated = await profilesApi.update(profile.id, {
        full_name: fullName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl.trim() || null,
        banner_url: bannerUrl.trim() || null,
        github_url: githubUrl.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        location: location.trim(),
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        open_to: openTo,
        // Matching fields
        age_range: ageRange,
        city: city.trim(),
        interests,
        looking_for: lookingFor,
        availability,
        visibility,
        age_verified: ageVerified,
        // Location fields
        country: country || null,
        country_code: countryCode || null,
        region: region || null,
        timezone: timezone || null,
      })
      // Instant local update: the profile (and its banner) renders animated
      // right away, before the authoritative refetch lands.
      updateProfileLocal(updated)
      await refreshProfile()
      setSaved(true)
      setTimeout(() => { setEditing(false); setSaved(false) }, 1200)
    } catch (err) {
      console.error('[Profile] Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  /* ── avatar file → data URL ────────────────────────── */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAvatarUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  /* ── banner upload: image/video → data URL (same as the avatar) ── */
  function handleBannerFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBannerError('')
    if (file.size > MAX_BANNER_BYTES) {
      setBannerError('Cover file is too big (max 8MB).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setBannerUrl(reader.result as string)
    reader.onerror = () => setBannerError('Could not read the file. Please try again.')
    reader.readAsDataURL(file)
  }

  /* ── derived values ────────────────────────────────── */
  if (viewLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }
  if (!profile) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-text-muted text-sm">Profile not found</p>
      </div>
    )
  }

  const displayName = profile.full_name || profile.username
  const parsedSkills = skills.split(',').map((s) => s.trim()).filter(Boolean)
  const activeBadges = ALL_BADGES.filter((b) => badgeToggles[b.key])

  const openLabel = profile.open_to
    ? profile.open_to.charAt(0).toUpperCase() + profile.open_to.slice(1)
    : 'Collaboration'

  const joined = new Date(profile.created_at).toISOString().slice(0, 10)

  const isOnline = profile.last_active && (Date.now() - new Date(profile.last_active).getTime()) < 5 * 60 * 1000

  const displayLocation = formatLocation(
    (profile as any).country,
    (profile as any).country_code,
    profile.city || undefined
  )

  const postsCount = (profile as any).posts_count ?? userPosts.length
  // Own profile: counters come from /api/auth/me · Other profile: from the
  // public GET /api/profiles/:id (kept in state so the follow toggle updates it).
  const followersTotal = profile.followers_count ?? followersCount
  const followingTotal = profile.following_count ?? followingCount
  const projectsCount = (profile as any).projects_count ?? userProjects.length

  const inputBase = 'w-full bg-bg-primary rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted input-neon'

  return (
    <>
      {/* ═══════════════════════════════════════════
          PROFILE — FULL WIDTH LAYOUT
      ═══════════════════════════════════════════ */}
      <div className="w-full">
        <div className="bg-bg-card rounded-2xl overflow-hidden shadow-2xl shadow-black/60">

          {/* ── Banner (full width) ── */}
          <ProfileBanner url={profile.banner_url}>
            <span className="absolute top-3 left-4 text-[10px] text-[rgba(202,190,255,0.58)] select-none z-10">~/codebuds/profile</span>
            <span className="absolute top-3 right-4 text-[10px] text-[rgba(202,190,255,0.58)] select-none z-10">[session_active]</span>
          </ProfileBanner>

          {/* ── Identity row: avatar + nombre + @username + stats en UNA fila horizontal ── */}
          <div className="relative z-[5] -mt-[46px] flex flex-row items-center gap-[14px] px-[18px] sm:px-8 lg:px-10">
            {/* avatar-wrap */}
            <div className="relative z-10 flex items-center justify-center shrink-0 w-20 h-20 sm:w-36 sm:h-36 lg:w-40 lg:h-40 rounded-full border-[3px] border-[#0e0e11] cursor-pointer" onClick={() => profile.avatar_url && setAvatarModalOpen(true)}>
              {/* Capa 1: aro / marco neón */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary to-purple-500 blur-md opacity-75 animate-pulse" />
              {/* Capa 2: foto de perfil */}
              <img src={getAvatarUrl(profile.avatar_url, profile.username)} alt={displayName} className="relative z-10 w-full h-full rounded-full object-cover object-center border-2 border-[#9c62fa]/70 shadow-2xl" />
              {/* Punto de estado en línea — fuera del anillo, nunca tapado */}
              <div className="absolute bottom-1 right-1 z-20 flex h-4 w-4 items-center justify-center" title={isOnline ? 'Online' : 'Offline'}>
                {isOnline && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={`relative inline-flex h-3.5 w-3.5 rounded-full ring-2 ring-[#0e0e11] ${isOnline ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
              </div>
            </div>
            {/* identity-info: a la derecha del avatar (flex:1, min-width:0) */}
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3 whitespace-nowrap">
              <div className="min-w-0">
                {/* name-row: nombre + lapicito */}
                <div className="flex items-center gap-2">
                  <h1 className="truncate font-extrabold text-white text-lg sm:text-xl">{displayName}</h1>
                  {isOwnProfile && (
                    <button
                      type="button"
                      onClick={openEditor}
                      aria-label="Edit profile"
                      className="shrink-0 p-1 rounded-md bg-zinc-800 text-zinc-300 hover:text-white"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
                {/* username */}
                <div className="truncate text-xs sm:text-sm text-text-muted">@{displayUsername(profile.username)}</div>
              </div>

              {/* profile-stats: 3 botones compactos a la derecha del nombre/username */}
              <div className="flex shrink-0 items-center gap-3 sm:gap-4 text-center">
                <button
                  type="button"
                  onClick={() => setFollowingModalOpen(true)}
                  className="flex min-h-[44px] flex-col items-center justify-center cursor-pointer"
                >
                  <span className="text-white font-bold text-sm sm:text-lg">{followingTotal}</span>
                  <span className="text-white text-[10px] sm:text-xs">Following</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFollowersModalOpen(true)}
                  className="flex min-h-[44px] flex-col items-center justify-center cursor-pointer"
                >
                  <span className="text-red-500 font-bold text-sm sm:text-lg">{followersTotal}</span>
                  <span className="text-red-500 text-[10px] sm:text-xs font-bold">Followers</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('posts')
                    setTimeout(() => {
                      document.getElementById('posts')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }, 50)
                  }}
                  className="flex min-h-[44px] flex-col items-center justify-center cursor-pointer"
                >
                  <span className="text-white font-bold text-sm sm:text-lg">{postsCount}</span>
                  <span className="text-white text-[10px] sm:text-xs">Posts</span>
                </button>
              </div>
            </div>

            {!isOwnProfile && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className={`flex items-center gap-1.5 px-[15px] py-[11px] rounded-[10px] text-[11px] font-extrabold transition-all duration-200 hover:-translate-y-0.5 ${
                    isFollowing
                      ? 'bg-bg-input text-text-secondary border border-border-light hover:text-danger hover:border-danger/50'
                      : 'text-white'
                  }`}
                  style={!isFollowing ? { background: 'linear-gradient(135deg, #7040e9, #9c62fa)', boxShadow: '0 9px 24px rgba(139,92,246,0.25)' } : {}}
                >
                  {followLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isFollowing ? (
                    <><UserMinus className="h-3.5 w-3.5" /> Following</>
                  ) : (
                    <><UserPlus className="h-3.5 w-3.5" /> Follow</>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (!requireAuth()) return
                    navigate(`/messages/${profile.username}`)
                  }}
                  className="flex items-center gap-2 px-[15px] py-[11px] rounded-[10px] text-white text-[11px] font-extrabold transition-all duration-200 hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #7040e9, #9c62fa)', boxShadow: '0 9px 24px rgba(139,92,246,0.25)' }}
                >
                  <MessageCircle className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* ── Meta: estado de colaboración + status + preferencias + intereses ── */}
          <div className="px-6 sm:px-8 lg:px-10 pt-3">
            {/* Estado de colaboración (badge) bajo la fila de identidad */}
            <span className="mb-2 inline-block px-2 py-0.5 rounded-md text-[11px] font-mono bg-emerald-400/10 border border-emerald-400/40 text-emerald-400">
              OPEN TO {openLabel.toUpperCase()}
            </span>

            <div className="flex items-center gap-4 text-[10px] text-[#686873] flex-wrap">
              <span><span className="text-[#b59bff]">$</span> status --{isOnline ? 'online' : 'offline'}</span>
              <span><span className="text-[#b59bff]">$</span> joined --date {joined}</span>
              {displayLocation && (
                <span className="flex items-center gap-1">{displayLocation}</span>
              )}
            </div>

            {/* Looking for tags */}
            {profile.looking_for && profile.looking_for.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.looking_for.map(lf => (
                  <span key={lf} className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2.5 py-1 text-[10px] font-semibold text-accent border border-accent/20">
                    <Sparkles className="h-2.5 w-2.5" />
                    {lf.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            {/* Interests */}
            {profile.interests && profile.interests.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {profile.interests.map(i => (
                  <span key={i} className="rounded-md bg-bg-input px-2 py-0.5 text-[10px] text-text-secondary ring-1 ring-inset ring-border-light/60">
                    {i}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Content: single compact vertical column ── */}
          <div className="space-y-5 px-6 sm:px-8 lg:px-10 pt-5 pb-8">

            {/* ── Badges, Stack, Links ── */}
            <div className="space-y-5 section-fade-up">

              {/* Badges */}
              <div>
                <h2 className="text-[11px] font-semibold tracking-[0.07em] mb-3" style={{ color: '#c7bddc' }}>
                  <span className="text-[#b59bff]">##</span> BADGES
                </h2>
                <div className="flex flex-wrap gap-[7px]">
                  {ALL_BADGES.map((b) => (
                    <button key={b.key} className={`badge ${b.color}`}>
                      [{b.label}]
                    </button>
                  ))}
                </div>
              </div>

              {/* Stack */}
              <div>
                <h2 className="text-[11px] font-semibold tracking-[0.07em] mb-3" style={{ color: '#c7bddc' }}>
                  <span className="text-[#b59bff]">##</span> STACK
                </h2>
                <div className="flex flex-wrap gap-[7px]">
                  {profile.skills.length > 0 ? (
                    profile.skills.map((skill) => (
                      <button key={skill} className="skill-chip" data-tech={skill}>
                        {skill}
                      </button>
                    ))
                  ) : (
                    <span className="text-[10px] text-zinc-600">No skills added yet</span>
                  )}
                </div>
              </div>

              {/* Links */}
              <div>
                <h2 className="text-[11px] font-semibold tracking-[0.07em] mb-3" style={{ color: '#c7bddc' }}>
                  <span className="text-[#b59bff]">##</span> LINKS
                </h2>
                <div className="flex gap-2">
                  {profile.github_url && (
                    <a href={profile.github_url} target="_blank" rel="noopener noreferrer" title="GitHub" className="social-btn">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12v3.15c0 .3.21.67.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>
                    </a>
                  )}
                  {profile.linkedin_url && (
                    <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" title="LinkedIn" className="social-btn">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45z"/></svg>
                    </a>
                  )}
                  <button className="social-btn" title="Discord">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.32 4.37a19.8 19.8 0 0 0-4.93-1.51 13.8 13.8 0 0 0-.64 1.28 18.3 18.3 0 0 0-5.5 0 13.8 13.8 0 0 0-.64-1.28c-1.71.29-3.37.8-4.93 1.51A20.3 20.3 0 0 0 .1 18.06a19.9 19.9 0 0 0 6.07 3.03c.49-.66.93-1.37 1.3-2.1a12.9 12.9 0 0 1-2.05-.98c.17-.12.34-.25.5-.38a14.2 14.2 0 0 0 12.16 0c.16.13.33.26.5.38-.65.38-1.34.71-2.05.98.37.73.81 1.44 1.3 2.1a19.9 19.9 0 0 0 6.07-3.03 20.3 20.3 0 0 0-3.58-13.69zM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.21 0 2.18 1.09 2.16 2.42 0 1.34-.95 2.42-2.16 2.42zm7.96 0c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.21 0 2.18 1.09 2.16 2.42 0 1.34-.95 2.42-2.16 2.42z"/></svg>
                  </button>
                  <button className="social-btn" title="X">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41z"/></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* ── Bio terminal + Tabs ── */}
            <div className="space-y-5 min-w-0">
              {/* Bio terminal */}
              <div className="section-fade-up rounded-[15px] bg-[#0b0b10] overflow-hidden" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.065), 0 0 25px rgba(139,92,246,0.055)' }}>
                <div className="h-[38px] px-[15px] flex items-center gap-[7px] bg-[rgba(255,255,255,0.018)]" style={{ color: '#686873', fontSize: '10px' }}>
                  <span className="flex gap-[6px] mr-[7px]">
                    <span className="w-[10px] h-[10px] rounded-full" style={{ background: '#fb5f62' }} />
                    <span className="w-[10px] h-[10px] rounded-full" style={{ background: '#f5bf37' }} />
                    <span className="w-[10px] h-[10px] rounded-full" style={{ background: '#36c772' }} />
                  </span>
                  bio.sh — bash
                </div>
                <div className="min-h-[137px] p-[18px] text-[12px] leading-[1.9]" style={{ color: '#d8d5df' }}>
                  {profile.bio ? (
                    <>
                      <p style={{ color: '#777480' }}>// Tell the world about yourself...</p>
                      <p className="mt-2"><span style={{ color: '#b59bff' }}>{'➜'}</span> ~ whoami</p>
                      <p className="mt-1" style={{ color: '#d7d4dd' }}>{profile.bio}</p>
                    </>
                  ) : (
                    <p style={{ color: '#777480' }}>// Tell the world about yourself...</p>
                  )}
                  <p className="mt-2">
                    <span style={{ color: '#b59bff' }}>{'➜'}</span> ~{' '}
                    <span className="cursor-blink" />
                  </p>
                </div>
              </div>

              {/* Tabs: Posts / Projects / Saved */}
              <div id="posts" className="section-fade-up-delay-1">
                <div className="flex items-center gap-1 border-b border-border-light mb-4">
                  {(['posts', 'projects', ...(isOwnProfile ? ['saved'] : [])] as Array<'posts' | 'projects' | 'saved'>).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 text-[11px] font-semibold tracking-wide transition-all border-b-2 -mb-[1px] ${
                        activeTab === tab
                          ? 'text-accent border-accent'
                          : 'text-text-muted border-transparent hover:text-text-secondary'
                      }`}
                    >
                      {tab === 'posts' && <Layers className="h-3 w-3 inline mr-1" />}
                      {tab === 'projects' && <FolderGit2 className="h-3 w-3 inline mr-1" />}
                      {tab === 'saved' && <Bookmark className="h-3 w-3 inline mr-1" />}
                      {tab.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Posts Tab */}
                {activeTab === 'posts' && (
                  <>
                    {postsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                      </div>
                    ) : userPosts.length > 0 ? (
                      <div className="space-y-4">
                        {userPosts.map((p) => (
                          <PostCard
                            key={p.id}
                            post={p}
                            canDelete={p.author_id === myProfile?.id}
                            onDelete={(id) => setUserPosts((prev) => prev.filter((x) => x.id !== id))}
                            onToggleLike={(id) => {
                              setUserPosts((prev) => prev.map((x) => x.id === id ? { ...x, liked_by_me: !x.liked_by_me, like_count: (x.like_count ?? 0) + (x.liked_by_me ? -1 : 1) } : x))
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[15px] bg-[rgba(255,255,255,0.024)] p-[15px]">
                        <p className="text-center text-[11px]" style={{ color: '#686873' }}>No posts yet</p>
                      </div>
                    )}
                  </>
                )}

                {/* Projects Tab */}
                {activeTab === 'projects' && (
                  <>
                    {projectsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                      </div>
                    ) : userProjects.length > 0 ? (
                      <div className="space-y-3">
                        {userProjects.map((p) => (
                          <div key={p.id} className="rounded-xl bg-bg-primary p-4 transition-all hover:bg-bg-card-hover">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-sm font-semibold text-text-primary">{p.title}</h3>
                              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                p.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                                p.status === 'in_progress' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                                p.status === 'beta' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' :
                                'bg-blue-500/15 text-blue-400 border-blue-500/30'
                              }`}>{p.status.replace('_', ' ')}</span>
                            </div>
                            <p className="mt-1 text-xs text-text-secondary line-clamp-2">{p.description}</p>
                            {p.tech_stack.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {p.tech_stack.slice(0, 3).map(t => (
                                  <span key={t} className="rounded bg-bg-input px-1.5 py-0.5 text-[10px] text-text-muted ring-1 ring-inset ring-border-light/60">{t}</span>
                                ))}
                              </div>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              {p.repo_url && <a href={p.repo_url} target="_blank" rel="noreferrer" className="text-text-muted hover:text-text-primary"><Github className="h-3.5 w-3.5" /></a>}
                              {p.live_url && <a href={p.live_url} target="_blank" rel="noreferrer" className="text-text-muted hover:text-text-primary"><ExternalLink className="h-3.5 w-3.5" /></a>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="min-h-[92px] grid place-items-center rounded-[14px] bg-[rgba(255,255,255,0.018)]" style={{ color: '#686873', fontSize: '11px' }}>
                        ⌘<br />No projects yet
                      </div>
                    )}
                  </>
                )}

                {/* Saved Tab (only for own profile) */}
                {activeTab === 'saved' && isOwnProfile && (
                  <>
                    {savedLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                      </div>
                    ) : savedPosts.length === 0 && savedProjects.length === 0 ? (
                      <div className="rounded-[15px] bg-[rgba(255,255,255,0.024)] p-8 text-center">
                        <Bookmark className="h-8 w-8 mx-auto mb-3 text-text-muted" />
                        <p className="text-[12px] text-text-primary font-medium">No saved items yet</p>
                        <p className="text-[10px] text-text-muted mt-1">Posts and projects you save will appear here.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {savedPosts.length > 0 && (
                          <div>
                            <p className="text-[10px] text-text-muted mb-2 uppercase tracking-wider">Saved Posts</p>
                            {savedPosts.map((p) => (
                              <PostCard
                                key={p.id}
                                post={p}
                                canDelete={p.author_id === myProfile?.id}
                                onDelete={(id) => setSavedPosts((prev) => prev.filter((x) => x.id !== id))}
                                onToggleLike={(id) => {
                                  setSavedPosts((prev) => prev.map((x) => x.id === id ? { ...x, liked_by_me: !x.liked_by_me, like_count: (x.like_count ?? 0) + (x.liked_by_me ? -1 : 1) } : x))
                                }}
                              />
                            ))}
                          </div>
                        )}
                        {savedProjects.length > 0 && (
                          <div>
                            <p className="text-[10px] text-text-muted mb-2 uppercase tracking-wider">Saved Projects</p>
                            <div className="space-y-3">
                              {savedProjects.map((p) => (
                                <div key={p.id} className="rounded-xl bg-bg-primary p-4 transition-all hover:bg-bg-card-hover">
                                  <div className="flex items-start justify-between gap-2">
                                  <h3 className="text-sm font-semibold text-text-primary">{p.title}</h3>
                                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                    p.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                                    p.status === 'in_progress' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                                    p.status === 'beta' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' :
                                    'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                  }`}>{p.status.replace('_', ' ')}</span>
                                  </div>
                                  <p className="mt-1 text-xs text-text-secondary line-clamp-2">{p.description}</p>
                                  <div className="mt-2 flex items-center gap-2">
                                    {p.repo_url && <a href={p.repo_url} target="_blank" rel="noreferrer" className="text-text-muted hover:text-text-primary"><Github className="h-3.5 w-3.5" /></a>}
                                    {p.live_url && <a href={p.live_url} target="_blank" rel="noreferrer" className="text-text-muted hover:text-text-primary"><ExternalLink className="h-3.5 w-3.5" /></a>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] mt-4 select-none" style={{ color: '#5a6b65' }}>
          [codebuds@vmi3516064] ~ rendered in 0.42ms
        </p>
      </div>

      {/* ═══════════════════════════════════════════
          EDIT MODAL — sudo nano edit_profile.exe
      ═══════════════════════════════════════════ */}
      {editing && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget && !saving) setEditing(false) }}
        >
          <div ref={modalRef} className="w-full max-w-lg bg-bg-card rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(139,92,246,0.15)] max-h-[90vh] flex flex-col animate-scale-in">

            {/* ── header terminal ── */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-bg-card-hover/60 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="ml-3 text-xs text-zinc-500">sudo nano edit_profile.exe</span>
              </div>
              <button onClick={() => !saving && setEditing(false)} className="text-zinc-500 hover:text-red-400 transition-colors text-lg leading-none">&times;</button>
            </div>

            {/* ── body ── */}
            <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto">

              {/* Avatar */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                  <span className="text-violet-400">&gt;</span> AVATAR
                </label>
                <div className="flex items-center gap-3">
                  {avatarUrl ? (
                    <img src={avatarUrl} className="w-14 h-14 rounded-full bg-bg-primary object-cover" alt="preview" />
                  ) : (
                    <img src={getAvatarUrl(null, profile.username)} className="w-14 h-14 rounded-full bg-bg-primary object-cover" alt="preview" />
                  )}
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://... (image URL)"
                      className={inputBase}
                    />
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-dashed border-border text-text-muted cursor-pointer hover:border-accent hover:text-accent transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"/></svg>
                      Upload file
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Banner */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                  <span className="text-violet-400">&gt;</span> BANNER
                </label>
                <input
                  type="text"
                  value={bannerUrl}
                  onChange={(e) => { setBannerUrl(e.target.value); setBannerError('') }}
                  placeholder="https://tenor.com/view/...gif  ·  https://.../cover.mp4"
                  className={inputBase}
                />
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-dashed border-border text-text-muted cursor-pointer hover:border-accent hover:text-accent transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"/></svg>
                    Upload cover
                    <input
                      ref={bannerFileInputRef}
                      type="file"
                      accept="image/*,video/mp4,video/webm"
                      className="hidden"
                      onChange={handleBannerFileChange}
                    />
                  </label>
                  <span className="text-[10px] text-text-muted">or paste a GIF URL (Tenor / Giphy)</span>
                </div>
                {bannerError && (
                  <p className="mt-1 flex items-center gap-1.5 text-[10px] text-red-400">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {bannerError}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-text-muted">
                  Images (.jpg, .png, .webp, .gif) and videos (.mp4, .webm) · max 8MB
                </p>
                {bannerUrl.trim() && (
                  <div className="mt-2 h-20 rounded-lg overflow-hidden relative bg-bg-primary">
                    <BannerMedia url={bannerUrl.trim()} />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-[#0e0e11]" />
                  </div>
                )}
              </div>

              {/* Name + Username */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                    <span className="text-violet-400">&gt;</span> NAME
                  </label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputBase} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                    <span className="text-violet-400">&gt;</span> USERNAME
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      const val = e.target.value.trimStart().toLowerCase()
                      setUsername(val)
                      setUsernameError(validateUsername(val))
                    }}
                    onBlur={() => setUsernameError(validateUsername(username))}
                    className={`${inputBase} ${usernameError ? 'border-red-500/50' : ''}`}
                  />
                  {usernameError && (
                    <p className="mt-1 flex items-center gap-1.5 text-[10px] text-red-400">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      {usernameError}
                    </p>
                  )}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                  <span className="text-violet-400">&gt;</span> STATUS
                </label>
                <select value={openTo} onChange={(e) => setOpenTo(e.target.value)} className={`${inputBase} appearance-none`}>
                  <option value="collaboration">Online</option>
                  <option value="jobs">Open to Work</option>
                  <option value="mentorship">Busy</option>
                  <option value="networking">Offline</option>
                </select>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                  <span className="text-violet-400">&gt;</span> BIO
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  placeholder="// Tell the world about yourself..."
                  className={`${inputBase} resize-none`}
                />
              </div>

              {/* Social Links */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                  <span className="text-violet-400">&gt;</span> SOCIAL_LINKS
                </label>
                <div className="space-y-2">
                  {[
                    { label: 'github', value: githubUrl, set: setGithubUrl, ph: 'github.com/username' },
                    { label: 'linkedin', value: linkedinUrl, set: setLinkedinUrl, ph: 'linkedin.com/in/...' },
                    { label: 'discord', value: discordUrl, set: setDiscordUrl, ph: 'username#0000' },
                    { label: 'portfolio', value: portfolioUrl, set: setPortfolioUrl, ph: 'https://...' },
                    { label: 'x', value: xUrl, set: setXUrl, ph: 'x.com/...' },
                  ].map(({ label, value, set, ph }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 w-20">{label}</span>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        placeholder={ph}
                        className={`${inputBase} flex-1`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Stack */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                  <span className="text-violet-400">&gt;</span> STACK <span className="text-zinc-600 normal-case">(comma separated)</span>
                </label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="React, TypeScript, Node.js, Python..."
                  className={inputBase}
                />
              </div>

              {/* ═══ LOCATION FIELDS ═══ */}
              <div className="border-t border-border-light pt-5 mt-2">
                <p className="text-[10px] font-bold text-accent tracking-widest mb-4 uppercase">
                  <MapPin className="h-3 w-3 inline mr-1" />
                  Location <span className="text-text-muted font-normal">(optional, approximate only)</span>
                </p>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                      <span className="text-violet-400">&gt;</span> COUNTRY
                    </label>
                    <select
                      value={countryCode}
                      onChange={(e) => {
                        const code = e.target.value
                        setCountryCode(code)
                        const found = COUNTRIES.find(c => c.code === code)
                        setCountry(found?.name || '')
                      }}
                      className={`${inputBase} appearance-none`}
                    >
                      <option value="">Select country</option>
                      {COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                      <span className="text-violet-400">&gt;</span> CITY
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Lima, Madrid..."
                      className={inputBase}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                      <span className="text-violet-400">&gt;</span> REGION
                    </label>
                    <input
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="e.g. California, Ontario..."
                      className={inputBase}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                      <span className="text-violet-400">&gt;</span> TIMEZONE
                    </label>
                    <input
                      type="text"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      placeholder="e.g. America/Lima"
                      className={inputBase}
                    />
                  </div>
                </div>
              </div>

              {/* ═══ MATCHING FIELDS ═══ */}
              <div className="border-t border-border-light pt-5 mt-2">
                <p className="text-[10px] font-bold text-accent tracking-widest mb-4 uppercase">
                  <Sparkles className="h-3 w-3 inline mr-1" />
                  Matching Profile
                </p>

                {/* Age Range */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                    <span className="text-violet-400">&gt;</span> AGE RANGE
                  </label>
                  <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)} className={`${inputBase} appearance-none`}>
                    <option value="">Prefer not to say</option>
                    {AGE_RANGE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                {/* Looking For */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                    <span className="text-violet-400">&gt;</span> LOOKING FOR
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {LOOKING_FOR_OPTIONS.map(opt => {
                      const isSelected = lookingFor.includes(opt.value)
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            if (isSelected) setLookingFor(prev => prev.filter(l => l !== opt.value))
                            else setLookingFor(prev => [...prev, opt.value])
                          }}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all border ${
                            isSelected
                              ? 'bg-accent text-white border-accent'
                              : 'bg-bg-input text-text-secondary border-border-light hover:border-accent/50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Interests */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                    <span className="text-violet-400">&gt;</span> INTERESTS
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {INTEREST_OPTIONS.map(opt => {
                      const isSelected = interests.includes(opt)
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            if (isSelected) setInterests(prev => prev.filter(i => i !== opt))
                            else setInterests(prev => [...prev, opt])
                          }}
                          className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all border ${
                            isSelected
                              ? 'bg-accent text-white border-accent'
                              : 'bg-bg-input text-text-secondary border-border-light hover:border-accent/50'
                          }`}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Availability */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                    <span className="text-violet-400">&gt;</span> AVAILABILITY
                  </label>
                  <select value={availability} onChange={(e) => setAvailability(e.target.value)} className={`${inputBase} appearance-none`}>
                    {AVAILABILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                {/* Visibility */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                    <span className="text-violet-400">&gt;</span> VISIBILITY
                  </label>
                  <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className={`${inputBase} appearance-none`}>
                    <option value="public">Public — appear in Discover</option>
                    <option value="matches_only">Matches Only</option>
                    <option value="hidden">Hidden — don't appear in Discover</option>
                  </select>
                </div>

                {/* Age Verified (for dating) */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-input border border-border-light">
                  <input
                    type="checkbox"
                    id="age-verified"
                    checked={ageVerified}
                    onChange={(e) => setAgeVerified(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-accent"
                  />
                  <label htmlFor="age-verified" className="text-xs text-text-secondary">
                    I am 18+ years old (required for Dating category)
                  </label>
                </div>
              </div>

              {/* Badges */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 tracking-widest mb-2">
                  <span className="text-violet-400">&gt;</span> BADGES
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_BADGES.map((b) => (
                    <label key={b.key} className="cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!badgeToggles[b.key]}
                        onChange={(e) => setBadgeToggles((prev) => ({ ...prev, [b.key]: e.target.checked }))}
                        className="peer hidden"
                      />
                      <span className={`badge ${b.color} inline-block px-2.5 py-1 text-xs rounded-md bg-bg-input opacity-40 peer-checked:opacity-100 transition-opacity ring-1 ring-inset ring-border-light/60`}>
                        [{b.label}]
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </form>

            {/* ── footer ── */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-bg-card-hover/60 shrink-0">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-bg-input text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !!usernameError}
                className="btn-edit px-5 py-2 text-sm rounded-lg bg-violet-500 text-white font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar modal */}
      {avatarModalOpen && profile?.avatar_url && (
        <AvatarModal
          src={profile.avatar_url}
          alt={displayName}
          onClose={() => setAvatarModalOpen(false)}
        />
      )}

      {/* Follow list modals */}
      {followersModalOpen && (
        <FollowListModal
          open={followersModalOpen}
          onClose={() => setFollowersModalOpen(false)}
          type="followers"
          profileId={profile.id}
        />
      )}
      {followingModalOpen && (
        <FollowListModal
          open={followingModalOpen}
          onClose={() => setFollowingModalOpen(false)}
          type="following"
          profileId={profile.id}
        />
      )}
    </>
  )
}
