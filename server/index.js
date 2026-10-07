import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import ogs from 'open-graph-scraper'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { validateUsername, normalizeUsername } from './utils/username.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const httpServer = createServer(app)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, schema: 'codebuds' })
const prisma = new PrismaClient({ adapter })
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'codebuds-jwt-secret'
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://codebuds.site'

// ─── URL / Link Preview helpers ───────────────────────
const URL_REGEX = /https?:\/\/\S+/g

function extractFirstUrl(text) {
  const match = text.match(URL_REGEX)
  return match ? match[0].replace(/[.,;:!?)]+$/, '') : null
}

function extractYouTubeId(url) {
  // youtube.com/watch?v=VIDEO_ID
  // youtu.be/VIDEO_ID
  // youtube.com/embed/VIDEO_ID
  // youtube.com/shorts/VIDEO_ID
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

/** open-graph-scraper v6 devuelve ogImage/twitterImage como ARRAY de objetos. */
function firstOgImage(value) {
  if (Array.isArray(value)) return value[0]?.url || null
  if (value && typeof value === 'object') return value.url || null
  return null
}

async function scrapeUrlPreview(url) {
  try {
    const { result } = await ogs({ url, timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CodeBuds/1.0)' } })
    return {
      type: 'link',
      url,
      title: result.ogTitle || result.title || null,
      description: result.ogDescription || result.description || null,
      image: firstOgImage(result.ogImage) || firstOgImage(result.twitterImage) || null,
      siteName: result.ogSiteName || null,
    }
  } catch (err) {
    console.error('[OG-SCRAPE] Failed:', url, err.message)
    return { type: 'link', url, title: null, description: null, image: null, siteName: null }
  }
}

/**
 * Enlace de plataforma con reproductor propio (YouTube/TikTok/X/Spotify).
 * Devuelve el preview que el frontend sabe embeber, o null si es un enlace
 * genérico (entonces se recurre a los metadatos Open Graph).
 */
function classifyMediaUrl(url) {
  const yt = extractYouTubeId(url)
  if (yt) {
    return {
      type: 'youtube',
      videoId: yt,
      embedUrl: `https://www.youtube.com/embed/${yt}?rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${yt}/hqdefault.jpg`,
      url,
    }
  }

  const tt =
    url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/) ||
    url.match(/tiktok\.com\/v\/(\d+)/) ||
    url.match(/tiktok\.com\/embed\/(?:v2\/)?(\d+)/)
  if (tt) {
    return { type: 'tiktok', videoId: tt[1], embedUrl: `https://www.tiktok.com/player/v1/${tt[1]}`, url }
  }

  const tw = url.match(/(?:twitter\.com|x\.com|mobile\.twitter\.com|mobile\.x\.com)\/[\w.-]+\/status\/(\d+)/)
  if (tw) {
    return {
      type: 'twitter',
      videoId: tw[1],
      embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${tw[1]}&theme=dark&dnt=true`,
      url,
    }
  }

  const sp = url.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([\w]+)/)
  if (sp) {
    return { type: 'spotify', videoId: sp[2], embedUrl: `https://open.spotify.com/embed/${sp[1]}/${sp[2]}?theme=0`, url }
  }

  return null
}

/**
 * Guard SSRF para /api/link-preview: sólo se hacen peticiones salientes a
 * URLs http(s) con host público. Bloquea localhost, hosts de un solo label,
 * IPs literales (v4 privadas/reservadas, v4 en decimal, v6 privadas) y
 * dominios .local/.internal/.localhost.
 * (Limitación conocida: no resuelve DNS, por lo que no cubre rebinding.)
 */
function safePreviewTarget(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return null
  let u
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (u.username || u.password) return null

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host.includes('.')) return null // localhost, 'intranet', IPv6 sin puntos…
  if (/^\d+$/.test(host)) return null // IP en decimal (2130706433 → 127.0.0.1)
  if (!/^[a-z0-9.-]+$/.test(host)) return null
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost') || host.endsWith('.home')) return null

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    const privada =
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) ||           // link-local / metadata cloud
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    if (privada) return null
  }

  return u.toString()
}

// Caché en memoria: el preview de un enlace no cambia y la consulta es cara.
const previewCache = new Map() // url -> { data, expires }
const PREVIEW_TTL_MS = 10 * 60 * 1000
const PREVIEW_CACHE_MAX = 500
// Rate limit simple por IP para que nadie use el scraper como proxy
const previewHits = new Map() // ip -> { count, reset }
const PREVIEW_LIMIT = 60 // peticiones / minuto

function previewRateOk(ip) {
  const now = Date.now()
  const hit = previewHits.get(ip)
  if (!hit || now > hit.reset) {
    previewHits.set(ip, { count: 1, reset: now + 60_000 })
    return true
  }
  hit.count += 1
  return hit.count <= PREVIEW_LIMIT
}

// ─── CORS ────────────────────────────────────────────
app.use(cors({
  origin: [FRONTEND_URL, 'https://www.codebuds.site', 'http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
}))
// 12mb: profile updates can carry an uploaded banner/avatar as a data URL
// (the default 100kb would reject them)
app.use(express.json({ limit: '12mb' }))

// ─── Auth middleware ─────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET)
    req.userId = payload.userId
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    req.userId = null
    return next()
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET)
    req.userId = payload.userId
    return next()
  } catch {
    req.userId = null
    return next()
  }
}

// ─── AUTH ────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, username, fullName } = req.body
    console.log('[REGISTER] Attempt:', { email, username })

    if (!email || !password || !username || !fullName) {
      return res.status(400).json({ error: 'All fields are required' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    // Validate and normalize username
    const usernameValidation = validateUsername(username)
    if (!usernameValidation.valid) {
      return res.status(400).json({ error: usernameValidation.error })
    }
    const normalizedUsername = usernameValidation.username

    const exists = await prisma.profile.findFirst({
      where: { OR: [{ email }, { username: normalizedUsername }] },
    })
    if (exists) {
      return res.status(400).json({ error: 'Email or username already taken' })
    }

    const hashed = await bcrypt.hash(password, 10)
    const profile = await prisma.profile.create({
      data: { email, password: hashed, username: normalizedUsername, full_name: fullName },
    })

    const token = jwt.sign({ userId: profile.id }, JWT_SECRET, { expiresIn: '7d' })
    const { password: _, ...safe } = profile
    console.log('[REGISTER] Success:', profile.id)
    res.json({ token, profile: safe })
  } catch (err) {
    console.error('[REGISTER] Error:', err)
    res.status(500).json({ error: err.message || 'Internal server error during registration' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const profile = await prisma.profile.findUnique({ where: { email } })
    if (!profile) return res.status(400).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, profile.password)
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' })

    const token = jwt.sign({ userId: profile.id }, JWT_SECRET, { expiresIn: '7d' })
    const { password: _, ...safe } = profile
    res.json({ token, profile: safe })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── GitHub OAuth ───────────────────────────────────
app.get('/api/auth/github', (req, res) => {
  const redirectUri = GITHUB_CALLBACK_URL
  res.redirect(`https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`)
})

app.get('/api/auth/github/callback', async (req, res) => {
  const { code } = req.query
  if (!code) return res.redirect(`${FRONTEND_URL}/login?error=no_code`)

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code }),
    })
    const tokenData = await tokenRes.json()
    if (tokenData.error) return res.redirect(`${FRONTEND_URL}/login?error=github_token`)

    // Fetch GitHub user
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const ghUser = await userRes.json()

    // Fetch primary email
    const emailRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const emails = await emailRes.json()
    const primaryEmail = emails.find(e => e.primary)?.email || emails[0]?.email || null

    // Find or create user
    let profile = await prisma.profile.findFirst({
      where: { OR: [{ email: primaryEmail }, { username: ghUser.login }] },
    })

    if (!profile) {
      // Normalize GitHub username
      const ghUsername = normalizeUsername(ghUser.login)
      profile = await prisma.profile.create({
        data: {
          email: primaryEmail || `${ghUsername}@github.local`,
          username: ghUsername,
          full_name: ghUser.name || ghUser.login,
          avatar_url: ghUser.avatar_url,
          bio: ghUser.bio || null,
          github_url: ghUser.html_url,
          password: await bcrypt.hash(Math.random().toString(36), 10),
        },
      })
    } else {
      // Update existing profile with GitHub data
      profile = await prisma.profile.update({
        where: { id: profile.id },
        data: {
          avatar_url: ghUser.avatar_url || profile.avatar_url,
          bio: ghUser.bio || profile.bio,
          github_url: ghUser.html_url,
        },
      })
    }

    const jwtToken = jwt.sign({ userId: profile.id }, JWT_SECRET, { expiresIn: '7d' })
    const { password: _, ...safe } = profile
    console.log('[GITHUB-AUTH] Success:', profile.username)
    res.redirect(`${FRONTEND_URL}/login?token=${jwtToken}&user=${encodeURIComponent(JSON.stringify(safe))}`)
  } catch (err) {
    console.error('[GITHUB-AUTH] Error:', err)
    res.redirect(`${FRONTEND_URL}/login?error=github_failed`)
  }
})

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: req.userId },
      select: {
        id: true, email: true, username: true, full_name: true, bio: true, avatar_url: true,
        banner_url: true,
        github_url: true, linkedin_url: true, location: true, skills: true, open_to: true,
        age_range: true, city: true, interests: true, looking_for: true,
        availability: true, visibility: true, age_verified: true, last_active: true,
        country: true, country_code: true, region: true, timezone: true,
        created_at: true, updated_at: true,
      },
    })
    if (!profile) return res.status(404).json({ error: 'User not found' })
    // Get real stats
    const [followers_count, following_count, posts_count, projects_count] = await Promise.all([
      prisma.follow.count({ where: { following_id: req.userId } }),
      prisma.follow.count({ where: { follower_id: req.userId } }),
      prisma.post.count({ where: { author_id: req.userId } }),
      prisma.project.count({ where: { author_id: req.userId } }),
    ])
    res.json({ ...profile, followers_count, following_count, posts_count, projects_count })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── PROFILES ────────────────────────────────────────────
