import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, X, UserPlus, UserMinus } from 'lucide-react'
import { follows as followsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { getAvatarUrl } from '../lib/utils'
import { displayUsername } from '../lib/username'
import type { Profile } from '../lib/types'

interface FollowListModalProps {
  open: boolean
  onClose: () => void
  type: 'followers' | 'following'
  profileId: string
}

export function FollowListModal({ open, onClose, type, profileId }: FollowListModalProps) {
  const navigate = useNavigate()
  const { profile: myProfile, requireAuth } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set())
  const [followLoading, setFollowLoading] = useState<string | null>(null)

  const loadUsers = useCallback(async (cursor?: string, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20' })
      if (cursor) params.set('cursor', cursor)
      const endpoint = type === 'followers'
        ? `/users/${profileId}/followers?${params}`
        : `/users/${profileId}/following?${params}`
      const data = await followsApi.listRaw(endpoint)
      const items = data.items || data || []
      if (append) {
        setUsers(prev => [...prev, ...items])
      } else {
        setUsers(items)
      }
      setNextCursor(data.nextCursor || null)
      setHasMore(data.hasMore ?? false)
    } catch (err) {
      console.error('[FollowListModal] Load failed:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [type, profileId])

  // Load initial data
  useEffect(() => {
    if (!open) return
    setUsers([])
    setNextCursor(null)
    setHasMore(true)
    loadUsers()
  }, [open, loadUsers])

  // Check which users I'm following
  useEffect(() => {
    if (!open || !myProfile || users.length === 0) return
    followsApi
      .following(myProfile.id)
      .then((following) => {
        const list = Array.isArray(following) ? following : []
        setFollowingSet(new Set(list.map((f) => f?.id).filter(Boolean)))
      })
      .catch((err) => console.error('[FollowListModal] Follow state load failed:', err))
  }, [open, myProfile?.id, users])

  // Load more on scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 100 && hasMore && !loadingMore && nextCursor) {
      loadUsers(nextCursor, true)
    }
  }, [hasMore, loadingMore, nextCursor, loadUsers])

  async function handleFollowToggle(userId: string) {
    if (!requireAuth()) return
    setFollowLoading(userId)
    try {
      if (followingSet.has(userId)) {
        await followsApi.unfollow(userId)
        setFollowingSet(prev => {
          const next = new Set(prev)
          next.delete(userId)
          return next
        })
      } else {
        await followsApi.follow(userId)
        setFollowingSet(prev => new Set(prev).add(userId))
      }
    } catch (err) {
      console.error('[FollowListModal] Follow toggle failed:', err)
    } finally {
      setFollowLoading(null)
    }
  }

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

  if (!open) return null

  const title = type === 'followers' ? 'Followers' : 'Following'
  const emptyTitle = type === 'followers' ? 'No followers yet' : 'Not following anyone yet'
  const emptyDesc = type === 'followers'
    ? "When someone follows this profile, they'll appear here."
    : "This profile isn't following anyone yet."

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl bg-bg-card shadow-2xl animate-scale-in max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light shrink-0">
          <h3 className="text-sm font-bold text-text-primary">{title}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 px-6 text-center">
              <p className="text-sm font-medium text-text-primary">{emptyTitle}</p>
              <p className="mt-1 text-xs text-text-muted">{emptyDesc}</p>
            </div>
          ) : (
            <div className="divide-y divide-border-light">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-3 px-5 py-3 hover:bg-bg-card-hover transition-colors">
                  <img
                    src={getAvatarUrl(user.avatar_url, user.username)}
                    alt={user.full_name}
                    className="w-9 h-9 rounded-full bg-bg-primary object-cover shrink-0 cursor-pointer"
                    onClick={() => { onClose(); navigate(`/profile/${user.username}`) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold text-text-primary truncate cursor-pointer hover:text-accent transition-colors"
                      onClick={() => { onClose(); navigate(`/profile/${user.username}`) }}
                    >
                      {user.full_name}
                    </p>
                    <p className="text-[10px] text-text-muted truncate">@{displayUsername(user.username)}</p>
                    {user.city && (
                      <p className="text-[10px] text-text-muted truncate">{user.city}</p>
                    )}
                  </div>
                  {myProfile && user.id !== myProfile.id && (
                    <button
                      onClick={() => handleFollowToggle(user.id)}
                      disabled={followLoading === user.id}
                      className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        followingSet.has(user.id)
                          ? 'bg-bg-input text-text-secondary border border-border-light hover:text-danger hover:border-danger/50'
                          : 'bg-accent text-white hover:bg-accent-hover'
                      }`}
                    >
                      {followLoading === user.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : followingSet.has(user.id) ? (
                        <><UserMinus className="h-3 w-3" /> Following</>
                      ) : (
                        <><UserPlus className="h-3 w-3" /> Follow</>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Loading more */}
          {loadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
