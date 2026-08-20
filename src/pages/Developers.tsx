import { useState, useEffect } from 'react'
import { Loader2, Search, UserPlus, MapPin, Github, Linkedin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Profile } from '../lib/types'

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export function Developers() {
  const { session } = useAuth()
  const [developers, setDevelopers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [buddyIds, setBuddyIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const [devsRes, buddiesRes] = await Promise.all([
        supabase.from('profiles').select('*').neq('id', session?.user?.id ?? '').order('created_at', { ascending: false }),
        supabase.from('buddies').select('addressee_id').eq('requester_id', session?.user?.id ?? ''),
      ])

      if (devsRes.data) setDevelopers(devsRes.data as Profile[])
      if (buddiesRes.data) setBuddyIds(new Set(buddiesRes.data.map((b: { addressee_id: string }) => b.addressee_id)))
      setLoading(false)
    }
    if (session?.user) load()
  }, [session?.user])

  async function addBuddy(devId: string) {
    if (!session?.user) return
    const { error } = await supabase.from('buddies').insert({
      requester_id: session.user.id,
      addressee_id: devId,
    })

    if (!error) {
      setBuddyIds((prev) => new Set(prev).add(devId))
      await supabase.from('notifications').insert({
        user_id: devId,
        actor_id: session.user.id,
        type: 'buddy_request',
        message: 'sent you a buddy request',
      })
    }
  }

  const filtered = developers.filter((d) => {
    const q = search.toLowerCase()
    return (
      d.full_name.toLowerCase().includes(q) ||
      d.username.toLowerCase().includes(q) ||
      d.skills.some((s) => s.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">Buddies</h1>
        <p className="mt-1 text-sm text-text-secondary">Connect with fellow developers.</p>
      </header>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, username, or skill..."
          className="w-full rounded-xl border border-border bg-bg-input py-3 pl-11 pr-4 text-sm text-text-primary transition-all placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((dev) => (
            <div key={dev.id} className="animate-fade-in rounded-2xl border border-border bg-bg-card p-5 transition-all duration-200 hover:border-border-light">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-base font-bold text-accent">
                  {dev.avatar_url ? (
                    <img src={dev.avatar_url} alt={dev.full_name} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    getInitials(dev.full_name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary">{dev.full_name}</p>
                  <p className="truncate text-xs text-text-muted">@{dev.username}</p>
                  {dev.location && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                      <MapPin className="h-3 w-3" />
                      {dev.location}
                    </p>
                  )}
                </div>
              </div>

              {dev.bio && <p className="mt-3 text-sm text-text-secondary">{dev.bio}</p>}

              {dev.skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {dev.skills.slice(0, 4).map((skill) => (
                    <span key={skill} className="rounded-md bg-accent-muted px-2 py-1 text-[11px] font-medium text-accent">
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => addBuddy(dev.id)}
                  disabled={buddyIds.has(dev.id)}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {buddyIds.has(dev.id) ? 'Requested' : 'Add Buddy'}
                </button>
                {dev.github_url && (
                  <a href={dev.github_url} target="_blank" rel="noreferrer" className="rounded-lg border border-border p-2 text-text-muted transition-colors hover:border-border-light hover:text-text-primary">
                    <Github className="h-4 w-4" />
                  </a>
                )}
                {dev.linkedin_url && (
                  <a href={dev.linkedin_url} target="_blank" rel="noreferrer" className="rounded-lg border border-border p-2 text-text-muted transition-colors hover:border-border-light hover:text-text-primary">
                    <Linkedin className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card p-20 text-center">
          <p className="text-lg font-medium text-text-primary">No developers found</p>
          <p className="mt-1 text-sm text-text-muted">Try a different search.</p>
        </div>
      )}
    </div>
  )
}
