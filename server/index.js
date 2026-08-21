import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, schema: 'codebuds' })
const prisma = new PrismaClient({ adapter })
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'codebuds-jwt-secret'

app.use(cors())
app.use(express.json())

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

    const exists = await prisma.profile.findFirst({
      where: { OR: [{ email }, { username }] },
    })
    if (exists) {
      return res.status(400).json({ error: 'Email or username already taken' })
    }

    const hashed = await bcrypt.hash(password, 10)
    const profile = await prisma.profile.create({
      data: { email, password: hashed, username, full_name: fullName },
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

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, username: true, full_name: true, bio: true, avatar_url: true, github_url: true, linkedin_url: true, location: true, skills: true, open_to: true, created_at: true, updated_at: true },
    })
    if (!profile) return res.status(404).json({ error: 'User not found' })
    res.json(profile)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── PROFILES ────────────────────────────────────────────
app.get('/api/profiles', auth, async (req, res) => {
  try {
    const { search, exclude } = req.query
    const where = {}
    if (exclude) where.id = { not: exclude }
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ]
    }
    const profiles = await prisma.profile.findMany({
      where,
      select: { id: true, username: true, full_name: true, bio: true, avatar_url: true, github_url: true, linkedin_url: true, location: true, skills: true, open_to: true, created_at: true, updated_at: true },
      orderBy: { created_at: 'desc' },
    })
    res.json(profiles)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/profiles/count', auth, async (_req, res) => {
  try {
    const count = await prisma.profile.count()
    res.json({ count })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/profiles/:id', auth, async (req, res) => {
  try {
    if (req.userId !== req.params.id) return res.status(403).json({ error: 'Forbidden' })
    const { full_name, username, bio, avatar_url, github_url, linkedin_url, location, skills, open_to } = req.body
    const profile = await prisma.profile.update({
      where: { id: req.params.id },
      data: { full_name, username, bio, avatar_url, github_url, linkedin_url, location, skills, open_to, updated_at: new Date() },
      select: { id: true, email: true, username: true, full_name: true, bio: true, avatar_url: true, github_url: true, linkedin_url: true, location: true, skills: true, open_to: true, created_at: true, updated_at: true },
    })
    res.json(profile)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── POSTS ───────────────────────────────────────────────
app.get('/api/posts', auth, async (req, res) => {
  try {
    const { category, limit = 50 } = req.query
    const where = category && category !== 'all' ? { category } : {}
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
    const formatted = posts.map(p => ({
      ...p,
      like_count: p.likes.length,
      liked_by_me: p.likes.some(l => l.user_id === req.userId),
      comment_count: p._count.comments,
    }))
    res.json(formatted)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/posts/count', auth, async (_req, res) => {
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
    const post = await prisma.post.create({
      data: { author_id: req.userId, content: content.trim(), category: category || 'general' },
      include: {
        author: { select: { id: true, username: true, full_name: true, avatar_url: true } },
        likes: { select: { id: true, user_id: true } },
      },
    })
    res.json({ ...post, like_count: 0, liked_by_me: false })
  } catch (err) {
    res.status(500).json({ error: err.message })
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
app.get('/api/posts/:id/comments', auth, async (req, res) => {
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
      await prisma.notification.create({
        data: { user_id: post.author_id, actor_id: req.userId, type: 'like', message: 'commented on your post' },
      })
    }

    res.json(comment)
  } catch (err) {
    console.error('[COMMENTS] Create error:', err)
    res.status(500).json({ error: err.message || 'Failed to create comment' })
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
      await prisma.notification.create({
        data: { user_id: post.author_id, actor_id: req.userId, type: 'like', message: 'liked your post' },
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
app.get('/api/projects', auth, async (req, res) => {
  try {
    const { orderBy: order = 'created_at', limit } = req.query
    const projects = await prisma.project.findMany({
      include: {
        author: { select: { id: true, username: true, full_name: true, avatar_url: true } },
      },
      orderBy: order === 'stars' ? { stars: 'desc' } : { created_at: 'desc' },
      take: limit ? parseInt(limit) : undefined,
    })
    res.json(projects)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/projects/count', auth, async (_req, res) => {
  try {
    const count = await prisma.project.count()
    res.json({ count })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/projects', auth, async (req, res) => {
  try {
    const { title, description, tech_stack, repo_url, live_url, image_url } = req.body
    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'Title and description are required' })
    }
    const project = await prisma.project.create({
      data: {
        author_id: req.userId,
        title: title.trim(),
        description: description.trim(),
        tech_stack: tech_stack || [],
        repo_url: repo_url || null,
        live_url: live_url || null,
        image_url: image_url || null,
      },
      include: {
        author: { select: { id: true, username: true, full_name: true, avatar_url: true } },
      },
    })
    res.json(project)
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
    await prisma.notification.create({
      data: { user_id: addressee_id, actor_id: req.userId, type: 'buddy_request', message: 'sent you a buddy request' },
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
      await prisma.notification.create({
        data: { user_id: buddy.requester_id, actor_id: req.userId, type: 'buddy_accepted', message: 'accepted your buddy request' },
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
    await prisma.notification.create({
      data: { user_id: mentor_id, actor_id: req.userId, type: 'mentorship_request', message: `requested mentorship on ${topic}` },
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
      await prisma.notification.create({
        data: { user_id: m.mentee_id, actor_id: req.userId, type: 'mentorship_accepted', message: 'accepted your mentorship request' },
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

// ─── Serve frontend (production) ────────────────────────
const distPath = join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(join(distPath, 'index.html'))
})

// ─── Start ───────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CodeBuds running on http://0.0.0.0:${PORT}`)
})
