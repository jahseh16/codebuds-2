import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitBranch, ArrowUpRight, Sparkles, TrendingUp, Star, MessageCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { profiles as profilesApi, projects as projectsApi, posts as postsApi } from '../lib/api'
import { UserLink } from './UserLink'
import type { Profile, Project } from '../lib/types'

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export function RightSidebar() {
  const navigate = useNavigate()
  const { requireAuth } = useAuth()
  const [stats, setStats] = useState({ developers: 0, projects: 0, posts: 0 })
  const [buddies, setBuddies] = useState<Profile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [devsCount, projCount, postsCount, topProjects, buddyData] = await Promise.all([
          profilesApi.count(),
          projectsApi.count(),
          postsApi.count(),
          projectsApi.list('stars', 3),
          // Cap suggested buddies at 5 — we only render 3, so no need to
          // download the whole user table on every page load (mobile data)
          profilesApi.list(undefined, 5),
        ])

        setStats({
          developers: devsCount.count,
          projects: projCount.count,
          posts: postsCount.count,
        })

        setProjects(topProjects as unknown as Project[])
        setBuddies((buddyData as Profile[]).slice(0, 3))
      } catch {
        // ignore
      }
      setLoading(false)
    }
    loadData()
  }, [])

  return (
    <aside className="hidden h-full w-80 shrink-0 overflow-y-auto bg-bg-primary lg:block">
      <div className="space-y-5 p-5">
        {/* Trending Stats */}
        <section className="rounded-2xl bg-bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Community</h2>
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
        <section className="rounded-2xl bg-bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-semibold text-text-primary">Suggested Buddies</h2>
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
                <div key={buddy.id} className="group rounded-xl p-2 transition-colors hover:bg-bg-card-hover">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <UserLink
                        userId={buddy.id}
                        username={buddy.username}
                        name={buddy.full_name}
                        avatarUrl={buddy.avatar_url}
                        size="sm"
                        showName
                        className="min-w-0"
                      />
                      <p className="ml-10 mt-0.5 truncate text-xs text-text-muted">
                        {buddy.skills.slice(0, 2).join(' · ') || 'Developer'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (!requireAuth()) return
                        navigate(`/messages/${buddy.username}`)
                      }}
                      className="shrink-0 rounded-lg p-1.5 text-text-muted transition-all hover:bg-accent/10 hover:text-accent"
                      title={`Message ${buddy.full_name}`}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">No buddies yet</p>
          )}
        </section>

        {/* Featured Projects */}
        <section className="rounded-2xl bg-bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">Featured Projects</h2>
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
                  className="group cursor-pointer rounded-xl p-3 transition-all duration-200 hover:bg-bg-card-hover"
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
