import { useEffect, useState } from 'react'
import { GitBranch, ArrowUpRight, Sparkles, TrendingUp, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Profile, Project } from '../lib/types'

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export function RightSidebar() {
  const [stats, setStats] = useState({ developers: 0, projects: 0, posts: 0 })
  const [buddies, setBuddies] = useState<Profile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const [devsRes, projRes, postsRes, topProjRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('posts').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('*, author:profiles(*)').order('stars', { ascending: false }).limit(3),
      ])

      setStats({
        developers: devsRes.count ?? 0,
        projects: projRes.count ?? 0,
        posts: postsRes.count ?? 0,
      })

      if (topProjRes.data) {
        setProjects(topProjRes.data as unknown as Project[])
      }

      const { data: buddyData } = await supabase
        .from('profiles')
        .select('*')
        .limit(3)
      if (buddyData) setBuddies(buddyData as Profile[])

      setLoading(false)
    }
    loadData()
  }, [])

  return (
    <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-border bg-bg-primary lg:block">
      <div className="sticky top-0 space-y-5 p-5">
        {/* Trending Stats */}
        <section className="rounded-2xl border border-border bg-bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">Community</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-bg-primary p-3 text-center">
              <p className="text-xl font-bold text-accent">{stats.developers}</p>
              <p className="mt-0.5 text-[11px] text-text-muted">Devs</p>
            </div>
            <div className="rounded-xl bg-bg-primary p-3 text-center">
              <p className="text-xl font-bold text-secondary">{stats.projects}</p>
              <p className="mt-0.5 text-[11px] text-text-muted">Projects</p>
            </div>
            <div className="rounded-xl bg-bg-primary p-3 text-center">
              <p className="text-xl font-bold text-success">{stats.posts}</p>
              <p className="mt-0.5 text-[11px] text-text-muted">Posts</p>
            </div>
          </div>
        </section>

        {/* Suggested Buddies */}
        <section className="rounded-2xl border border-border bg-bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-semibold text-text-primary">Suggested Buddies</h3>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-bg-primary" />
              ))}
            </div>
          ) : buddies.length > 0 ? (
            <div className="space-y-3">
              {buddies.map((buddy) => (
                <div key={buddy.id} className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-bg-card-hover">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-xs font-bold text-accent">
                    {buddy.avatar_url ? (
                      <img src={buddy.avatar_url} alt={buddy.full_name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      getInitials(buddy.full_name)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{buddy.full_name}</p>
                    <p className="truncate text-xs text-text-muted">
                      {buddy.skills.slice(0, 2).join(' · ') || 'Developer'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">No buddies yet</p>
          )}
        </section>

        {/* Featured Projects */}
        <section className="rounded-2xl border border-border bg-bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">Featured Projects</h3>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-bg-primary" />
              ))}
            </div>
          ) : projects.length > 0 ? (
            <div className="space-y-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group cursor-pointer rounded-xl border border-border p-3 transition-all duration-200 hover:border-border-light hover:bg-bg-card-hover"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary transition-colors group-hover:text-accent">
                        {project.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-text-muted">{project.description}</p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    {project.tech_stack[0] && (
                      <span className="flex items-center gap-1 text-[11px] text-text-muted">
                        <span className="h-2 w-2 rounded-full bg-accent" />
                        {project.tech_stack[0]}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] text-text-muted">
                      <Star className="h-3 w-3 text-gold" />
                      {project.stars}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">No projects yet</p>
          )}
        </section>

        <footer className="px-1 pb-4">
          <p className="text-[11px] leading-relaxed text-text-muted">
            About · Help · Terms · Privacy
          </p>
          <p className="mt-1 text-[11px] text-text-muted">© 2026 CodeBuds</p>
        </footer>
      </div>
    </aside>
  )
}
