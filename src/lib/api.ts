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
  async list(exclude?: string) {
    const params = exclude ? `?exclude=${exclude}` : ''
    return request<any[]>(`/profiles${params}`)
  },

  async count() {
    return request<{ count: number }>('/profiles/count')
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
  async list(orderBy?: string, limit?: number) {
    const params = new URLSearchParams()
    if (orderBy) params.set('orderBy', orderBy)
    if (limit) params.set('limit', String(limit))
    const qs = params.toString()
    return request<any[]>(`/projects${qs ? '?' + qs : ''}`)
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