// Hard ceiling for ?limit= so no caller can accidentally dump the whole table
const MAX_PROFILES_LIMIT = 100

app.get('/api/profiles', async (req, res) => {
  try {
    const { search, exclude, limit } = req.query
    const where = {}
    if (exclude) where.id = { not: exclude }
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Optional cap: ?limit=5 returns at most 5 profiles (keeps payloads small
    // on mobile). Omitting it preserves the old full-list behavior for pages
    // that genuinely browse/search everyone (Developers, Mentorship, Messages).
    let take
    if (limit !== undefined) {
      const parsed = parseInt(limit, 10)
      if (!Number.isFinite(parsed) || parsed < 1) {
        return res.status(400).json({ error: 'limit must be a positive integer' })
      }
      take = Math.min(parsed, MAX_PROFILES_LIMIT)
    }

    const profiles = await prisma.profile.findMany({
      where,
      select: {
        id: true, username: true, full_name: true, bio: true, avatar_url: true, banner_url: true,
        github_url: true,
        linkedin_url: true, location: true, skills: true, open_to: true,
        age_range: true, city: true, interests: true, looking_for: true,
        availability: true, visibility: true, last_active: true,
        country: true, country_code: true, region: true, timezone: true,
        created_at: true, updated_at: true,
      },
      orderBy: { created_at: 'desc' },
      take,
    })
    res.json(profiles)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/profiles/count', async (_req, res) => {
  try {
    const count = await prisma.profile.count()
    res.json({ count })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * Public profile of a single user (chat info panel / view profile).
 * Deliberately omits `location` (free text, can be exact) and `timezone`:
 * only the approximate fields are exposed.
 */
app.get('/api/profiles/:id', optionalAuth, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, username: true, full_name: true, bio: true, avatar_url: true,
        github_url: true, linkedin_url: true, skills: true, open_to: true,
        age_range: true, city: true, interests: true, looking_for: true,
        availability: true, age_verified: true, last_active: true,
        country: true, country_code: true, region: true,
        created_at: true,
      },
    })
    if (!profile) return res.status(404).json({ error: 'User not found' })

    const [followers_count, following_count, blocked] = await Promise.all([
      prisma.follow.count({ where: { following_id: profile.id } }),
      prisma.follow.count({ where: { follower_id: profile.id } }),
      req.userId ? isBlockedBetween(req.userId, profile.id) : false,
    ])

    res.json({
      ...profile,
      followers_count,
      following_count,
      blocked,
      online: isOnline(profile.id),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/** Presence of a single user: online flag + last_active (approximate). */
app.get('/api/users/:id/status', auth, async (req, res) => {
  try {
    const user = await prisma.profile.findUnique({
      where: { id: req.params.id },
      select: { last_active: true },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ online: isOnline(req.params.id), last_active: user.last_active })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/profiles/:id', auth, async (req, res) => {
  try {
    if (req.userId !== req.params.id) return res.status(403).json({ error: 'Forbidden' })
    const {
      full_name, username, bio, avatar_url, banner_url, github_url, linkedin_url, location, skills, open_to,
      // Matching fields
      age_range, city, interests, looking_for, availability, visibility, age_verified,
      // Location fields
      country, country_code, region, timezone,
    } = req.body

    // Validate and normalize username if provided
    let normalizedUsername = username
    if (username !== undefined) {
      const usernameValidation = validateUsername(username)
      if (!usernameValidation.valid) {
        return res.status(400).json({ error: usernameValidation.error })
      }
      normalizedUsername = usernameValidation.username
    }

    // Age verification: only allow dating if age_verified is true
    let finalLookingFor = looking_for
    if (looking_for && looking_for.includes('dating') && !age_verified) {
      finalLookingFor = looking_for.filter(l => l !== 'dating')
    }

    const data = {
      full_name, username: normalizedUsername, bio, avatar_url, github_url, linkedin_url, location, skills, open_to,
      updated_at: new Date(),
      last_active: new Date(),
    }
    // Only set matching fields if they are provided
    if (age_range !== undefined) data.age_range = age_range
    if (city !== undefined) data.city = city
    if (interests !== undefined) data.interests = interests
    if (looking_for !== undefined) data.looking_for = finalLookingFor
    if (availability !== undefined) data.availability = availability
    if (visibility !== undefined) data.visibility = visibility
    if (age_verified !== undefined) data.age_verified = age_verified
    // Location fields
    if (country !== undefined) data.country = country || null
    if (country_code !== undefined) {
      // Validate: exactly 2 uppercase letters or null
      if (country_code && !/^[A-Z]{2}$/.test(country_code.toUpperCase())) {
        return res.status(400).json({ error: 'Invalid country code. Must be ISO-3166 alpha-2 (e.g. US, PE)' })
      }
      data.country_code = country_code ? country_code.toUpperCase() : null
    }
    if (region !== undefined) data.region = region || null
    if (timezone !== undefined) data.timezone = timezone || null
    // Profile banner: image (.jpg/.png/.webp/.gif) or video (.mp4/.webm) URL
    if (banner_url !== undefined) data.banner_url = banner_url || null

    const profile = await prisma.profile.update({
      where: { id: req.params.id },
      data,
      select: {
        id: true, email: true, username: true, full_name: true, bio: true, avatar_url: true,
        banner_url: true,
        github_url: true, linkedin_url: true, location: true, skills: true, open_to: true,
        age_range: true, city: true, interests: true, looking_for: true,
        availability: true, visibility: true, age_verified: true, last_active: true,
        country: true, country_code: true, region: true, timezone: true,
        created_at: true, updated_at: true,
      },
    })
    res.json(profile)
  } catch (err) {
    // Handle unique constraint violation on username
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Username already taken' })
    }
    res.status(500).json({ error: err.message })
  }
})

// ─── POSTS ───────────────────────────────────────────────
app.get('/api/posts', async (req, res) => {
  try {
    const { category, author_id, limit = 50 } = req.query
    const where = {}
    if (category && category !== 'all') where.category = category
    if (author_id) where.author_id = author_id
    const posts = await prisma.post.findMany({
      where,
      include: {
        author: { select: { id: true, username: true, full_name: true, avatar_url: true } },
        likes: { select: { id: true, user_id: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { created_at: 'desc' },
      take: parseInt(limit),
    })
    // Resolve userId from token if present (optional auth)
    let userId = null
    const header = req.headers.authorization
    if (header?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(header.slice(7), JWT_SECRET)
        userId = payload.userId
      } catch { /* invalid token — treat as guest */ }
    }
    // Get view counts for all posts
    const postIds = posts.map(p => p.id)
    const viewCounts = await prisma.postView.groupBy({ by: ['post_id'], where: { post_id: { in: postIds } }, _count: true })
    const viewMap = new Map(viewCounts.map(v => [v.post_id, v._count]))
    // Get saved status for user
    let savedSet = new Set()
    if (userId) {
      const saved = await prisma.savedPost.findMany({ where: { user_id: userId, post_id: { in: postIds } }, select: { post_id: true } })
      savedSet = new Set(saved.map(s => s.post_id))
    }
    const formatted = posts.map(p => ({
      ...p,
      like_count: p.likes.length,
      liked_by_me: userId ? p.likes.some(l => l.user_id === userId) : false,
      comment_count: p._count.comments,
      view_count: viewMap.get(p.id) || 0,
      user_has_saved: savedSet.has(p.id),
    }))
    res.json(formatted)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/posts/count', async (_req, res) => {
  try {
    const count = await prisma.post.count()
    res.json({ count })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/posts', auth, async (req, res) => {
  try {
    const { content, category } = req.body
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required' })

    // Detect URL and generate link preview (plataformas con player propio;
    // el resto se resuelve con Open Graph justo después, de forma asíncrona)
    const url = extractFirstUrl(content)
    let linkPreview = url ? classifyMediaUrl(url) : null

    const post = await prisma.post.create({
      data: {
        author_id: req.userId,
        content: content.trim(),
        category: category || 'general',
        link_preview: linkPreview,
      },
      include: {
        author: { select: { id: true, username: true, full_name: true, avatar_url: true } },
        likes: { select: { id: true, user_id: true } },
      },
    })

    // For non-YouTube URLs, scrape OG tags asynchronously after post creation
    if (url && !linkPreview) {
      scrapeUrlPreview(url).then(preview => {
        prisma.post.update({ where: { id: post.id }, data: { link_preview: preview } }).catch(() => {})
      }).catch(() => {})
    }

    res.json({ ...post, like_count: 0, liked_by_me: false })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * Metadata Open Graph de cualquier enlace público.
 * La usan los chats (y los posts antiguos) para pintar el Link Preview:
 * título, descripción e imagen del destino, con caché y rate limit.
 */
app.get('/api/link-preview', optionalAuth, async (req, res) => {
  try {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : ''
    const target = safePreviewTarget(rawUrl)
    if (!target) return res.status(400).json({ error: 'url must be a public http(s) URL' })

    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    if (!previewRateOk(ip)) return res.status(429).json({ error: 'Too many preview requests, retry later' })

    const cached = previewCache.get(target)
    if (cached && cached.expires > Date.now()) return res.json(cached.data)

    const data = { type: 'link', ...(await scrapeUrlPreview(target)) }
    if (previewCache.size >= PREVIEW_CACHE_MAX) previewCache.delete(previewCache.keys().next().value)
    previewCache.set(target, { data, expires: Date.now() + PREVIEW_TTL_MS })
    res.json(data)
  } catch (err) {
    console.error('[LINK-PREVIEW] Error:', err.message)
    res.status(500).json({ error: 'Unable to fetch link preview' })
  }
})

app.delete('/api/posts/:id', auth, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } })
    if (!post) return res.status(404).json({ error: 'Post not found' })
    if (post.author_id !== req.userId) return res.status(403).json({ error: 'Forbidden' })
    await prisma.post.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── COMMENTS ────────────────────────────────────────────
app.get('/api/posts/:id/comments', async (req, res) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { post_id: req.params.id },
      include: {
        user: { select: { id: true, username: true, full_name: true, avatar_url: true } },
      },
      orderBy: { created_at: 'asc' },
    })
    res.json(comments)
  } catch (err) {
    console.error('[COMMENTS] List error:', err)
    res.status(500).json({ error: err.message || 'Failed to load comments' })
  }
})

app.post('/api/posts/:id/comments', auth, async (req, res) => {
  try {
    const { content } = req.body
    if (!content?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' })

    const post = await prisma.post.findUnique({ where: { id: req.params.id } })
    if (!post) return res.status(404).json({ error: 'Post not found' })

    const comment = await prisma.comment.create({
      data: { post_id: req.params.id, user_id: req.userId, content: content.trim() },
      include: {
        user: { select: { id: true, username: true, full_name: true, avatar_url: true } },
      },
    })

    if (post.author_id !== req.userId) {
      await createAndEmitNotification({
        user_id: post.author_id, actor_id: req.userId, type: 'like', message: 'commented on your post',
      })
    }

    res.json(comment)
  } catch (err) {
    console.error('[COMMENTS] Create error:', err)
    res.status(500).json({ error: err.message || 'Failed to create comment' })
  }
})

// ─── LIKES (paginated) ────────────────────────────────────
app.get('/api/posts/:postId/likes', async (req, res) => {
  try {
    const { limit = 20, cursor } = req.query
    const where = { post_id: req.params.postId }
    const take = parseInt(limit) + 1
    const query = {
      where,
      include: { user: { select: { id: true, username: true, full_name: true, avatar_url: true } } },
      orderBy: { created_at: 'desc' },
      take,
    }
    if (cursor) {
      query.cursor = { id: cursor }
      query.skip = 1
    }
    const likes = await prisma.like.findMany(query)
    const hasMore = likes.length > parseInt(limit)
    const items = hasMore ? likes.slice(0, parseInt(limit)) : likes
    const nextCursor = hasMore ? items[items.length - 1].id : null
    res.json({ items, nextCursor, hasMore })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── VIEWS ──────────────────────────────────────────────
app.post('/api/posts/:postId/view', async (req, res) => {
  try {
    const { postId } = req.params
    const sessionId = req.headers['x-session-id'] || null
    let userId = null
    const header = req.headers.authorization
    if (header?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(header.slice(7), JWT_SECRET)
        userId = payload.userId
      } catch { /* guest */ }
    }
    if (!userId && !sessionId) return res.json({ ok: true })
    const uniqueKey = userId ? { post_id: postId, viewer_id: userId } : { post_id: postId, session_id: sessionId }
    const existing = await prisma.postView.findFirst({ where: uniqueKey })
    if (!existing) {
      await prisma.postView.create({ data: { post_id: postId, viewer_id: userId, session_id: sessionId } })
    }
    const viewCount = await prisma.postView.count({ where: { post_id: postId } })
    res.json({ ok: true, view_count: viewCount })
  } catch (err) {
    // Don't block UI on view errors
    console.error('[VIEW] Error:', err.message)
    res.json({ ok: true })
  }
})

// ─── SAVED POSTS ────────────────────────────────────────
app.post('/api/posts/:postId/save', auth, async (req, res) => {
  try {
    const existing = await prisma.savedPost.findUnique({
      where: { user_id_post_id: { user_id: req.userId, post_id: req.params.postId } },
    })
    if (existing) return res.json({ ok: true, saved: true })
    await prisma.savedPost.create({ data: { user_id: req.userId, post_id: req.params.postId } })
    res.json({ ok: true, saved: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/posts/:postId/save', auth, async (req, res) => {
  try {
    await prisma.savedPost.deleteMany({ where: { user_id: req.userId, post_id: req.params.postId } })
    res.json({ ok: true, saved: false })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/me/saved', auth, async (req, res) => {
  try {
    const saved = await prisma.savedPost.findMany({
      where: { user_id: req.userId },
      include: {
        post: {
          include: {
            author: { select: { id: true, username: true, full_name: true, avatar_url: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    })
    res.json(saved.map(s => s.post))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── LIKES ───────────────────────────────────────────────
app.post('/api/likes', auth, async (req, res) => {
  try {
    const { post_id } = req.body
    const existing = await prisma.like.findUnique({
      where: { post_id_user_id: { post_id, user_id: req.userId } },
    })
    if (existing) return res.status(400).json({ error: 'Already liked' })

    await prisma.like.create({ data: { post_id, user_id: req.userId } })

    // Create notification for post author
    const post = await prisma.post.findUnique({ where: { id: post_id } })
    if (post && post.author_id !== req.userId) {
      await createAndEmitNotification({
        user_id: post.author_id, actor_id: req.userId, type: 'like', message: 'liked your post',
      })
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/likes', auth, async (req, res) => {
  try {
    const { post_id } = req.query
    await prisma.like.deleteMany({
      where: { post_id, user_id: req.userId },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── PROJECTS ────────────────────────────────────────────
app.get('/api/projects', async (req, res) => {
  try {
    const { orderBy: order = 'created_at', limit, status, search } = req.query
    const where = {}
    if (status && status !== 'all') where.status = status
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }
    let userId = null
    const header = req.headers.authorization
    if (header?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(header.slice(7), JWT_SECRET)
        userId = payload.userId
      } catch { /* guest */ }
    }
    const projects = await prisma.project.findMany({
      where,
      include: {
        author: { select: { id: true, username: true, full_name: true, avatar_url: true, skills: true, open_to: true } },
      },
      orderBy: order === 'stars' ? { stars: 'desc' } : { created_at: 'desc' },
      take: limit ? parseInt(limit) : undefined,
    })
    let savedSet = new Set()
    if (userId) {
      const saved = await prisma.projectSave.findMany({ where: { user_id: userId }, select: { project_id: true } })
      savedSet = new Set(saved.map(s => s.project_id))
    }
    const formatted = projects.map(p => ({
      ...p,
      user_has_saved: savedSet.has(p.id),
    }))
    res.json(formatted)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/projects/saved', auth, async (req, res) => {
  try {
    const saved = await prisma.projectSave.findMany({
      where: { user_id: req.userId },
      include: {
        project: {
          include: { author: { select: { id: true, username: true, full_name: true, avatar_url: true, skills: true, open_to: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
    })
    res.json(saved.map(s => ({ ...s.project, user_has_saved: true })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/projects/count', async (_req, res) => {
  try {
    const count = await prisma.project.count()
    res.json({ count })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/projects/:id', async (req, res) => {
  try {
    let userId = null
    const header = req.headers.authorization
    if (header?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(header.slice(7), JWT_SECRET)
        userId = payload.userId
      } catch { /* guest */ }
    }
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        author: { select: { id: true, username: true, full_name: true, avatar_url: true, skills: true, open_to: true, bio: true, location: true } },
      },
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })
    let user_has_saved = false
    if (userId) {
      const s = await prisma.projectSave.findUnique({ where: { user_id_project_id: { user_id: userId, project_id: project.id } } })
      user_has_saved = !!s
    }
    res.json({ ...project, user_has_saved })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/projects', auth, async (req, res) => {
  try {
    const { title, description, status, tech_stack, looking_for, repo_url, live_url, file_url, image_url } = req.body
    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'Title and description are required' })
    }
    const project = await prisma.project.create({
      data: {
        author_id: req.userId,
        title: title.trim(),
        description: description.trim(),
        status: status || 'idea',
        tech_stack: tech_stack || [],
        looking_for: looking_for || [],
        repo_url: repo_url || null,
        live_url: live_url || null,
        file_url: file_url || null,
        image_url: image_url || null,
      },
      include: {
        author: { select: { id: true, username: true, full_name: true, avatar_url: true, skills: true, open_to: true } },
      },
    })
    res.json(project)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/projects/:id', auth, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!project) return res.status(404).json({ error: 'Project not found' })
    if (project.author_id !== req.userId) return res.status(403).json({ error: 'Forbidden' })
    const { title, description, status, tech_stack, looking_for, repo_url, live_url, file_url, image_url } = req.body
    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(status !== undefined && { status }),
        ...(tech_stack !== undefined && { tech_stack }),
        ...(looking_for !== undefined && { looking_for }),
        ...(repo_url !== undefined && { repo_url: repo_url || null }),
        ...(live_url !== undefined && { live_url: live_url || null }),
        ...(file_url !== undefined && { file_url: file_url || null }),
        ...(image_url !== undefined && { image_url: image_url || null }),
        updated_at: new Date(),
      },
      include: {
        author: { select: { id: true, username: true, full_name: true, avatar_url: true, skills: true, open_to: true } },
      },
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/projects/:id', auth, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!project) return res.status(404).json({ error: 'Project not found' })
    if (project.author_id !== req.userId) return res.status(403).json({ error: 'Forbidden' })
    await prisma.project.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/projects/:id/save', auth, async (req, res) => {
  try {
    const existing = await prisma.projectSave.findUnique({
      where: { user_id_project_id: { user_id: req.userId, project_id: req.params.id } },
    })
    if (existing) {
      return res.json({ ok: true, saved: true })
    }
    await prisma.projectSave.create({ data: { user_id: req.userId, project_id: req.params.id } })
    await prisma.project.update({ where: { id: req.params.id }, data: { save_count: { increment: 1 } } })
    res.json({ ok: true, saved: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/projects/:id/save', auth, async (req, res) => {
  try {
    const deleted = await prisma.projectSave.deleteMany({ where: { user_id: req.userId, project_id: req.params.id } })
    if (deleted.count > 0) {
      await prisma.project.update({ where: { id: req.params.id }, data: { save_count: { decrement: 1 } } })
    }
    res.json({ ok: true, saved: false })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── PROJECT MATCH ───────────────────────────────────────
app.get('/api/projects/:id/match', auth, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const allProfiles = await prisma.profile.findMany({
      where: { id: { not: project.author_id } },
      select: { id: true, username: true, full_name: true, avatar_url: true, skills: true, open_to: true, location: true, bio: true },
    })

    const matched = allProfiles.map(p => {
      let score = 0
      // +3 per skill that matches project's looking_for
      const lookingLower = project.looking_for.map(s => s.toLowerCase())
      p.skills.forEach(skill => {
        if (lookingLower.includes(skill.toLowerCase())) score += 3
      })
      // +2 if open_to is collaboration
      if (p.open_to === 'collaboration') score += 2
      // +1 if skill appears in project's tech_stack
      const stackLower = project.tech_stack.map(s => s.toLowerCase())
      p.skills.forEach(skill => {
        if (stackLower.includes(skill.toLowerCase())) score += 1
      })
      return { ...p, matchScore: score }
    })

    matched.sort((a, b) => b.matchScore - a.matchScore)
    res.json(matched.filter(m => m.matchScore > 0).slice(0, 20))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── BUDDIES ─────────────────────────────────────────────
app.get('/api/buddies', auth, async (req, res) => {
  try {
    const { requester_id } = req.query
    const where = requester_id ? { requester_id } : {
      OR: [{ requester_id: req.userId }, { addressee_id: req.userId }],
    }
    const buddies = await prisma.buddy.findMany({ where })
    res.json(buddies)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/buddies', auth, async (req, res) => {
  try {
    const { addressee_id } = req.body
    const existing = await prisma.buddy.findUnique({
      where: { requester_id_addressee_id: { requester_id: req.userId, addressee_id } },
    })
    if (existing) return res.status(400).json({ error: 'Already requested' })

    await prisma.buddy.create({
      data: { requester_id: req.userId, addressee_id },
    })

    // Create notification
    await createAndEmitNotification({
      user_id: addressee_id, actor_id: req.userId, type: 'buddy_request', message: 'sent you a buddy request',
    })

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/buddies/:id', auth, async (req, res) => {
  try {
    const { status } = req.body
    const buddy = await prisma.buddy.findUnique({ where: { id: req.params.id } })
    if (!buddy) return res.status(404).json({ error: 'Not found' })
    if (buddy.requester_id !== req.userId && buddy.addressee_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const updated = await prisma.buddy.update({ where: { id: req.params.id }, data: { status } })

    if (status === 'accepted') {
      await createAndEmitNotification({
        user_id: buddy.requester_id, actor_id: req.userId, type: 'buddy_accepted', message: 'accepted your buddy request',
      })
    }

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── MENTORSHIPS ─────────────────────────────────────────
app.get('/api/mentorships', auth, async (req, res) => {
  try {
    const mentorships = await prisma.mentorship.findMany({
      where: {
        OR: [{ mentee_id: req.userId }, { mentor_id: req.userId }],
      },
      include: {
        mentor: { select: { id: true, username: true, full_name: true, avatar_url: true } },
        mentee: { select: { id: true, username: true, full_name: true, avatar_url: true } },
      },
    })
    res.json(mentorships)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/mentorships', auth, async (req, res) => {
  try {
    const { mentor_id, topic, message } = req.body
    const mentorship = await prisma.mentorship.create({
      data: { mentor_id, mentee_id: req.userId, topic, message: message || '' },
    })

    // Notification
    await createAndEmitNotification({
      user_id: mentor_id, actor_id: req.userId, type: 'mentorship_request', message: `requested mentorship on ${topic}`,
    })

    res.json(mentorship)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/mentorships/:id', auth, async (req, res) => {
  try {
    const { status } = req.body
    const m = await prisma.mentorship.findUnique({ where: { id: req.params.id } })
    if (!m) return res.status(404).json({ error: 'Not found' })

    const updated = await prisma.mentorship.update({ where: { id: req.params.id }, data: { status } })

    if (status === 'accepted') {
      await createAndEmitNotification({
        user_id: m.mentee_id, actor_id: req.userId, type: 'mentorship_accepted', message: 'accepted your mentorship request',
      })
    }

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── NOTIFICATIONS ───────────────────────────────────────
app.get('/api/notifications', auth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { user_id: req.userId },
      include: {
        actor: { select: { id: true, username: true, full_name: true, avatar_url: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    })
    res.json(notifications)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/notifications/read', auth, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { user_id: req.userId, is_read: false },
      data: { is_read: true },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── NOTES (voz / música) ─────────────────────────────────
// Una nota por usuario para el carrusel de Messages.
// text ≤ 60 caracteres + pista de iTunes opcional (JSON whitelist).
const NOTE_TEXT_MAX = 60
const NOTE_RAW_MAX = 500 // rechaza basura sin siquiera procesarla

/** Mismo normalizado que el cliente: colapsa espacios, recorta y limita a 60. */
function normalizeNoteText(value) {
  return String(value).replace(/\s+/g, ' ').trim().slice(0, NOTE_TEXT_MAX)
}

/** Solo campos conocidos de la pista pasan a la DB (nada de prototype pollution). */
function sanitizeNoteTrack(track) {
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null)
  const clean = {
    id: str(track.id, 100),
    name: str(track.name, 300),
    artist: str(track.artist, 300),
    artwork: str(track.artwork, 1000),
    previewUrl: str(track.previewUrl, 1000),
    genre: str(track.genre, 100),
  }
  if (!clean.id || !clean.name || !clean.artist) return null
  return Object.fromEntries(Object.entries(clean).filter(([, v]) => v !== null))
}

app.get('/api/notes', auth, async (req, res) => {
  try {
    const notes = await prisma.userNote.findMany({
      select: { user_id: true, text: true, track: true, updated_at: true },
      orderBy: { updated_at: 'desc' },
      take: 500,
    })
    res.json(notes)
  } catch (err) {
    console.error('[NOTES] List error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/notes', auth, async (req, res) => {
  try {
    const { text, track } = req.body ?? {}
    if (text !== undefined && text !== null && typeof text !== 'string') {
      return res.status(400).json({ error: 'text must be a string' })
    }
    if (typeof text === 'string' && text.length > NOTE_RAW_MAX) {
      return res.status(400).json({ error: `text too long (max ${NOTE_RAW_MAX} raw chars)` })
    }
    const normalized = normalizeNoteText(text ?? '')

    let cleanTrack = null
    if (track !== undefined && track !== null) {
      if (typeof track !== 'object' || Array.isArray(track)) {
        return res.status(400).json({ error: 'track must be an object' })
      }
      cleanTrack = sanitizeNoteTrack(track)
      if (!cleanTrack) {
        return res.status(400).json({ error: 'track requires id, name and artist strings' })
      }
    }
    if (!normalized && !cleanTrack) {
      return res.status(400).json({ error: 'Note requires text or a track' })
    }

    const now = new Date()
    const note = await prisma.userNote.upsert({
      where: { user_id: req.userId },
      create: { user_id: req.userId, text: normalized, track: cleanTrack, created_at: now, updated_at: now },
      update: { text: normalized, track: cleanTrack, updated_at: now },
    })
    res.json(note)
  } catch (err) {
    console.error('[NOTES] Save error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/notes', auth, async (req, res) => {
  try {
    await prisma.userNote.deleteMany({ where: { user_id: req.userId } })
    res.json({ ok: true })
  } catch (err) {
    console.error('[NOTES] Delete error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── MESSAGES (REST) ─────────────────────────────────────
/**
 * Create a message over REST (fallback path used by the client when the
 * realtime socket is down). Responds with the created message, including
 * its definitive id, so the client can add it straight to its list.
 */
app.post('/api/messages', auth, async (req, res) => {
  try {
    const { receiver_id, receiverId, text, conversation_id, conversationId, reply_to_id, client_id } = req.body ?? {}
    const result = await createAndBroadcastMessage({
      userId: req.userId,
      receiverId: receiver_id || receiverId,
      text,
      conversationId: conversation_id || conversationId,
      replyToId: reply_to_id,
      clientId: client_id,
    })
    if (!result.ok) return res.status(result.status || 400).json({ error: result.error })
    res.status(201).json({ message: result.message })
  } catch (err) {
    console.error('[MESSAGES] Create error:', err)
    res.status(500).json({ error: 'Unable to send message. Please try again.' })
  }
})

/**
 * Search inside one conversation (backend search so large histories do not
 * have to be downloaded to be searched).
 * Registered BEFORE /api/messages/:userId so "search" is not read as an id.
 */
app.get('/api/messages/search', auth, async (req, res) => {
  try {
    const { conversation_id, q } = req.query
    if (!conversation_id || !q) return res.status(400).json({ error: 'conversation_id and q are required' })

    const conv = await prisma.conversation.findUnique({ where: { id: String(conversation_id) } })
    if (!conv || (conv.user_a_id !== req.userId && conv.user_b_id !== req.userId)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const rows = await prisma.message.findMany({
      where: {
        conversation_id: conv.id,
        text: { contains: String(q), mode: 'insensitive' },
        deleted_for_all: false,
      },
      include: { sender: { select: { id: true, username: true, full_name: true, avatar_url: true } } },
      orderBy: { created_at: 'desc' },
      take: 100,
    })
    // Prisma no admite `hasNot` sobre arrays → filtro en JS sobre la lista acotada
    const messages = rows
      .filter((m) => !(Array.isArray(m.deleted_by) && m.deleted_by.includes(req.userId)))
      .slice(0, 50)
    res.json({ messages })
  } catch (err) {
    console.error('[MESSAGES] Search error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** Toggle a reaction on a message and broadcast it to the chat room. */
app.post('/api/messages/:messageId/react', auth, async (req, res) => {
  try {
    const emoji = String(req.body?.emoji ?? '').trim().slice(0, 8)
    if (!emoji) return res.status(400).json({ error: 'emoji is required' })

    const message = await prisma.message.findUnique({
      where: { id: req.params.messageId },
      include: { conversation: { select: { user_a_id: true, user_b_id: true } } },
    })
    if (!message) return res.status(404).json({ error: 'Message not found' })
    if (message.conversation.user_a_id !== req.userId && message.conversation.user_b_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const current = Array.isArray(message.reactions) ? message.reactions : []
    const clean = current.filter((r) => r && typeof r.user_id === 'string' && typeof r.emoji === 'string')
    const alreadyMine = clean.some((r) => r.user_id === req.userId && r.emoji === emoji)
    const next = alreadyMine
      ? clean.filter((r) => !(r.user_id === req.userId && r.emoji === emoji))
      : [...clean.filter((r) => r.user_id !== req.userId), { user_id: req.userId, emoji }]

    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { reactions: next },
      include: { sender: { select: { id: true, username: true, full_name: true, avatar_url: true } } },
    })
    const payload = { ...updated, conversation_id: message.conversation_id }
    io.to(`chat:${message.conversation_id}`).emit('message:reaction', payload)
    res.json({ message: payload })
  } catch (err) {
    console.error('[MESSAGES] React error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** Delete a message: scope=me (only for me) or scope=everyone (author only). */
app.delete('/api/messages/:messageId', auth, async (req, res) => {
  try {
    const scope = String(req.body?.scope || req.query.scope || 'me')
    const message = await prisma.message.findUnique({
      where: { id: req.params.messageId },
      include: { conversation: { select: { user_a_id: true, user_b_id: true } } },
    })
    if (!message) return res.status(404).json({ error: 'Message not found' })
    if (message.conversation.user_a_id !== req.userId && message.conversation.user_b_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (scope === 'everyone') {
      if (message.sender_id !== req.userId) {
        return res.status(403).json({ error: 'Only the author can delete for everyone' })
      }
      await prisma.message.update({ where: { id: message.id }, data: { deleted_for_all: true } })
      io.to(`chat:${message.conversation_id}`).emit('message:deleted', {
        conversationId: message.conversation_id,
        messageId: message.id,
        scope: 'everyone',
        deleted_by: message.deleted_by,
      })
      return res.json({ ok: true, scope: 'everyone' })
    }

    const next = [...new Set([...(Array.isArray(message.deleted_by) ? message.deleted_by : []), req.userId])]
    await prisma.message.update({ where: { id: message.id }, data: { deleted_by: next } })
    io.to(`chat:${message.conversation_id}`).emit('message:deleted', {
      conversationId: message.conversation_id,
      messageId: message.id,
      scope: 'me',
      deleted_by: next,
    })
    res.json({ ok: true, scope: 'me' })
  } catch (err) {
    console.error('[MESSAGES] Delete error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** Mute / unmute notifications for a conversation (persisted per user). */
app.post('/api/conversations/:conversationId/mute', auth, async (req, res) => {
  try {
    const conv = await prisma.conversation.findUnique({ where: { id: req.params.conversationId } })
    if (!conv) return res.status(404).json({ error: 'Conversation not found' })
    if (conv.user_a_id !== req.userId && conv.user_b_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const muted = Boolean(req.body?.muted)
    const set = new Set(Array.isArray(conv.muted_by) ? conv.muted_by : [])
    if (muted) set.add(req.userId)
    else set.delete(req.userId)
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { muted_by: { set: [...set] } },
    })
    res.json({ ok: true, muted })
  } catch (err) {
    console.error('[CONVERSATIONS] Mute error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** Clear chat: hides every message of this conversation *for me* only. */
app.post('/api/conversations/:conversationId/clear', auth, async (req, res) => {
  try {
    const conv = await prisma.conversation.findUnique({ where: { id: req.params.conversationId } })
    if (!conv) return res.status(404).json({ error: 'Conversation not found' })
    if (conv.user_a_id !== req.userId && conv.user_b_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await prisma.$executeRaw`
      UPDATE codebuds."Message"
      SET deleted_by = array_append(deleted_by, ${req.userId})
      WHERE conversation_id = ${conv.id}
        AND NOT (${req.userId} = ANY(deleted_by))
        AND deleted_for_all = false
    `
    io.to(`chat:${conv.id}`).emit('chat:cleared', { conversationId: conv.id, userId: req.userId })
    res.json({ ok: true })
  } catch (err) {
    console.error('[CONVERSATIONS] Clear error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/messages/conversations', auth, async (req, res) => {
  try {
    const userId = req.userId
    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ user_a_id: userId }, { user_b_id: userId }] },
      include: {
        userA: { select: { id: true, username: true, full_name: true, avatar_url: true } },
        userB: { select: { id: true, username: true, full_name: true, avatar_url: true } },
        messages: { orderBy: { created_at: 'desc' }, take: 1 },
      },
      orderBy: { updated_at: 'desc' },
    })
    // Attach unread count + mute flag per conversation
    const result = await Promise.all(conversations.map(async (c) => {
      // SQL crudo: Prisma no admite `hasNot` sobre arrays y el badge debe
      // ignorar lo que el usuario ya borró para sí mismo.
      const rows = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS count
        FROM codebuds."Message"
        WHERE conversation_id = ${c.id}
          AND sender_id <> ${userId}
          AND read = false
          AND deleted_for_all = false
          AND (deleted_by IS NULL OR NOT (${userId} = ANY(deleted_by)))
      `
      const unreadCount = Number(rows?.[0]?.count ?? 0)
      const muted = Array.isArray(c.muted_by) && c.muted_by.includes(userId)
      return { ...c, muted, unread_count: unreadCount }
    }))
    res.json(result)
  } catch (err) {
    console.error('[CONVERSATIONS] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/messages/unread-count', auth, async (req, res) => {
  try {
    const count = await prisma.message.count({
      where: {
        conversation: { OR: [{ user_a_id: req.userId }, { user_b_id: req.userId }] },
        sender_id: { not: req.userId },
        read: false,
      },
    })
    res.json({ count })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/messages/:userId', auth, async (req, res) => {
  try {
    const myId = req.userId
    let otherId = req.params.userId

    // Resolve username to UUID if needed
    if (!otherId.includes('-')) {
      const user = await prisma.profile.findUnique({ where: { username: otherId }, select: { id: true } })
      if (!user) return res.status(404).json({ error: 'User not found' })
      otherId = user.id
    }

    // Find or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { user_a_id: myId, user_b_id: otherId },
          { user_a_id: otherId, user_b_id: myId },
        ],
      },
    })
    if (!conversation) {
      // Sort IDs to match unique constraint
      const [a, b] = [myId, otherId].sort()
      conversation = await prisma.conversation.create({
        data: { user_a_id: a, user_b_id: b },
      })
    }

    const messages = await prisma.message.findMany({
      where: { conversation_id: conversation.id },
      include: { sender: { select: { id: true, username: true, full_name: true, avatar_url: true } } },
      orderBy: { created_at: 'asc' },
      take: 200,
    })

    // ── Visibility: hide what I deleted (or that was deleted for all) ──
    const visible = messages.filter(
      (m) => !m.deleted_for_all && !(Array.isArray(m.deleted_by) && m.deleted_by.includes(myId))
    )

    // Quoted messages for reply previews
    const replyIds = [...new Set(visible.map((m) => m.reply_to_id).filter(Boolean))]
    const quoted = replyIds.length
      ? await prisma.message.findMany({
          where: { id: { in: replyIds } },
          select: { id: true, sender_id: true, text: true },
        })
      : []
    const replyMap = new Map(quoted.map((q) => [q.id, q]))

    // ── Receipts: opening the thread means I received these messages ──
    const now = new Date()
    const toDeliver = visible.filter((m) => m.sender_id === otherId && !m.delivered_at)
    if (toDeliver.length) {
      await prisma.message.updateMany({
        where: { id: { in: toDeliver.map((m) => m.id) } },
        data: { delivered_at: now },
      })
      io.to(`chat:${conversation.id}`).emit('message:delivered', {
        conversationId: conversation.id,
        messageIds: toDeliver.map((m) => m.id),
        delivered_at: now,
      })
    }

    // ...and reading them marks them read for the sender (event, not fake data)
    const unreadFromOther = await prisma.message.findMany({
      where: { conversation_id: conversation.id, sender_id: otherId, read: false },
      select: { id: true },
    })
    const readIds = unreadFromOther.map((m) => m.id)
    if (readIds.length) {
      await prisma.message.updateMany({ where: { id: { in: readIds } }, data: { read: true } })
      io.to(`chat:${conversation.id}`).emit('message:read', {
        conversationId: conversation.id,
        messageIds: readIds,
        readerId: myId,
      })
    }

    const deliveredSet = new Set(toDeliver.map((m) => m.id))
    const payload = visible.map((m) => ({
      ...m,
      reply_to: m.reply_to_id ? replyMap.get(m.reply_to_id) || null : null,
      delivered_at: deliveredSet.has(m.id) ? now : m.delivered_at,
      read: m.sender_id === otherId ? true : m.read,
    }))

    const muted = Array.isArray(conversation.muted_by) && conversation.muted_by.includes(myId)
    const blocked = await isBlockedBetween(myId, otherId)

    res.json({ conversation_id: conversation.id, messages: payload, muted, blocked })
  } catch (err) {
    console.error('[MESSAGES] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── Socket.io ───────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: [FRONTEND_URL, 'https://www.codebuds.site', 'http://localhost:5173', 'http://localhost:3001'],
    credentials: true,
  },
})

// Map userId → Set of socket ids
const onlineUsers = new Map()

/**
 * Create a notification row and push it in real time to its recipient.
 * Emits `new_notification` on the recipient's personal room so connected
 * clients update instantly (badge + list) without polling.
 * Declared as a function so routes defined earlier in this file can use it.
 */
async function createAndEmitNotification(data) {
  const notification = await prisma.notification.create({
    data,
    include: {
      actor: { select: { id: true, username: true, full_name: true, avatar_url: true } },
    },
  })
  io.to(`user:${notification.user_id}`).emit('new_notification', notification)
  return notification
}

/**
 * True when either user has blocked the other. Blocks are enforced
 * server-side (REST + socket) so they cannot be bypassed from the UI.
 */
async function isBlockedBetween(userA, userB) {
  if (!userA || !userB || userA === userB) return false
  const row = await prisma.block.findFirst({
    where: {
      OR: [
        { blocker_id: userA, blocked_id: userB },
        { blocker_id: userB, blocked_id: userA },
      ],
    },
    select: { id: true },
  })
  return !!row
}

/** Is this user connected through any socket right now? */
function isOnline(userId) {
  const sockets = onlineUsers.get(userId)
  return !!sockets && sockets.size > 0
}

/**
 * Mark every undelivered message addressed to `userId` as delivered now
 * that they are online, and push `message:delivered` to the senders.
 */
async function markDeliveredFor(userId) {
  try {
    const pending = await prisma.message.findMany({
      where: {
        delivered_at: null,
        sender_id: { not: userId },
        conversation: { OR: [{ user_a_id: userId }, { user_b_id: userId }] },
      },
      select: { id: true, conversation_id: true, sender_id: true },
    })
    if (!pending.length) return
    const now = new Date()
    await prisma.message.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { delivered_at: now },
    })
    for (const convId of [...new Set(pending.map((p) => p.conversation_id))]) {
      const messageIds = pending.filter((p) => p.conversation_id === convId).map((p) => p.id)
      const payload = { conversationId: convId, messageIds, delivered_at: now }
      io.to(`chat:${convId}`).emit('message:delivered', payload)
      for (const p of pending.filter((x) => x.conversation_id === convId)) {
        io.to(`user:${p.sender_id}`).emit('message:delivered', payload)
      }
    }
  } catch (err) {
    console.error('[MESSAGES] markDeliveredFor error:', err)
  }
}

/**
 * Create a chat message and broadcast it — shared by the socket handler and
 * by POST /api/messages so both paths behave identically (same validation,
 * same realtime events).
 * Resolves to { ok: true, message } with the definitive message id, or
 * { ok: false, error }.
 */
async function createAndBroadcastMessage({ userId, receiverId, text, conversationId, replyToId, clientId }) {
  // Validate and sanitize text
  const cleanText = String(text ?? '').trim()
  if (!cleanText) return { ok: false, error: 'Empty message' }
  if (cleanText.length > 4000) return { ok: false, error: 'Message too long (max 4000 characters)' }

  // Validate receiverId
  if (!receiverId && !conversationId) return { ok: false, error: 'No receiver specified' }

  // Resolve username → UUID when needed and make sure the target user
  // exists. With the match gate disabled, this is what rejects bogus
  // receivers with a 400 instead of blowing up on a foreign key.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (receiverId && !UUID_RE.test(String(receiverId))) {
    const user = await prisma.profile.findUnique({ where: { username: String(receiverId) }, select: { id: true } })
    if (!user) return { ok: false, error: 'Receiver not found' }
    receiverId = user.id
  }
  if (receiverId) {
    const receiver = await prisma.profile.findUnique({ where: { id: String(receiverId) }, select: { id: true } })
    if (!receiver) return { ok: false, error: 'Receiver not found' }
  }

  // ── Match restriction: only match mutuos can message ──
  // DISABLED (2026-10-05): any authenticated user can now DM any other user,
  // over both the socket and POST /api/messages (they share this helper).
  // Left commented so the vibe/match gate can be restored in one step.
  // if (receiverId) {
  //   const [a, b] = [userId, receiverId].sort()
  //   const match = await prisma.match.findUnique({
  //     where: { user_a_id_user_b_id: { user_a_id: a, user_b_id: b } },
  //   })
  //   if (!match) return { ok: false, error: 'You can only message matched users. Send a vibe first!' }
  // }

  let conv = null
  let convId = conversationId
  if (!convId && receiverId) {
    // Find or create conversation
    const [a, b] = [userId, receiverId].sort()
    conv = await prisma.conversation.findUnique({
      where: { user_a_id_user_b_id: { user_a_id: a, user_b_id: b } },
    })
    if (!conv) {
      conv = await prisma.conversation.create({ data: { user_a_id: a, user_b_id: b } })
    }
    convId = conv.id
  }
  if (!convId) return { ok: false, error: 'No conversation' }

  // A client-supplied conversation id must exist and must include the sender:
  // a guessed/stale id would otherwise hit a foreign key error (500) or let
  // someone write into another pair's thread.
  if (!conv) {
    conv = await prisma.conversation.findUnique({ where: { id: convId } })
    if (!conv) return { ok: false, error: 'Conversation not found' }
  }
  if (conv.user_a_id !== userId && conv.user_b_id !== userId) {
    return { ok: false, error: 'Forbidden', status: 403 }
  }

  const otherId = conv.user_a_id === userId ? conv.user_b_id : conv.user_a_id

  // ── Block gate (backend, not just UI): no messages either way ──
  if (await isBlockedBetween(userId, otherId)) {
    return { ok: false, error: 'You cannot message this user.', status: 403 }
  }

  // ── Reply: the quoted message must live in this same conversation ──
  let replyTo = null
  if (replyToId) {
    replyTo = await prisma.message.findFirst({
      where: { id: String(replyToId), conversation_id: convId },
      select: { id: true, sender_id: true, text: true },
    })
    if (!replyTo) return { ok: false, error: 'Replied message not found' }
  }

  const message = await prisma.message.create({
    data: {
      conversation_id: convId,
      sender_id: userId,
      text: cleanText,
      reply_to_id: replyTo ? replyTo.id : null,
      // Delivery receipt: the recipient is connected right now.
      delivered_at: isOnline(otherId) ? new Date() : null,
    },
    include: { sender: { select: { id: true, username: true, full_name: true, avatar_url: true } } },
  })

  // Update conversation timestamp
  await prisma.conversation.update({ where: { id: convId }, data: { updated_at: new Date() } })

  // Build normalized response — always include conversation_id at top level
  const normalized = {
    ...message,
    conversation_id: convId,
    reply_to: replyTo || null,
    client_id: clientId || null,
  }

  // Emit to chat room — `new_message` is the canonical event the client
  // handles; `receive_message` is kept as an alias for older cached clients.
  io.to(`chat:${convId}`).emit('new_message', normalized)
  io.to(`chat:${convId}`).emit('receive_message', normalized)

  // Delivery receipt for the sender (both directions covered: sender's room
  // catches the case where they left the chat before the ack resolved).
  if (normalized.delivered_at) {
    const deliveredPayload = {
      conversationId: convId,
      messageIds: [normalized.id],
      delivered_at: normalized.delivered_at,
    }
    io.to(`chat:${convId}`).emit('message:delivered', deliveredPayload)
    io.to(`user:${userId}`).emit('message:delivered', deliveredPayload)
  }

  // Notify receiver via their user room — unless they muted this chat
  const muted = Array.isArray(conv.muted_by) && conv.muted_by.includes(otherId)
  if (!muted) {
    io.to(`user:${otherId}`).emit('new_message_notification', {
      conversation_id: convId,
      message: normalized,
    })
  }

  return { ok: true, message: normalized }
}

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('Authentication required'))
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    socket.userId = payload.userId
    next()
  } catch {
    next(new Error('Invalid token'))
  }
})

io.on('connection', (socket) => {
  const userId = socket.userId
  console.log('[SOCKET] Connected:', userId)

  // Track online users
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set())
  onlineUsers.get(userId).add(socket.id)

  // Join a per-user room for direct notifications
  socket.join(`user:${userId}`)

  // Presence + delivery receipts: this user just came online
  io.emit('presence_change', { userId, online: true })
  markDeliveredFor(userId)

  socket.on('join_chat', ({ conversationId }) => {
    if (conversationId) socket.join(`chat:${conversationId}`)
  })

  socket.on('leave_chat', ({ conversationId }) => {
    if (conversationId) socket.leave(`chat:${conversationId}`)
  })

  socket.on('send_message', async (data, ack) => {
    try {
      const { receiverId, text, conversationId, replyToId, clientId } = data ?? {}
      const result = await createAndBroadcastMessage({
        userId,
        receiverId,
        text,
        conversationId,
        replyToId,
        clientId,
      })
      if (!result.ok) {
        // Real failure event: the client keeps the bubble and shows Retry
        socket.emit('message:failed', {
          conversationId: conversationId || null,
          clientId: clientId || null,
          error: result.error || 'Failed to send message',
        })
      }
      ack?.(result)
    } catch (err) {
      console.error('[SOCKET] send_message error:', err)
      const error = 'Unable to send message. Please try again.'
      socket.emit('message:failed', {
        conversationId: data?.conversationId ?? null,
        clientId: data?.clientId ?? null,
        error,
      })
      ack?.({ ok: false, error })
    }
  })

  socket.on('typing', ({ conversationId }) => {
    if (conversationId) {
      socket.to(`chat:${conversationId}`).emit('typing', { userId, conversationId })
    }
  })

  socket.on('stop_typing', ({ conversationId }) => {
    if (conversationId) {
      socket.to(`chat:${conversationId}`).emit('stop_typing', { userId, conversationId })
    }
  })

  socket.on('mark_read', async ({ conversationId }) => {
    if (!conversationId) return
    try {
      const pending = await prisma.message.findMany({
        where: { conversation_id: conversationId, sender_id: { not: userId }, read: false },
        select: { id: true },
      })
      const ids = pending.map((m) => m.id)
      if (!ids.length) return
      await prisma.message.updateMany({ where: { id: { in: ids } }, data: { read: true } })
      // Read receipt pushed to everyone in the room (incl. the sender)
      io.to(`chat:${conversationId}`).emit('message:read', {
        conversationId,
        messageIds: ids,
        readerId: userId,
      })
    } catch (err) {
      console.error('[SOCKET] mark_read error:', err)
    }
  })

  socket.on('disconnect', () => {
    console.log('[SOCKET] Disconnected:', userId)
    const sockets = onlineUsers.get(userId)
    if (sockets) {
      sockets.delete(socket.id)
      if (sockets.size === 0) {
        onlineUsers.delete(userId)
        io.emit('presence_change', { userId, online: false })
      }
    }
  })
})

// ═══════════════════════════════════════════════════════
// MATCHING SYSTEM — Discover, Vibes, Matches, Blocks, Reports
// ═══════════════════════════════════════════════════════

// ─── DISCOVER ────────────────────────────────────────────
app.get('/api/discover', auth, async (req, res) => {
  try {
    const { looking_for, interests, city, age_range, country, region, timezone, limit = 20, cursor } = req.query
    const myId = req.userId

    // Get blocked user IDs (both directions)
    const blocked = await prisma.block.findMany({
      where: { OR: [{ blocker_id: myId }, { blocked_id: myId }] },
      select: { blocker_id: true, blocked_id: true },
    })
    const blockedIds = new Set()
    for (const b of blocked) {
      blockedIds.add(b.blocker_id)
      blockedIds.add(b.blocked_id)
    }
    blockedIds.delete(myId)

    // Get users already vibed (sent or received)
    const vibed = await prisma.vibe.findMany({
      where: { OR: [{ sender_id: myId }, { receiver_id: myId }] },
      select: { sender_id: true, receiver_id: true },
    })
    const vibedIds = new Set()
    for (const v of vibed) {
      vibedIds.add(v.sender_id)
      vibedIds.add(v.receiver_id)
    }
    vibedIds.delete(myId)

    // Build where clause
    const where = {
      id: { not: myId, notIn: [...blockedIds, ...vibedIds] },
      visibility: 'public',
    }

    // Filter by looking_for
    if (looking_for) {
      where.looking_for = { has: looking_for }
    }

    // Filter by interests (any match)
    if (interests) {
      const interestList = interests.split(',').map(s => s.trim()).filter(Boolean)
      if (interestList.length > 0) {
        where.interests = { hasSome: interestList }
      }
    }

    // Filter by city (case-insensitive contains)
    if (city) {
      where.city = { contains: city, mode: 'insensitive' }
    }

    // Filter by age_range
    if (age_range) {
      where.age_range = age_range
    }

    // Filter by country
    if (country) {
      where.country_code = country.toUpperCase()
    }

    // Filter by region
    if (region) {
      where.region = { contains: region, mode: 'insensitive' }
    }

    // Filter by timezone
    if (timezone) {
      where.timezone = { contains: timezone, mode: 'insensitive' }
    }

    // Get my profile for match scoring
    const myProfile = await prisma.profile.findUnique({
      where: { id: myId },
      select: { interests: true, looking_for: true, city: true, age_verified: true },
    })

    const take = parseInt(limit) + 1
    const query = {
      where,
      select: {
        id: true, username: true, full_name: true, bio: true, avatar_url: true,
        skills: true, city: true, interests: true, looking_for: true,
        availability: true, age_range: true, last_active: true, age_verified: true,
        country: true, country_code: true, region: true, timezone: true,
      },
      orderBy: { last_active: 'desc' },
      take,
    }
    if (cursor) {
      query.cursor = { id: cursor }
      query.skip = 1
    }

    const profiles = await prisma.profile.findMany(query)
    const hasMore = profiles.length > parseInt(limit)
    const items = hasMore ? profiles.slice(0, parseInt(limit)) : profiles
    const nextCursor = hasMore ? items[items.length - 1].id : null

    // Calculate match score for each profile
    const scored = items.map(p => {
      let score = 0
      let maxScore = 0

      // Shared interests (max 40 points)
      const sharedInterests = p.interests.filter(i => myProfile.interests.includes(i))
      maxScore += 40
      score += Math.min(40, (sharedInterests.length / Math.max(myProfile.interests.length, 1)) * 40)

      // Same looking_for (max 30 points)
      const sharedLookingFor = p.looking_for.filter(l => myProfile.looking_for.includes(l))
      maxScore += 30
      score += Math.min(30, (sharedLookingFor.length / Math.max(myProfile.looking_for.length, 1)) * 30)

      // Same city (max 20 points)
      maxScore += 20
      if (myProfile.city && p.city && myProfile.city.toLowerCase() === p.city.toLowerCase()) {
        score += 20
      }

      // Shared skills (max 10 points)
      maxScore += 10
      const mySkills = myProfile.interests // Use interests as proxy for skills matching
      score += Math.min(10, (sharedInterests.length > 0 ? 10 : 0))

      const matchPercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0

      return { ...p, match_score: matchPercent, shared_interests: sharedInterests }
    })

    // Sort by match score descending
    scored.sort((a, b) => b.match_score - a.match_score)

    res.json({ items: scored, nextCursor, hasMore })
  } catch (err) {
    console.error('[DISCOVER] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── VIBES ───────────────────────────────────────────────
app.post('/api/vibes', auth, async (req, res) => {
  try {
    const { receiver_id } = req.body
    if (!receiver_id) return res.status(400).json({ error: 'receiver_id is required' })
    if (receiver_id === req.userId) return res.status(400).json({ error: 'Cannot vibe yourself' })

    // Check if blocked
    const blockExists = await prisma.block.findFirst({
      where: {
        OR: [
          { blocker_id: req.userId, blocked_id: receiver_id },
          { blocker_id: receiver_id, blocked_id: req.userId },
        ],
      },
    })
    if (blockExists) return res.status(403).json({ error: 'Cannot send vibe to this user' })

    // Check existing vibe
    const existing = await prisma.vibe.findUnique({
      where: { sender_id_receiver_id: { sender_id: req.userId, receiver_id } },
    })
    if (existing) return res.status(400).json({ error: 'Vibe already sent' })

    // Create vibe
    const vibe = await prisma.vibe.create({
      data: { sender_id: req.userId, receiver_id },
      include: {
        sender: { select: { id: true, username: true, full_name: true, avatar_url: true } },
        receiver: { select: { id: true, username: true, full_name: true, avatar_url: true } },
      },
    })

    // Check if reverse vibe exists → auto-match
    const reverseVibe = await prisma.vibe.findUnique({
      where: { sender_id_receiver_id: { sender_id: receiver_id, receiver_id: req.userId } },
    })

    let match = null
    if (reverseVibe) {
      // Create match!
      const [a, b] = [req.userId, receiver_id].sort()
      match = await prisma.match.create({
        data: { user_a_id: a, user_b_id: b },
        include: {
          userA: { select: { id: true, username: true, full_name: true, avatar_url: true } },
          userB: { select: { id: true, username: true, full_name: true, avatar_url: true } },
        },
      })

      // Update both vibes to accepted
      await prisma.vibe.updateMany({
        where: {
          OR: [
            { sender_id: req.userId, receiver_id },
            { sender_id: receiver_id, receiver_id: req.userId },
          ],
        },
        data: { status: 'accepted' },
      })

      // Create notifications (each one is also emitted in real time)
      await Promise.all([
        createAndEmitNotification({
          user_id: req.userId,
          actor_id: receiver_id,
          type: 'match',
          message: `It's a match! You and ${vibe.receiver.full_name} can now chat.`,
        }),
        createAndEmitNotification({
          user_id: receiver_id,
          actor_id: req.userId,
          type: 'match',
          message: `It's a match! You and ${vibe.sender.full_name} can now chat.`,
        }),
      ])

      // Emit via socket
      io.to(`user:${receiver_id}`).emit('new_match', { match })
    } else {
      // Notify receiver of new vibe
      await createAndEmitNotification({
        user_id: receiver_id,
        actor_id: req.userId,
        type: 'vibe_received',
        message: `${vibe.sender.full_name} sent you a vibe!`,
      })
      io.to(`user:${receiver_id}`).emit('new_vibe', { vibe })
    }

    res.json({ vibe, match })
  } catch (err) {
    console.error('[VIBES] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/vibes/:id', auth, async (req, res) => {
  try {
    const { status } = req.body
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Status must be accepted or declined' })
    }

    const vibe = await prisma.vibe.findUnique({ where: { id: req.params.id } })
    if (!vibe) return res.status(404).json({ error: 'Vibe not found' })
    if (vibe.receiver_id !== req.userId) return res.status(403).json({ error: 'Not your vibe' })
    if (vibe.status !== 'pending') return res.status(400).json({ error: 'Vibe already responded' })

    await prisma.vibe.update({ where: { id: req.params.id }, data: { status } })

    if (status === 'accepted') {
      // Create match
      const [a, b] = [vibe.sender_id, vibe.receiver_id].sort()
      const match = await prisma.match.create({
        data: { user_a_id: a, user_b_id: b },
        include: {
          userA: { select: { id: true, username: true, full_name: true, avatar_url: true } },
          userB: { select: { id: true, username: true, full_name: true, avatar_url: true } },
        },
      })

      // Notify sender
      const receiverProfile = await prisma.profile.findUnique({
        where: { id: vibe.receiver_id },
        select: { full_name: true },
      })
      await createAndEmitNotification({
        user_id: vibe.sender_id,
        actor_id: vibe.receiver_id,
        type: 'match',
        message: `It's a match! ${receiverProfile.full_name} accepted your vibe. You can now chat!`,
      })

      io.to(`user:${vibe.sender_id}`).emit('new_match', { match })

      return res.json({ vibe, match })
    }

    res.json({ vibe, match: null })
  } catch (err) {
    console.error('[VIBES] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/vibes', auth, async (req, res) => {
  try {
    const myId = req.userId

    const [sent, received] = await Promise.all([
      prisma.vibe.findMany({
        where: { sender_id: myId },
        include: {
          receiver: { select: { id: true, username: true, full_name: true, avatar_url: true, bio: true, interests: true, city: true, looking_for: true, skills: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.vibe.findMany({
        where: { receiver_id: myId, status: 'pending' },
        include: {
          sender: { select: { id: true, username: true, full_name: true, avatar_url: true, bio: true, interests: true, city: true, looking_for: true, skills: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
    ])

    res.json({ sent, received })
  } catch (err) {
    console.error('[VIBES] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── MATCHES ─────────────────────────────────────────────
app.get('/api/matches', auth, async (req, res) => {
  try {
    const myId = req.userId
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ user_a_id: myId }, { user_b_id: myId }],
      },
      include: {
        userA: { select: { id: true, username: true, full_name: true, avatar_url: true, bio: true, interests: true, city: true, looking_for: true, skills: true, last_active: true } },
        userB: { select: { id: true, username: true, full_name: true, avatar_url: true, bio: true, interests: true, city: true, looking_for: true, skills: true, last_active: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    // Return with 'other' user resolved
    const formatted = matches.map(m => {
      const other = m.userA.id === myId ? m.userB : m.userA
      const sharedInterests = other.interests || []
      return { ...m, other, shared_interests: sharedInterests }
    })

    res.json(formatted)
  } catch (err) {
    console.error('[MATCHES] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── BLOCK ───────────────────────────────────────────────
app.post('/api/block', auth, async (req, res) => {
  try {
    const { blocked_id } = req.body
    if (!blocked_id) return res.status(400).json({ error: 'blocked_id is required' })
    if (blocked_id === req.userId) return res.status(400).json({ error: 'Cannot block yourself' })

    const existing = await prisma.block.findUnique({
      where: { blocker_id_blocked_id: { blocker_id: req.userId, blocked_id } },
    })
    if (existing) return res.json({ ok: true, message: 'Already blocked' })

    await prisma.block.create({ data: { blocker_id: req.userId, blocked_id } })

    // Remove any existing match between them
    const [a, b] = [req.userId, blocked_id].sort()
    await prisma.match.deleteMany({ where: { user_a_id: a, user_b_id: b } })

    // Remove any pending vibes between them
    await prisma.vibe.deleteMany({
      where: {
        OR: [
          { sender_id: req.userId, receiver_id: blocked_id },
          { sender_id: blocked_id, receiver_id: req.userId },
        ],
      },
    })

    res.json({ ok: true })
  } catch (err) {
    console.error('[BLOCK] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/block/:blockedId', auth, async (req, res) => {
  try {
    await prisma.block.deleteMany({
      where: { blocker_id: req.userId, blocked_id: req.params.blockedId },
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('[BLOCK] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/block', auth, async (req, res) => {
  try {
    const blocks = await prisma.block.findMany({
      where: { blocker_id: req.userId },
      include: {
        blocked: { select: { id: true, username: true, full_name: true, avatar_url: true } },
      },
      orderBy: { created_at: 'desc' },
    })
    res.json(blocks)
  } catch (err) {
    console.error('[BLOCK] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── REPORT ──────────────────────────────────────────────
app.post('/api/report', auth, async (req, res) => {
  try {
    const { reported_id, reason, description } = req.body
    if (!reported_id || !reason) return res.status(400).json({ error: 'reported_id and reason are required' })
    if (reported_id === req.userId) return res.status(400).json({ error: 'Cannot report yourself' })

    const validReasons = ['spam', 'harassment', 'inappropriate', 'underage', 'other']
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: `Reason must be one of: ${validReasons.join(', ')}` })
    }

    // Check for duplicate report
    const existing = await prisma.report.findFirst({
      where: { reporter_id: req.userId, reported_id, status: 'pending' },
    })
    if (existing) return res.status(400).json({ error: 'Already reported' })

    await prisma.report.create({
      data: { reporter_id: req.userId, reported_id, reason, description: description || '' },
    })

    res.json({ ok: true, message: 'Report submitted. Our team will review it.' })
  } catch (err) {
    console.error('[REPORT] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── FOLLOW SYSTEM ─────────────────────────────────────
app.post('/api/users/:id/follow', auth, async (req, res) => {
  try {
    const targetId = req.params.id
    if (targetId === req.userId) return res.status(400).json({ error: 'Cannot follow yourself' })

    const target = await prisma.profile.findUnique({ where: { id: targetId }, select: { id: true, full_name: true } })
    if (!target) return res.status(404).json({ error: 'User not found' })

    const existing = await prisma.follow.findUnique({
      where: { follower_id_following_id: { follower_id: req.userId, following_id: targetId } },
    })

    if (!existing) {
      await prisma.follow.create({ data: { follower_id: req.userId, following_id: targetId } })
      // Notificación best-effort: un fallo aquí jamás debe convertir un follow
      // ya persistido en un 500 (el cliente no actualizaría su estado y el
      // botón quedaría desincronizado).
      try {
        await createAndEmitNotification({
          user_id: targetId,
          actor_id: req.userId,
          type: 'like',
          message: 'started following you',
        })
      } catch (notifyErr) {
        console.error('[FOLLOW] Notification failed (ignored):', notifyErr)
      }
    }

    const followersCount = await prisma.follow.count({ where: { following_id: targetId } })
    res.status(200).json({ ok: true, isFollowing: true, followersCount })
  } catch (err) {
    console.error('[FOLLOW] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/users/:id/follow', auth, async (req, res) => {
  try {
    const targetId = req.params.id
    await prisma.follow.deleteMany({ where: { follower_id: req.userId, following_id: targetId } })
    const followersCount = await prisma.follow.count({ where: { following_id: targetId } })
    res.status(200).json({ ok: true, isFollowing: false, followersCount })
  } catch (err) {
    console.error('[FOLLOW] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/users/:id/followers', async (req, res) => {
  try {
    const { limit = 20, cursor } = req.query
    const take = parseInt(limit) + 1
    const query = {
      where: { following_id: req.params.id },
      include: { follower: { select: { id: true, username: true, full_name: true, avatar_url: true, bio: true, skills: true, city: true, country: true, country_code: true } } },
      orderBy: { created_at: 'desc' },
      take,
    }
    if (cursor) { query.cursor = { id: cursor }; query.skip = 1 }
    const follows = await prisma.follow.findMany(query)
    const hasMore = follows.length > parseInt(limit)
    const items = hasMore ? follows.slice(0, parseInt(limit)) : follows
    const nextCursor = hasMore ? items[items.length - 1].id : null
    res.json({ items: items.map(f => f.follower), nextCursor, hasMore })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/users/:id/following', async (req, res) => {
  try {
    const { limit = 20, cursor } = req.query
    const take = parseInt(limit) + 1
    const query = {
      where: { follower_id: req.params.id },
      include: { following: { select: { id: true, username: true, full_name: true, avatar_url: true, bio: true, skills: true, city: true, country: true, country_code: true } } },
      orderBy: { created_at: 'desc' },
      take,
    }
    if (cursor) { query.cursor = { id: cursor }; query.skip = 1 }
    const follows = await prisma.follow.findMany(query)
    const hasMore = follows.length > parseInt(limit)
    const items = hasMore ? follows.slice(0, parseInt(limit)) : follows
    const nextCursor = hasMore ? items[items.length - 1].id : null
    res.json({ items: items.map(f => f.following), nextCursor, hasMore })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Saved (unified) ──────────────────────────────────
app.get('/api/me/saved', auth, async (req, res) => {
  try {
    const { limit = 20, cursor, type } = req.query
    const take = parseInt(limit) + 1

    // Fetch saved posts and projects in parallel
    const [savedPosts, savedProjects] = await Promise.all([
      (!type || type === 'post') ? prisma.savedPost.findMany({
        where: { user_id: req.userId },
        include: { post: { include: { author: { select: { id: true, username: true, full_name: true, avatar_url: true } } } } },
        orderBy: { created_at: 'desc' },
      }) : [],
      (!type || type === 'project') ? prisma.projectSave.findMany({
        where: { user_id: req.userId },
        include: { project: { include: { author: { select: { id: true, username: true, full_name: true, avatar_url: true } } } } },
        orderBy: { created_at: 'desc' },
      }) : [],
    ])

    // Merge and sort by saved_at desc
    const items = [
      ...savedPosts.map(s => ({ type: 'post', data: s.post, saved_at: s.created_at })),
      ...savedProjects.map(s => ({ type: 'project', data: s.project, saved_at: s.created_at })),
    ].sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime())

    // Simple pagination
    let startIdx = 0
    if (cursor) {
      const cursorIdx = items.findIndex(i => i.data.id === cursor)
      if (cursorIdx >= 0) startIdx = cursorIdx + 1
    }
    const paginated = items.slice(startIdx, startIdx + parseInt(limit))
    const hasMore = items.length > startIdx + parseInt(limit)
    const nextCursor = hasMore ? paginated[paginated.length - 1]?.data.id : null

    res.json({ items: paginated, nextCursor, hasMore })
  } catch (err) {
    console.error('[SAVED] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── Serve frontend (production) ────────────────────────
const distPath = join(__dirname, '..', 'dist')
app.use(express.static(distPath))
// Catch-all: serve index.html for all non-API routes (SPA fallback)
// IMPORTANT: Use a middleware, NOT app.get, to avoid Express 5
//            intercepting /api routes before they reach handlers.
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next()
  res.sendFile(join(distPath, 'index.html'))
})

// ─── Start ───────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CodeBuds running on http://0.0.0.0:${PORT}`)
})
