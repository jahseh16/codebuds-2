import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Loader2 } from 'lucide-react'
import { posts as postsApi } from '../lib/api'
import { UserLink } from './UserLink'

interface LikesModalProps {
  postId: string
  open: boolean
  onClose: () => void
}

export function LikesModal({ postId, open, onClose }: LikesModalProps) {
  const [likes, setLikes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load initial likes
  useEffect(() => {
    if (!open) return
    setLikes([])
    setCursor(null)
    setLoading(true)
    postsApi.getLikes(postId, 20).then((data) => {
      setLikes(data.items)
      setCursor(data.nextCursor)
      setHasMore(data.hasMore)
    }).catch((err) => { console.error('[LikesModal] Load failed:', err) }).finally(() => setLoading(false))
  }, [postId, open])

  // Close on Escape + body overflow
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = prev || ''
    }
  }, [open, onClose])

  // Load more on scroll
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !cursor) return
    setLoadingMore(true)
    try {
      const data = await postsApi.getLikes(postId, 20, cursor)
      setLikes((prev) => [...prev, ...data.items])
      setCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } catch (err) {
      console.error('[LikesModal] Load more failed:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [postId, cursor, hasMore, loadingMore])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      loadMore()
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-bg-card shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
          <h2 className="text-sm font-bold text-text-primary">Liked by</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* List */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-80 overflow-y-auto"
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
          ) : likes.length > 0 ? (
            <div className="p-2">
              {likes.map((like) => (
                <div
                  key={like.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-bg-card-hover"
                  onClick={onClose}
                >
                  <UserLink
                    userId={like.user?.id}
                    username={like.user?.username}
                    name={like.user?.full_name}
                    avatarUrl={like.user?.avatar_url}
                    size="sm"
                    showName
                    className="min-w-0 flex-1"
                  />
                </div>
              ))}
              {loadingMore && (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-text-muted">No likes yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
