import { useState, useEffect } from 'react'
import { Heart, MessageCircle, Share2, Send, Loader2, Eye, Bookmark } from 'lucide-react'
import { posts as postsApi, likes as likesApi, comments as commentsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { UserLink } from './UserLink'
import { PostMenu } from './PostMenu'
import { LikesModal } from './LikesModal'
import { CodeContent } from './CodeContent'
import { ContentEmbeds } from './LinkEmbed'
import { getAvatarUrl } from '../lib/utils'
import type { Post, Comment } from '../lib/types'

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

/* ─── Determine if content contains code blocks ──────── */
function hasCodeBlocks(content: string): boolean {
  return /```[\s\S]*?```/.test(content)
}

/* ═══════════════════════════════════════════════════════════
   POST CARD
   ═══════════════════════════════════════════════════════════ */
interface PostCardProps {
  post: Post
  canDelete: boolean
  onDelete: (postId: string) => void
  onToggleLike: (postId: string) => void
}

export function PostCard({ post, canDelete, onDelete, onToggleLike }: PostCardProps) {
  const { profile, requireAuth } = useAuth()
  const [deleting, setDeleting] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentList, setCommentList] = useState<Comment[]>([])
  const [commentLoading, setCommentLoading] = useState(false)
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [sendingComment, setSendingComment] = useState(false)
  const [likesOpen, setLikesOpen] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
  const [saved, setSaved] = useState(post.user_has_saved ?? false)
  const [viewCount, setViewCount] = useState(post.view_count ?? 0)

  const author = post.author
  const liked = post.liked_by_me ?? false
  const commentCount = post.comment_count ?? 0
  const isOwn = canDelete

  // Register view on mount
  useEffect(() => {
    const sessionId = localStorage.getItem('codebuds_session_id')
    if (!sessionId) {
      const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2)
      localStorage.setItem('codebuds_session_id', id)
    }
    postsApi.view(post.id, localStorage.getItem('codebuds_session_id') || undefined)
      .then((data) => {
        if (data?.view_count != null) setViewCount(data.view_count)
      })
      .catch(() => {})
  }, [post.id])

  function showFeedback(msg: string) {
    setActionFeedback(msg)
    setTimeout(() => setActionFeedback(null), 2000)
  }

  async function handleLike() {
    if (!requireAuth()) return
    if (!profile) return
    try {
      await likesApi.toggle(post.id, liked)
      onToggleLike(post.id)
    } catch (err) {
      console.error('[PostCard] Like failed:', err)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await postsApi.delete(post.id)
      onDelete(post.id)
    } catch (err) {
      console.error('[PostCard] Delete failed:', err)
    } finally {
      setDeleting(false)
    }
  }

  async function toggleComments() {
    if (showComments) { setShowComments(false); return }
    setShowComments(true)
    if (!commentsLoaded) {
      setCommentLoading(true)
      try {
        const data = await commentsApi.list(post.id)
        setCommentList(data ?? [])
        setCommentsLoaded(true)
      } catch (err) {
        console.error('[PostCard] Load comments failed:', err)
      } finally {
        setCommentLoading(false)
      }
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!commentText.trim() || sendingComment) return
    setSendingComment(true)
    try {
      const newComment = await commentsApi.create(post.id, commentText.trim())
      setCommentList((prev) => [...prev, newComment])
      setCommentText('')
    } catch (err) {
      console.error('[PostCard] Comment failed:', err)
    } finally {
      setSendingComment(false)
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href + '#post-' + post.id).then(() => {
      showFeedback('Link copied!')
    }).catch(() => {})
  }

  function handleShare() {
    const url = `${window.location.origin}/#${post.id}`
    navigator.clipboard.writeText(url).then(() => showFeedback('Link copied!')).catch(() => {})
  }

  async function handleSave() {
    try {
      await postsApi.save(post.id)
      setSaved(true)
      showFeedback('Post saved!')
    } catch (err) {
      console.error('[PostCard] Save failed:', err)
    }
  }

  async function handleUnsave() {
    try {
      await postsApi.unsave(post.id)
      setSaved(false)
      showFeedback('Post unsaved')
    } catch (err) {
      console.error('[PostCard] Unsave failed:', err)
    }
  }

  function handleEdit() { showFeedback('Edit coming soon!') }
  function handleReport() { showFeedback('Reported. Thank you.') }

  return (
    <>
      <article id={`post-${post.id}`} className="animate-fade-in rounded-2xl bg-bg-card p-4 transition-all duration-200 sm:p-5">
        {/* Author header */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <UserLink
                userId={author?.id}
                username={author?.username}
                name={author?.full_name}
                avatarUrl={author?.avatar_url}
                size="md"
                showUsername
                className="min-w-0"
              />
              <span className="text-xs text-text-muted shrink-0">
                · {timeAgo(post.created_at)}
              </span>
            </div>
            <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${CATEGORY_COLORS[post.category] ?? CATEGORY_COLORS.general}`}>
              {post.category}
            </span>
          </div>

          {/* Three-dot menu */}
          <PostMenu
            isOwn={isOwn}
            isSaved={saved}
            onSave={handleSave}
            onUnsave={handleUnsave}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReport={handleReport}
            onCopyLink={handleCopyLink}
            onShare={handleShare}
            deleting={deleting}
          />
        </div>

        {/* Content — use CodeContent if post has code blocks */}
        <div className="mt-3 min-w-0 text-sm leading-relaxed text-text-secondary">
          {hasCodeBlocks(post.content) ? (
            <CodeContent content={post.content} />
          ) : (
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{post.content}</p>
          )}
        </div>

        {/* Embeds multimedia: YouTube/TikTok/X/Spotify + Link Preview OG */}
        <ContentEmbeds text={post.content} preview={post.link_preview ?? null} max={2} />

        {/* Action feedback */}
        {actionFeedback && (
          <div className="mt-3 animate-fade-in">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent-muted px-3 py-1.5 text-xs font-medium text-accent">
              {actionFeedback}
            </span>
          </div>
        )}

        {/* Action bar: Like | Comment | Share | Views | Save */}
        <div className="mt-4 flex flex-wrap items-center gap-4 gap-y-2 sm:gap-5">
          {/* Like */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleLike}
              type="button"
              aria-label={liked ? 'Unlike post' : 'Like post'}
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                liked ? 'text-danger' : 'text-text-muted hover:text-danger'
              }`}
            >
              <Heart className={`h-4 w-4 transition-all duration-200 ${liked ? 'fill-current scale-110' : ''}`} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLikesOpen(true) }}
              aria-label={`View ${post.like_count ?? 0} likes`}
              className="text-xs font-medium text-text-muted hover:text-danger transition-colors cursor-pointer hover:underline"
            >
              {post.like_count ?? 0}
            </button>
          </div>

          {/* Comments */}
          <button
            type="button"
            onClick={toggleComments}
            aria-label={showComments ? `Hide comments (${commentCount})` : `Show comments (${commentCount})`}
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
              showComments ? 'text-accent' : 'text-text-muted hover:text-accent'
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            {commentCount}
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share post"
            className="flex items-center gap-1.5 text-xs font-medium text-text-muted transition-colors hover:text-accent"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>

          {/* Views */}
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            <Eye className="h-4 w-4" />
            {viewCount}
          </span>

          {/* Save */}
          <button
            type="button"
            onClick={saved ? handleUnsave : handleSave}
            aria-label={saved ? 'Unsave post' : 'Save post'}
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
              saved ? 'text-accent' : 'text-text-muted hover:text-accent'
            }`}
          >
            <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="mt-4 pt-4">
            {commentLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
              </div>
            ) : commentList.length > 0 ? (
              <div className="space-y-3">
                {commentList.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <UserLink
                          userId={c.user?.id}
                          username={c.user?.username}
                          name={c.user?.full_name}
                          avatarUrl={c.user?.avatar_url}
                          size="sm"
                          showName
                          showUsername={false}
                          className="min-w-0"
                        />
                        <span className="text-[10px] text-text-muted shrink-0">
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

            {!profile ? (
              <button
                type="button"
                onClick={() => requireAuth()}
                className="mt-3 flex w-full items-center gap-2 rounded-xl bg-bg-input px-3 py-2 text-xs text-text-muted transition-all hover:bg-bg-card-hover hover:text-text-secondary"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-accent/20 bg-accent/10">
                  <img src={getAvatarUrl(null, 'guest')} alt="" className="h-full w-full object-cover" />
                </div>
                Sign in to comment...
              </button>
            ) : (
              <form onSubmit={handleComment} className="mt-3 flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-accent/20 bg-accent/10">
                  <img src={getAvatarUrl(profile?.avatar_url, profile?.username)} alt="You" className="h-full w-full object-cover" />
                </div>
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 min-w-0 rounded-xl bg-bg-input px-3 py-2 text-xs text-text-primary transition-all placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/20"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || sendingComment}
                  aria-label="Send comment"
                  className="rounded-xl bg-accent p-2 text-white transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </form>
            )}
          </div>
        )}
      </article>

      {/* Likes modal — triggered by clicking like count */}
      {likesOpen && (
        <LikesModal
          postId={post.id}
          open={likesOpen}
          onClose={() => setLikesOpen(false)}
        />
      )}
    </>
  )
}
