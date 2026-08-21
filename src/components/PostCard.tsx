import { useState } from 'react'
import { Heart, Trash2, MessageCircle, Share2, Send, Loader2 } from 'lucide-react'
import { posts as postsApi, likes as likesApi, comments as commentsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { Post, Comment } from '../lib/types'

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
  const { profile } = useAuth()
  const [deleting, setDeleting] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentList, setCommentList] = useState<Comment[]>([])
  const [commentLoading, setCommentLoading] = useState(false)
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [sendingComment, setSendingComment] = useState(false)
  const [copied, setCopied] = useState(false)

  const author = post.author
  const liked = post.liked_by_me ?? false
  const commentCount = post.comment_count ?? 0

  async function handleLike() {
    if (!profile) return
    try {
      await likesApi.toggle(post.id, liked)
      onToggleLike(post.id)
    } catch {
      // ignore
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await postsApi.delete(post.id)
      onDelete(post.id)
    } catch {
      // ignore
    }
    setDeleting(false)
  }

  async function toggleComments() {
    if (showComments) {
      setShowComments(false)
      return
    }
    setShowComments(true)
    if (!commentsLoaded) {
      setCommentLoading(true)
      try {
        const data = await commentsApi.list(post.id)
        setCommentList(data ?? [])
        setCommentsLoaded(true)
      } catch {
        // ignore
      }
      setCommentLoading(false)
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim() || sendingComment) return

    setSendingComment(true)
    try {
      const newComment = await commentsApi.create(post.id, commentText.trim())
      setCommentList((prev) => [...prev, newComment])
      setCommentText('')
    } catch {
      // ignore
    }
    setSendingComment(false)
  }

  function handleShare() {
    const url = `${window.location.origin}/#${post.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <article className="animate-fade-in rounded-2xl border border-border bg-bg-card p-5 transition-all duration-200 hover:border-border-light">
      {/* Author header */}
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
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Content */}
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{post.content}</p>

      {/* Action bar: Like · Comment · Share */}
      <div className="mt-4 flex items-center gap-5">
        {/* Like */}
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
            liked ? 'text-danger' : 'text-text-muted hover:text-danger'
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
          {post.like_count ?? 0}
        </button>

        {/* Comment */}
        <button
          onClick={toggleComments}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
            showComments ? 'text-accent' : 'text-text-muted hover:text-accent'
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          {commentCount}
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
            copied ? 'text-success' : 'text-text-muted hover:text-accent'
          }`}
        >
          <Share2 className="h-4 w-4" />
          {copied ? 'Copied!' : 'Share'}
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="mt-4 border-t border-border pt-4">
          {commentLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
            </div>
          ) : commentList.length > 0 ? (
            <div className="space-y-3">
              {commentList.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-[10px] font-bold text-accent">
                    {c.user?.avatar_url ? (
                      <img src={c.user.avatar_url} alt={c.user.full_name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      getInitials(c.user?.full_name)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-primary">
                        {c.user?.full_name ?? 'Unknown'}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {timeAgo(c.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-text-muted py-2">No comments yet. Be the first!</p>
          )}

          {/* Comment input */}
          <form onSubmit={handleComment} className="mt-3 flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-[10px] font-bold text-accent">
              {getInitials(profile?.full_name)}
            </div>
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 rounded-xl border border-border bg-bg-input px-3 py-2 text-xs text-text-primary transition-all placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
            />
            <button
              type="submit"
              disabled={!commentText.trim() || sendingComment}
              className="rounded-xl bg-accent p-2 text-white transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendingComment ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </form>
        </div>
      )}
    </article>
  )
}
