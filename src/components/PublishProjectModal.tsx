import { useState, useEffect, useCallback } from 'react'
import { X, Loader2, Upload, Github, Link2, FileCode2 } from 'lucide-react'
import { projects as projectsApi } from '../lib/api'
import type { Project, ProjectStatus } from '../lib/types'

const STATUS_OPTIONS: { value: ProjectStatus; label: string; color: string }[] = [
  { value: 'idea', label: 'Idea', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { value: 'beta', label: 'Beta', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { value: 'completed', label: 'Completed', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
]

const LOOKING_FOR_OPTIONS = [
  'Frontend', 'Backend', 'Fullstack', 'Designer', 'Mentor', 'Tester', 'DevOps', 'Mobile',
]

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

const inputBase = 'w-full rounded-xl bg-bg-input px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-all'

interface Props {
  onClose: () => void
  onCreated: () => void
  editProject?: Project | null
}

export function PublishProjectModal({ onClose, onCreated, editProject }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('idea')
  const [techStack, setTechStack] = useState('')
  const [lookingFor, setLookingFor] = useState<string[]>([])
  const [repoUrl, setRepoUrl] = useState('')
  const [liveUrl, setLiveUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editProject) {
      setTitle(editProject.title)
      setDescription(editProject.description)
      setStatus(editProject.status)
      setTechStack(editProject.tech_stack.join(', '))
      setLookingFor(editProject.looking_for)
      setRepoUrl(editProject.repo_url ?? '')
      setLiveUrl(editProject.live_url ?? '')
      setImageUrl(editProject.image_url ?? '')
      setFileName(editProject.file_url ?? '')
    }
  }, [editProject])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const toggleLookingFor = useCallback((item: string) => {
    setLookingFor(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item])
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError('')
    if (!file.name.endsWith('.zip')) {
      setFileError('Only .zip files are accepted')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('Use a GitHub link for projects larger than 25MB')
      return
    }
    setFileName(file.name)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        status,
        tech_stack: techStack.split(',').map(t => t.trim()).filter(Boolean),
        looking_for: lookingFor,
        repo_url: repoUrl.trim() || null,
        live_url: liveUrl.trim() || null,
        file_url: fileName || null,
        image_url: imageUrl.trim() || null,
      }

      if (editProject) {
        await projectsApi.update(editProject.id, payload)
      } else {
        await projectsApi.create(payload)
      }
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save project')
    }
    setLoading(false)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-bg-card shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 bg-bg-card z-10">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-muted">
              <FileCode2 className="h-4 w-4 text-accent" />
            </div>
            <h2 className="text-sm font-bold text-text-primary">
              {editProject ? 'Edit Project' : 'Publish Project'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <p className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-xs text-danger">{error}</p>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Project Name *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My awesome project"
              className={inputBase}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Description *</label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this project do? What problem does it solve?"
              rows={3}
              className={`${inputBase} resize-none`}
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    status === opt.value
                      ? `${opt.color} shadow-sm`
                      : 'border-border bg-bg-input text-text-muted hover:border-border-light'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tech Stack */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Tech Stack</label>
            <input
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              placeholder="React, TypeScript, Node.js, PostgreSQL..."
              className={inputBase}
            />
          </div>

          {/* Looking For */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Looking For</label>
            <div className="flex flex-wrap gap-2">
              {LOOKING_FOR_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleLookingFor(item)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    lookingFor.includes(item)
                      ? 'border-accent/40 bg-accent-muted text-accent'
                      : 'border-border bg-bg-input text-text-muted hover:border-border-light'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* GitHub URL */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              <Github className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />GitHub URL
            </label>
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/user/repo"
              className={inputBase}
            />
          </div>

          {/* Live URL */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              <Link2 className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />Live Demo URL
            </label>
            <input
              value={liveUrl}
              onChange={(e) => setLiveUrl(e.target.value)}
              placeholder="https://myproject.vercel.app"
              className={inputBase}
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              <Link2 className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />Preview Image URL
            </label>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://... (optional preview image)"
              className={inputBase}
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              <Upload className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />Attach File (.zip, max 25MB)
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-bg-input px-4 py-3 text-sm text-text-muted cursor-pointer transition-colors hover:border-accent/40 hover:text-text-secondary">
              <Upload className="h-4 w-4 shrink-0" />
              <span className="truncate">{fileName || 'Choose a .zip file'}</span>
              <input type="file" accept=".zip" className="hidden" onChange={handleFileChange} />
            </label>
            {fileError && <p className="mt-1 text-xs text-danger">{fileError}</p>}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-bg-input px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-card-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !!fileError}
              className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-[0_0_16px_rgba(124,58,237,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode2 className="h-4 w-4" />}
              {editProject ? 'Save Changes' : 'Publish Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
