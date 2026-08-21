import { useState, type FormEvent } from 'react'
import { Loader2, Send, X } from 'lucide-react'
import { posts as postsApi } from '../lib/api'
import type { PostCategory } from '../lib/types'

const CATEGORIES: { value: PostCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'mentorship', label: 'Mentorship' },
  { value: 'project', label: 'Project' },
  { value: 'team', label: 'Team' },
]

interface CreatePostCardProps {
  onCreated: () => void
  onClose: () => void
}

export function CreatePostCard({ onCreated, onClose }: CreatePostCardProps) {
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<PostCategory>('general')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) return

    setLoading(true)
    setError('')

    try {
      await postsApi.create(content.trim(), category)
      setContent('')
      setCategory('general')
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
        <h3 className="text-sm font-semibold text-text-primary">Create Post</h3>
        <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary">
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-danger-muted px-3 py-2 text-xs text-danger">{error}</p>
      )}

      <form onSubmit={handleSubmit}>
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share something with the CodeBuds community..."
          rows={4}
          className="w-full resize-none rounded-xl border border-border bg-bg-input px-4 py-3 text-sm text-text-primary transition-all placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
        />

        <div className="mt-3 flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  category === cat.value
                    ? 'bg-accent text-white'
                    : 'border border-border text-text-secondary hover:border-border-light hover:text-text-primary'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Post
          </button>
        </div>
      </form>
    </div>
  )
}
