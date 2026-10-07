import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Search, UserPlus, MapPin, Github, Linkedin, MessageCircle, Zap, Users } from 'lucide-react'
import { profiles as profilesApi, buddies as buddiesApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { UserLink } from '../components/UserLink'
import type { Profile } from '../lib/types'

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

const OPEN_TO_CONFIG: Record<string, { label: string; color: string }> = {
  collaboration: { label: 'Open to collaboration', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  jobs: { label: 'Open to work', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  mentorship: { label: 'Available for mentoring', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  networking: { label: 'Networking', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
}

export function Developers() {
  const { profile, requireAuth } = useAuth()
  const navigate = useNavigate()
  const [developers, setDevelopers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [buddyIds, setBuddyIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const [devs, myBuddies] = profile
        ? await Promise.all([
            profilesApi.list(profile.id),
            buddiesApi.list(profile.id),
          ])
        : [await profilesApi.list(), []]
      setDevelopers(devs as Profile[])
      setBuddyIds(new Set((myBuddies as any[]).map((b: any) => b.addressee_id)))
      setLoading(false)
    }
    load()
  }, [profile])

  async function addBuddy(devId: string) {
    if (!requireAuth()) return
    if (!profile) return
    try {
      await buddiesApi.create(devId)
      setBuddyIds((prev) => new Set(prev).add(devId))
    } catch {
      // ignore
    }
  }

  function handleMessage(dev: Profile) {
    if (!requireAuth()) return
    navigate(`/messages/${dev.username}`)
  }

  const filtered = developers.filter((d) => {
    const q = search.toLowerCase()
    return (
      d.full_name.toLowerCase().includes(q) ||
      d.username.toLowerCase().includes(q) ||
      d.skills.some((s) => s.toLowerCase().includes(q)) ||
      (d.location && d.location.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-text-primary md:text-2xl">Buddies</h1>
        <p className="mt-1 text-sm text-text-secondary">Find collaborators, mentors, and fellow developers.</p>
      </header>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, username, skill, or location..."
          className="w-full rounded-xl bg-bg-input py-3 pl-11 pr-4 text-sm text-text-primary transition-all placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((dev) => {
            const openCfg = OPEN_TO_CONFIG[dev.open_to]
            return (
              <div key={dev.id} className="animate-fade-in rounded-2xl bg-bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 sm:p-5">
                <div className="flex items-start gap-3">
                  <UserLink
                    userId={dev.id}
                    username={dev.username}
                    name={dev.full_name}
                    avatarUrl={dev.avatar_url}
                    size="lg"
                    showName
                    showUsername
                    className="min-w-0"
                  />
                  {dev.location && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-text-muted ml-auto shrink-0">
                      <MapPin className="h-3 w-3" />
                      {dev.location}
                    </p>
                  )}
                </div>

                {/* Open to badge */}
                {openCfg && (
                  <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${openCfg.color}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                    {openCfg.label}
                  </span>
                )}

                {dev.bio && <p className="mt-2.5 text-sm text-text-secondary line-clamp-2">{dev.bio}</p>}

                {dev.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {dev.skills.slice(0, 5).map((skill) => (
                      <span key={skill} className="rounded-md bg-bg-input px-2 py-0.5 text-[10px] font-medium text-text-secondary transition-colors">
                        {skill}
                      </span>
                    ))}
                    {dev.skills.length > 5 && (
                      <span className="text-[10px] text-text-muted">+{dev.skills.length - 5}</span>
                    )}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => handleMessage(dev)}
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-[0_0_12px_rgba(124,58,237,0.25)]"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Message
                  </button>
                  <button
                    onClick={() => addBuddy(dev.id)}
                    disabled={buddyIds.has(dev.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-bg-input px-3 py-2 text-xs font-medium text-text-secondary transition-all hover:bg-bg-card-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {buddyIds.has(dev.id) ? 'Requested' : 'Add Buddy'}
                  </button>
                  {dev.github_url && (
                    <a href={dev.github_url} target="_blank" rel="noreferrer" className="rounded-lg bg-bg-input p-2 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary">
                      <Github className="h-4 w-4" />
                    </a>
                  )}
                  {dev.linkedin_url && (
                    <a href={dev.linkedin_url} target="_blank" rel="noreferrer" className="rounded-lg bg-bg-input p-2 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary">
                      <Linkedin className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="animate-fade-in rounded-2xl bg-bg-card p-10 text-center sm:p-12 md:p-20">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted md:h-16 md:w-16">
            <Users className="h-7 w-7 text-accent md:h-8 md:w-8" />
          </div>
          <p className="text-base font-medium text-text-primary md:text-lg">No developers found</p>
          <p className="mt-1 text-sm text-text-muted">Try a different search term or clear your filters.</p>
        </div>
      )}
    </div>
  )
}
