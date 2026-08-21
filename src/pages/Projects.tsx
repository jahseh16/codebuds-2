import { useState, useEffect } from 'react'
import { Loader2, Plus, Star, Github, ExternalLink, X, Send } from 'lucide-react'
import { projects as projectsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { Project } from '../lib/types'

function getInitials(name?: string | null): string {
  if (!name) return 'U'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export function Projects() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploader, setShowUploader] = useState(false)

  async function loadProjects() {
    setLoading(true)
    try {
      const data = await projectsApi.list()
      setProjects(data as unknown as Project[])
    } catch {
      // ignore
    }
    setLoading(false)
  }

  useEffect(() => {
    loadProjects()
  }, [])

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Projects</h1>
          <p className="mt-1 text-sm text-text-secondary">Discover and share developer projects.</p>
        </div>
        <button
          onClick={() => setShowUploader(true)}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-[0_0_24px_rgba(20,184,166,0.35)]"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Project</span>
        </button>
      </header>

      {showUploader && (
        <ProjectUploader onCreated={loadProjects} onClose={() => setShowUploader(false)} />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <div key={project.id} className="animate-fade-in rounded-2xl border border-border bg-bg-card p-5 transition-all duration-200 hover:border-border-light">
              {project.image_url && (
                <div className="mb-4 overflow-hidden rounded-xl">
                  <img src={project.image_url} alt={project.title} className="h-40 w-full object-cover" />
                </div>
              )}

              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-text-primary">{project.title}</h3>
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <Star className="h-3.5 w-3.5 text-gold" />
                  {project.stars}
                </span>
              </div>

              <p className="mt-2 text-sm text-text-secondary">{project.description}</p>

              {project.tech_stack.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {project.tech_stack.map((tech) => (
                    <span key={tech} className="rounded-md bg-accent-muted px-2 py-1 text-[11px] font-medium text-accent">
                      {tech}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-[10px] font-bold text-accent">
                    {project.author?.avatar_url ? (
                      <img src={project.author.avatar_url} alt={project.author.full_name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      getInitials(project.author?.full_name)
                    )}
                  </div>
                  <span className="text-xs text-text-muted">{project.author?.full_name ?? 'Unknown'}</span>
                </div>

                <div className="flex items-center gap-2">
                  {project.repo_url && (
                    <a href={project.repo_url} target="_blank" rel="noreferrer" className="rounded-lg border border-border p-1.5 text-text-muted transition-colors hover:border-border-light hover:text-text-primary">
                      <Github className="h-4 w-4" />
                    </a>
                  )}
                  {project.live_url && (
                    <a href={project.live_url} target="_blank" rel="noreferrer" className="rounded-lg border border-border p-1.5 text-text-muted transition-colors hover:border-border-light hover:text-text-primary">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card p-20 text-center">
          <p className="text-lg font-medium text-text-primary">No projects yet</p>
          <p className="mt-1 text-sm text-text-muted">Share your first project with the community.</p>
        </div>
      )}
    </div>
  )
}

function ProjectUploader({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [techStack, setTechStack] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [liveUrl, setLiveUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await projectsApi.create({
        title: title.trim(),
        description: description.trim(),
        tech_stack: techStack.split(',').map((t) => t.trim()).filter(Boolean),
        repo_url: repoUrl.trim() || null,
        live_url: liveUrl.trim() || null,
        image_url: imageUrl.trim() || null,
      })
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.message)
    }

    setLoading(false)
  }

  return (
    <div className="animate-slide-up rounded-2xl border border-border bg-bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Share a Project</h3>
        <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary">
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && <p className="mb-3 rounded-lg bg-danger-muted px-3 py-2 text-xs text-danger">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Project title"
          className="w-full rounded-xl border border-border bg-bg-input px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <textarea
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description"
          rows={3}
          className="w-full resize-none rounded-xl border border-border bg-bg-input px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <input
          value={techStack}
          onChange={(e) => setTechStack(e.target.value)}
          placeholder="Tech stack (comma separated: React, Node, ...)"
          className="w-full rounded-xl border border-border bg-bg-input px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <input
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="GitHub repo URL (optional)"
          className="w-full rounded-xl border border-border bg-bg-input px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <input
          value={liveUrl}
          onChange={(e) => setLiveUrl(e.target.value)}
          placeholder="Live demo URL (optional)"
          className="w-full rounded-xl border border-border bg-bg-input px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Preview image URL (optional)"
          className="w-full rounded-xl border border-border bg-bg-input px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Share Project
        </button>
      </form>
    </div>
  )
}
