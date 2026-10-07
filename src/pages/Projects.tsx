import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, Plus, Search, FolderGit2, Github, ExternalLink, MessageCircle,
  Bookmark, BookmarkCheck, Filter, Users, Trash2, Edit3, Star, ChevronDown,
} from 'lucide-react'
import { projects as projectsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useChat } from '../contexts/ChatContext'
import { getAvatarUrl } from '../lib/utils'
import { displayUsername } from '../lib/username'
import { PublishProjectModal } from '../components/PublishProjectModal'
import type { Project, ProjectStatus } from '../lib/types'

// ─── Constants ────────────────────────────────────────────
const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; dot: string }> = {
  idea: { label: 'Idea', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dot: 'bg-blue-400' },
  in_progress: { label: 'In Progress', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  beta: { label: 'Beta', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30', dot: 'bg-purple-400' },
  completed: { label: 'Completed', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
}

const STATUS_FILTERS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'idea', label: 'Idea' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'beta', label: 'Beta' },
  { value: 'completed', label: 'Completed' },
]

// ─── Helpers ──────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

// ─── Main Component ───────────────────────────────────────
export function Projects() {
  const { profile, requireAuth } = useAuth()
  const navigate = useNavigate()
  const { sendMessage } = useChat()

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const data = await projectsApi.list('created_at', undefined, statusFilter, search || undefined)
      setProjects(data as Project[])
    } catch {
      // ignore
    }
    setLoading(false)
  }, [statusFilter, search])

  useEffect(() => {
    const timer = setTimeout(loadProjects, 300)
    return () => clearTimeout(timer)
  }, [loadProjects])

  async function handleSaveToggle(project: Project) {
    if (!requireAuth()) return
    try {
      if (project.user_has_saved) {
        await projectsApi.unsave(project.id)
      } else {
        await projectsApi.save(project.id)
      }
      setProjects(prev => prev.map(p =>
        p.id === project.id
          ? { ...p, user_has_saved: !p.user_has_saved, save_count: p.save_count + (p.user_has_saved ? -1 : 1) }
          : p
      ))
    } catch {
      // ignore
    }
  }

  async function handleDelete(project: Project) {
    if (!confirm(`Delete "${project.title}"? This cannot be undone.`)) return
    try {
      await projectsApi.delete(project.id)
      setProjects(prev => prev.filter(p => p.id !== project.id))
    } catch {
      // ignore
    }
  }

  function handleMessageOwner(project: Project) {
    if (!requireAuth()) return
    if (project.author) {
      navigate(`/messages/${project.author.username}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary md:text-2xl">Projects</h1>
          <p className="mt-1 text-sm text-text-secondary">Discover projects, find collaborators, and build together.</p>
        </div>
        <button
          onClick={() => { if (!requireAuth()) return; setEditProject(null); setShowPublishModal(true) }}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-[0_0_24px_rgba(124,58,237,0.35)]"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Publish Project</span>
        </button>
      </header>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by name or description..."
            className="w-full rounded-xl bg-bg-input py-3 pl-11 pr-4 text-sm text-text-primary transition-all placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
          />
        </div>
        <div className="scrollbar-hidden flex items-center gap-1 overflow-x-auto rounded-xl bg-bg-card p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                statusFilter === f.value
                  ? 'bg-accent-muted text-accent'
                  : 'text-text-muted hover:bg-bg-card-hover hover:text-text-primary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isOwn={profile?.id === project.author_id}
              onSave={() => handleSaveToggle(project)}
              onDelete={() => handleDelete(project)}
              onEdit={() => { setEditProject(project); setShowPublishModal(true) }}
              onMessage={() => handleMessageOwner(project)}
            />
          ))}
        </div>
      ) : (
        <div className="animate-fade-in rounded-2xl bg-bg-card p-10 text-center sm:p-12 md:p-20">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted md:h-16 md:w-16">
            <FolderGit2 className="h-7 w-7 text-accent md:h-8 md:w-8" />
          </div>
          <p className="text-base font-medium text-text-primary md:text-lg">
            {search || statusFilter !== 'all' ? 'No projects found' : 'No projects yet'}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {search || statusFilter !== 'all' ? 'Try a different search or filter.' : 'Be the first to publish a project.'}
          </p>
          {!search && statusFilter === 'all' && (
            <button
              onClick={() => { if (!requireAuth()) return; setShowPublishModal(true) }}
              className="mt-4 flex items-center gap-2 mx-auto rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" /> Publish Project
            </button>
          )}
        </div>
      )}

      {/* Publish/Edit Modal */}
      {showPublishModal && (
        <PublishProjectModal
          editProject={editProject}
          onClose={() => { setShowPublishModal(false); setEditProject(null) }}
          onCreated={loadProjects}
        />
      )}
    </div>
  )
}

// ─── Project Card ─────────────────────────────────────────
function ProjectCard({
  project,
  isOwn,
  onSave,
  onDelete,
  onEdit,
  onMessage,
}: {
  project: Project
  isOwn: boolean
  onSave: () => void
  onDelete: () => void
  onEdit: () => void
  onMessage: () => void
}) {
  const statusCfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.idea

  return (
    <div className="animate-fade-in rounded-2xl bg-bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 flex flex-col sm:p-5">
      {/* Header: author + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {project.author && (
            <>
              <img
                src={getAvatarUrl(project.author.avatar_url, project.author.username)}
                alt={project.author.full_name}
                className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{project.author.full_name}</p>
                <p className="text-[10px] text-text-muted">@{displayUsername(project.author.username)}</p>
              </div>
            </>
          )}
        </div>
        <span className={`shrink-0 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusCfg.color}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
          {statusCfg.label}
        </span>
      </div>

      {/* Title + Description */}
      <h2 className="mt-3 text-base font-bold text-text-primary leading-snug">{project.title}</h2>
      <p className="mt-1.5 text-sm text-text-secondary line-clamp-2 leading-relaxed">{project.description}</p>

      {/* Tech Stack */}
      {project.tech_stack.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {project.tech_stack.slice(0, 5).map((tech) => (
            <span key={tech} className="rounded-md bg-bg-input px-2 py-0.5 text-[10px] font-medium text-text-secondary">
              {tech}
            </span>
          ))}
          {project.tech_stack.length > 5 && (
            <span className="text-[10px] text-text-muted">+{project.tech_stack.length - 5}</span>
          )}
        </div>
      )}

      {/* Looking For */}
      {project.looking_for.length > 0 && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <Users className="h-3 w-3 text-text-muted shrink-0" />
          <span className="text-[10px] text-text-muted">Looking for:</span>
          <div className="flex flex-wrap gap-1">
            {project.looking_for.map((role) => (
              <span key={role} className="text-[10px] font-medium text-accent">{role}</span>
            ))}
          </div>
        </div>
      )}

      {/* Spacer to push actions to bottom */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between border-t border-border-light pt-3">
        <div className="flex items-center gap-1.5">
          {/* Save */}
          <button
            onClick={onSave}
            className={`rounded-lg p-2 transition-all ${
              project.user_has_saved
                ? 'text-accent bg-accent-muted'
                : 'text-text-muted hover:bg-bg-card-hover hover:text-text-primary'
            }`}
            title={project.user_has_saved ? 'Unsave' : 'Save'}
          >
            {project.user_has_saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </button>
          {project.save_count > 0 && (
            <span className="text-[10px] text-text-muted">{project.save_count}</span>
          )}

          {/* GitHub */}
          {project.repo_url && (
            <a
              href={project.repo_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
              title="GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
          )}

          {/* Live */}
          {project.live_url && (
            <a
              href={project.live_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
              title="Live Demo"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Message owner */}
          {!isOwn && (
            <button
              onClick={onMessage}
              className="flex items-center gap-1.5 rounded-lg bg-accent-muted px-3 py-1.5 text-[11px] font-medium text-accent transition-all hover:bg-accent hover:text-white"
            >
              <MessageCircle className="h-3 w-3" /> Message
            </button>
          )}

          {/* Own: Edit + Delete */}
          {isOwn && (
            <>
              <button
                onClick={onEdit}
                className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
                title="Edit"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="rounded-lg p-2 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <p className="mt-2 text-[10px] text-text-muted">{timeAgo(project.created_at)}</p>
    </div>
  )
}
