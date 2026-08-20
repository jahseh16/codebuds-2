import { useState, useCallback } from 'react'
import { Loader2, Sparkles, MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PostCard } from '../components/PostCard'
import { CreatePostCard } from '../components/CreatePostCard'
import type { Post, PostCategory } from '../lib/types'

const TABS: { value: PostCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'general', label: 'General' },
  { value: 'mentorship', label: 'Mentorship' },
  { value: 'project', label: 'Projects' },
  { value: 'team', label: 'Teams' },
]

export function Feed() {
  const { session } = useAuth()
  const [filter, setFilter] = useState<PostCategory | 'all'>('all')
  const [showComposer, setShowComposer] = useState(false)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    setError('')

    let query = supabase
      .from('posts')
      .select('*, author:profiles(*), likes(*)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (filter !== 'all') {
      query = query.eq('category', filter)
    }

    const { data, error: queryError } = await query

    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      setLoaded(true)
      return
    }

    const formattedPosts: Post[] = (data ?? []).map((p) => {
      const likes = p.likes ?? []
      return {
        ...p,
        author: p.author as Post['author'],
        like_count: likes.length,
        liked_by_me: likes.some((l: { user_id: string }) => l.user_id === session?.user?.id),
      }
    })

    setPosts(formattedPosts)
    setLoading(false)
    setLoaded(true)
  }, [filter, session?.user?.id])

  // Initial load
  if (!loaded && !loading) {
    loadPosts()
  }

  if (loading && !loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">Feed</h1>
        <p className="mt-1 text-sm text-text-secondary">Share updates, find buddies, and discover projects.</p>
      </header>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-border bg-bg-card p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => { setFilter(tab.value); setLoaded(false) }}
            className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
              filter === tab.value
                ? 'bg-accent text-white shadow-[0_0_16px_rgba(20,184,166,0.3)]'
                : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Composer */}
      {!showComposer ? (
        <button
          type="button"
          onClick={() => setShowComposer(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-bg-card p-4 text-sm text-text-muted transition-all duration-200 hover:border-border-light hover:bg-bg-card-hover hover:text-text-secondary"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Sparkles className="h-4 w-4" />
          </div>
          Share something with CodeBuds...
        </button>
      ) : (
        <CreatePostCard onCreated={loadPosts} onClose={() => setShowComposer(false)} />
      )}

      {/* Posts */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-danger/20 bg-danger-muted px-5 py-4 text-sm text-danger">
          {error}
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-5">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              canDelete={post.author_id === session?.user?.id}
              onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
              onToggleLike={(id) => {
                setPosts((prev) =>
                  prev.map((p) => {
                    if (p.id !== id) return p
                    const wasLiked = p.liked_by_me ?? false
                    return {
                      ...p,
                      liked_by_me: !wasLiked,
                      like_count: (p.like_count ?? 0) + (wasLiked ? -1 : 1),
                    }
                  })
                )
              }}
            />
          ))}
        </div>
      ) : (
        <div className="animate-fade-in rounded-2xl border border-border bg-bg-card p-20 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-muted">
            <MessageSquare className="h-8 w-8 text-accent" />
          </div>
          <p className="text-lg font-medium text-text-primary">No posts yet</p>
          <p className="mt-1 text-sm text-text-muted">Be the first to share something with the community.</p>
        </div>
      )}
    </div>
  )
}
