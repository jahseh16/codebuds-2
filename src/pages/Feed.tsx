import { useState, useCallback } from 'react'
import { Loader2, Sparkles, MessageSquare } from 'lucide-react'
import { posts as postsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { PostCard } from '../components/PostCard'
import { CreatePostCard } from '../components/CreatePostCard'
import type { Post, PostCategory } from '../lib/types'

const TABS: { value: PostCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'general', label: 'General' },
  { value: 'project_update', label: 'Project Update' },
  { value: 'looking_for_collaborator', label: 'Looking for Collaborator' },
  { value: 'code_snippet', label: 'Code Snippet' },
  { value: 'need_help', label: 'Need Help' },
  { value: 'team', label: 'Teams' },
]

export function Feed() {
  const { profile, token, requireAuth } = useAuth()
  const [filter, setFilter] = useState<PostCategory | 'all'>('all')
  const [showComposer, setShowComposer] = useState(false)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await postsApi.list(filter !== 'all' ? filter : undefined)
      const formattedPosts: Post[] = (data ?? []).map((p: any) => ({
        ...p,
        author: p.author as Post['author'],
        like_count: p.like_count ?? 0,
        liked_by_me: p.liked_by_me ?? false,
        comment_count: p.comment_count ?? 0,
      }))
      setPosts(formattedPosts)
    } catch (err: any) {
      setError(err.message)
    }

    setLoading(false)
    setLoaded(true)
  }, [filter])

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
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-text-primary sm:text-2xl">Feed</h1>
        <p className="mt-1 text-sm text-text-secondary">Share an update, ask for help, or publish a project...</p>
      </header>

      {/* Category Tabs — scrollable on mobile, no outer border */}
      <div className="scrollbar-hidden flex items-center gap-1 overflow-x-auto rounded-2xl bg-bg-card p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => { setFilter(tab.value); setLoaded(false) }}
            className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 sm:px-3 sm:py-2.5 sm:text-sm ${
              filter === tab.value
                ? 'bg-accent-muted text-accent shadow-[0_0_12px_rgba(124,58,237,0.15)]'
                : 'text-text-muted hover:bg-bg-card-hover hover:text-text-primary'
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
          onClick={() => {
            if (!requireAuth()) return
            setShowComposer(true)
          }}
          className="flex w-full items-center gap-3 rounded-2xl bg-bg-card p-3.5 text-sm text-text-muted transition-all duration-200 hover:bg-bg-card-hover hover:text-text-secondary sm:p-4"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Sparkles className="h-4 w-4" />
          </div>
          {token ? 'Share an update, ask for help, or publish a project...' : 'Sign in to share with CodeBuds...'}
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
        <div className="rounded-2xl bg-danger/10 px-5 py-4 text-sm text-danger">
          {error}
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              canDelete={post.author_id === profile?.id}
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
        <div className="animate-fade-in rounded-2xl bg-bg-card p-10 text-center sm:p-12 md:p-20">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted md:h-16 md:w-16">
            <MessageSquare className="h-7 w-7 text-accent md:h-8 md:w-8" />
          </div>
          <p className="text-base font-medium text-text-primary md:text-lg">No posts yet</p>
          <p className="mt-1 text-sm text-text-muted">Be the first to share something with the community.</p>
        </div>
      )}
    </div>
  )
}
