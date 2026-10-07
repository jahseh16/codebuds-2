import type { ChatMessage } from './chatMessages'

const API_BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('codebuds_token')
}

function setToken(token: string) {
  localStorage.setItem('codebuds_token', token)
}

function clearToken() {
  localStorage.removeItem('codebuds_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  // Handle non-JSON responses (e.g. HTML from catch-all route)
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    if (!res.ok) {
      throw new Error(`Server returned ${res.status} (${contentType.split(';')[0] || 'unknown'})`)
    }
    throw new Error(`Server returned non-JSON response (${res.status})`)
  }

  let data: any = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`Server returned invalid JSON (${res.status})`)
    }
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || (typeof data === 'string' ? data : '')
    throw new Error(msg || `Server error ${res.status}`)
  }

  return data as T
}

// ─── Auth ────────────────────────────────────────────────
export const auth = {
  async register(email: string, password: string, username: string, fullName: string) {
    const data = await request<{ token: string; profile: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username, fullName }),
    })
    setToken(data.token)
    return data
  },

  async login(email: string, password: string) {
    const data = await request<{ token: string; profile: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setToken(data.token)
    return data
  },

  async me() {
    return request<any>('/auth/me')
  },

  signOut() {
    clearToken()
  },

  getToken,
}

// ─── Profiles ────────────────────────────────────────────
export const profiles = {
  async list(exclude?: string, limit?: number) {
    const params = new URLSearchParams()
    if (exclude) params.set('exclude', exclude)
    if (limit) params.set('limit', String(limit))
    const qs = params.toString()
    return request<any[]>(`/profiles${qs ? '?' + qs : ''}`)
  },

  async count() {
    return request<{ count: number }>('/profiles/count')
  },

  /** Public profile of one user (chat info panel). Omits exact location. */
  async get(id: string) {
    return request<Record<string, unknown>>(`/profiles/${id}`)
  },

  async update(id: string, data: any) {
    return request<any>(`/profiles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
}

// ─── Posts ────────────────────────────────────────────────
export const posts = {
  async list(category?: string) {
    const params = category && category !== 'all' ? `?category=${category}` : ''
    return request<any[]>(`/posts${params}`)
  },

  async byAuthor(authorId: string) {
    return request<any[]>(`/posts?author_id=${authorId}`)
  },

  async count() {
    return request<{ count: number }>('/posts/count')
  },

  async create(content: string, category: string) {
    return request<any>('/posts', {
      method: 'POST',
      body: JSON.stringify({ content, category }),
    })
  },

  async delete(id: string) {
    return request<any>(`/posts/${id}`, { method: 'DELETE' })
  },

  async view(postId: string, sessionId?: string) {
    const headers: Record<string, string> = {}
    if (sessionId) headers['x-session-id'] = sessionId
    return request<any>(`/posts/${postId}/view`, {
      method: 'POST',
      headers,
    })
  },

  async getLikes(postId: string, limit = 20, cursor?: string) {
    const params = new URLSearchParams({ limit: String(limit) })
    if (cursor) params.set('cursor', cursor)
    return request<{ items: any[]; nextCursor: string | null; hasMore: boolean }>(
      `/posts/${postId}/likes?${params}`
    )
  },

  async save(postId: string) {
    return request<any>(`/posts/${postId}/save`, { method: 'POST' })
  },

  async unsave(postId: string) {
    return request<any>(`/posts/${postId}/save`, { method: 'DELETE' })
  },
}

// ─── Comments ──────────────────────────────────────────
export const comments = {
  async list(postId: string) {
    return request<any[]>(`/posts/${postId}/comments`)
  },

  async create(postId: string, content: string) {
    return request<any>(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
  },
}

// ─── Likes ───────────────────────────────────────────────
export const likes = {
  async toggle(postId: string, liked: boolean) {
    if (liked) {
      return request<any>(`/likes?post_id=${postId}`, { method: 'DELETE' })
    } else {
      return request<any>('/likes', {
        method: 'POST',
        body: JSON.stringify({ post_id: postId }),
      })
    }
  },
}

// ─── Projects ────────────────────────────────────────────
export const projects = {
  async list(orderBy?: string, limit?: number, status?: string, search?: string) {
    const params = new URLSearchParams()
    if (orderBy) params.set('orderBy', orderBy)
    if (limit) params.set('limit', String(limit))
    if (status && status !== 'all') params.set('status', status)
    if (search) params.set('search', search)
    const qs = params.toString()
    return request<any[]>(`/projects${qs ? '?' + qs : ''}`)
  },

  async get(id: string) {
    return request<any>(`/projects/${id}`)
  },

  async count() {
    return request<{ count: number }>('/projects/count')
  },

  async create(data: any) {
    return request<any>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: any) {
    return request<any>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string) {
    return request<any>(`/projects/${id}`, { method: 'DELETE' })
  },

  async save(id: string) {
    return request<any>(`/projects/${id}/save`, { method: 'POST' })
  },

  async unsave(id: string) {
    return request<any>(`/projects/${id}/save`, { method: 'DELETE' })
  },

  async saved() {
    return request<any[]>('/projects/saved')
  },

  async match(id: string) {
    return request<any[]>(`/projects/${id}/match`)
  },
}

// ─── Buddies ─────────────────────────────────────────────
export const buddies = {
  async list(requesterId?: string) {
    const params = requesterId ? `?requester_id=${requesterId}` : ''
    return request<any[]>(`/buddies${params}`)
  },

  async create(addresseeId: string) {
    return request<any>('/buddies', {
      method: 'POST',
      body: JSON.stringify({ addressee_id: addresseeId }),
    })
  },
}

// ─── Mentorships ─────────────────────────────────────────
export const mentorships = {
  async list() {
    return request<any[]>('/mentorships')
  },

  async create(mentorId: string, topic: string, message: string) {
    return request<any>('/mentorships', {
      method: 'POST',
      body: JSON.stringify({ mentor_id: mentorId, topic, message }),
    })
  },

  async update(id: string, status: string) {
    return request<any>(`/mentorships/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  },
}

// ─── Notifications ───────────────────────────────────────
export const notifications = {
  async list() {
    return request<any[]>('/notifications')
  },

  async markAllRead() {
    return request<any>('/notifications/read', { method: 'PUT' })
  },
}

// ─── Messages ───────────────────────────────────────────
export const messages = {
  async getConversations() {
    // The chat list must always be an array (see ChatContext/Messages):
    // a malformed payload would otherwise crash the conversation list.
    const data = await request<unknown>('/messages/conversations')
    return (Array.isArray(data) ? data : []) as any[]
  },

  async getUnreadCount() {
    return request<{ count: number }>('/messages/unread-count')
  },

  async getMessages(userId: string) {
    return request<{ conversation_id: string; messages: any[]; muted?: boolean; blocked?: boolean }>(`/messages/${userId}`)
  },

  /**
   * Send a message over REST (fallback when realtime is down).
   * Returns the created message with its definitive id.
   */
  async send(payload: {
    receiver_id?: string
    text: string
    conversation_id?: string
    reply_to_id?: string
    client_id?: string
  }) {
    return request<{ message: unknown }>('/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  /** Backend search inside one conversation (debounced by the caller). */
  async search(conversationId: string, q: string) {
    const params = new URLSearchParams({ conversation_id: conversationId, q })
    return request<{ messages: ChatMessage[] }>(`/messages/search?${params.toString()}`)
  },

  /** Toggle a reaction (❤️ 👍 😂 …) on a message. */
  async react(messageId: string, emoji: string) {
    return request<{ message: ChatMessage }>(`/messages/${messageId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    })
  },

  /** Delete for me, or for everyone when the caller is the author. */
  async remove(messageId: string, scope: 'me' | 'everyone' = 'me') {
    return request<{ ok: boolean; scope: string }>(`/messages/${messageId}`, {
      method: 'DELETE',
      body: JSON.stringify({ scope }),
    })
  },
}

// ─── Conversation settings ───────────────────────────
export const conversations = {
  /** Mute / unmute notifications for one conversation (persisted). */
  async mute(conversationId: string, muted: boolean) {
    return request<{ ok: boolean; muted: boolean }>(`/conversations/${conversationId}/mute`, {
      method: 'POST',
      body: JSON.stringify({ muted }),
    })
  },

  /** Clear chat: hides every message of the thread for the caller only. */
  async clear(conversationId: string) {
    return request<{ ok: boolean }>(`/conversations/${conversationId}/clear`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  },
}

// ─── Presence ────────────────────────────────────────
export const users = {
  /** Online flag + last_active for one user. */
  async status(id: string) {
    return request<{ online: boolean; last_active: string }>(`/users/${id}/status`)
  },
}

// ─── Matching System ────────────────────────────────────
export const discover = {
  async list(filters?: {
    looking_for?: string
    interests?: string
    city?: string
    age_range?: string
    country?: string
    region?: string
    limit?: number
    cursor?: string
  }) {
    const params = new URLSearchParams()
    if (filters?.looking_for) params.set('looking_for', filters.looking_for)
    if (filters?.interests) params.set('interests', filters.interests)
    if (filters?.city) params.set('city', filters.city)
    if (filters?.age_range) params.set('age_range', filters.age_range)
    if (filters?.country) params.set('country', filters.country)
    if (filters?.region) params.set('region', filters.region)
    if (filters?.limit) params.set('limit', String(filters.limit))
    if (filters?.cursor) params.set('cursor', filters.cursor)
    const qs = params.toString()
    return request<{ items: any[]; nextCursor: string | null; hasMore: boolean }>(
      `/discover${qs ? '?' + qs : ''}`
    )
  },
}

export const vibes = {
  async send(receiverId: string) {
    return request<any>('/vibes', {
      method: 'POST',
      body: JSON.stringify({ receiver_id: receiverId }),
    })
  },

  async respond(vibeId: string, status: 'accepted' | 'declined') {
    return request<any>(`/vibes/${vibeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },

  async list() {
    return request<{ sent: any[]; received: any[] }>('/vibes')
  },
}

export const matches = {
  async list() {
    return request<any[]>('/matches')
  },
}

export const blocks = {
  async create(blockedId: string) {
    return request<any>('/block', {
      method: 'POST',
      body: JSON.stringify({ blocked_id: blockedId }),
    })
  },

  async remove(blockedId: string) {
    return request<any>(`/block/${blockedId}`, { method: 'DELETE' })
  },

  async list() {
    return request<any[]>('/block')
  },
}

export const reports = {
  async create(reportedId: string, reason: string, description?: string) {
    return request<any>('/report', {
      method: 'POST',
      body: JSON.stringify({ reported_id: reportedId, reason, description }),
    })
  },
}

// ─── Link preview (Open Graph) ─────────────────────────
export const links = {
  /** Metadatos (título/imagen/descripción) de un enlace público. */
  async preview(url: string) {
    return request<{ url: string; title: string | null; description: string | null; image: string | null; siteName: string | null }>(
      `/link-preview?url=${encodeURIComponent(url)}`
    )
  },
}

// ─── Follow ───────────────────────────────────────────
/**
 * The paginated list endpoints answer `{ items, nextCursor, hasMore }`, while
 * callers such as Profile/FollowListModal only want the array. Normalizing
 * here keeps `.some()`/`.map()` in the UI from throwing (and silently leaving
 * the follow button stuck) whenever the payload is an object or malformed.
 */
function toItems(data: unknown): any[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const items = (data as { items?: unknown }).items
    if (Array.isArray(items)) return items
  }
  return []
}

export const follows = {
  async follow(userId: string) {
    return request<{ ok: boolean; isFollowing: boolean; followersCount: number }>(`/users/${userId}/follow`, {
      method: 'POST',
    })
  },
  async unfollow(userId: string) {
    return request<{ ok: boolean; isFollowing: boolean; followersCount: number }>(`/users/${userId}/follow`, {
      method: 'DELETE',
    })
  },
  async followers(userId: string) {
    return toItems(await request<unknown>(`/users/${userId}/followers`))
  },
  async following(userId: string) {
    return toItems(await request<unknown>(`/users/${userId}/following`))
  },
  async listRaw(endpoint: string) {
    return request<any>(endpoint)
  },
}

// ─── Saved (unified) ──────────────────────────────────
export const saved = {
  async getAll(limit = 20, cursor?: string) {
    const params = new URLSearchParams({ limit: String(limit) })
    if (cursor) params.set('cursor', cursor)
    return request<{ items: any[]; nextCursor: string | null; hasMore: boolean }>(
      `/me/saved?${params}`
    )
  },
}

// ─── Notes (voz / música) ──────────────────────────
export interface NoteApiResponse {
  user_id: string
  text: string
  track: unknown
  updated_at: string
}

export const notes = {
  /** Notas activas de todos los usuarios (carrusel de Messages). */
  async list() {
    // Never hand an undefined/non-array payload to the carousel: an error body
    // or empty response must degrade to an empty list, not to a render crash.
    const data = await request<unknown>('/notes')
    return (Array.isArray(data) ? data : []) as NoteApiResponse[]
  },

  /** Crea/actualiza la nota del usuario autenticado. */
  async save(payload: { text: string; track: unknown }) {
    return request<NoteApiResponse>('/notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  /** Elimina la nota del usuario autenticado. */
  async remove() {
    return request<{ ok: boolean }>('/notes', { method: 'DELETE' })
  },
}
