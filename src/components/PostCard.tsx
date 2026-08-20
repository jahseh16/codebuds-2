import { useState } from 'react'
import { Heart, Trash2, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Post } from '../lib/types'

function getInitials(name?: string | null): string {
  if (!name) return 'U'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-accent-muted text-accent',
  mentorship: 'bg-secondary-muted text-secondary',
  project: 'bg-success-muted text-success',
  team: 'bg-gold-muted text-gold',
}

interface PostCardProps {
  post: Post
  canDelete: boolean
  onDelete: (postId: string) => void
  onToggleLike: (postId: string) => void
}

export function PostCard({ post, canDelete, onDelete, onToggleLike }: PostCardProps) {
  const { session } = useAuth()
  const [deleting, setDeleting] = useState(false)
  const author = post.author
  const liked = post.liked_by_me ?? false

  async function handleLike() {
    if (!session?.user) return

    if (liked) {
      await supabase.from('likes').delete()
        .eq('post_id', post.id)
        .eq('user_id', session.user.id)
    } else {
      await supabase.from('likes').insert({
        post_id: post.id,
        user_id: session.user.id,
      })

      if (post.author_id !== session.user.id) {
        await supabase.from('notifications').insert({
          user_id: post.author_id,
          actor_id: session.user.id,
          type: 'like',
          message: 'liked your post',
        })
      }
    }
    onToggleLike(post.id)
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    setDeleting(false)
    if (!error) onDelete(post.id)
  }

  return (
    <article className="animate-fade-in rounded-2xl border border-border bg-bg-card p-5 transition-all duration-200 hover:border-border-light">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-sm font-bold text-accent">
          {author?.avatar_url ? (
            <img src={author.avatar_url} alt={author.full_name} className="h-full w-full rounded-full object-cover" />
          ) : (
            getInitials(author?.full_name)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-text-primary">
              {author?.full_name ?? 'Unknown'}
            </p>
            <span className="text-xs text-text-muted">
              {author?.username ? `@${author.username}` : ''} · {timeAgo(post.created_at)}
            </span>
          </div>

          <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${CATEGORY_COLORS[post.category] ?? CATEGORY_COLORS.general}`}>
            {post.category}
          </span>
        </div>

        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Delete post"
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-danger-muted hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{post.content}</p>

      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
            liked ? 'text-danger' : 'text-text-muted hover:text-danger'
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
          {post.like_count ?? 0}
        </button>

        <button className="flex items-center gap-1.5 text-xs font-medium text-text-muted transition-colors hover:text-accent">
          <MessageCircle className="h-4 w-4" />
          0
        </button>
      </div>
    </article>
  )
}
