import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const TARGET_USERNAMES = ['jahseh17', 'xnzz']

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, schema: 'codebuds' })
const prisma = new PrismaClient({ adapter })

async function main() {
  const targetProfiles = await prisma.profile.findMany({
    where: { username: { in: TARGET_USERNAMES } },
    select: { id: true, username: true },
  })

  if (targetProfiles.length !== TARGET_USERNAMES.length) {
    const missing = TARGET_USERNAMES.filter(name => !targetProfiles.some(p => p.username === name))
    throw new Error(`Missing target users in DB: ${missing.join(', ')}`)
  }

  const botProfiles = await prisma.profile.findMany({
    where: { username: { notIn: TARGET_USERNAMES } },
    select: { id: true, username: true },
    orderBy: { created_at: 'asc' },
  })

  console.log(`TARGETS: ${targetProfiles.map(p => p.username).join(', ')}`)
  console.log(`BOT_COUNT=${botProfiles.length}`)

  let createdFollows = 0
  let existingFollows = 0

  for (const target of targetProfiles) {
    for (const bot of botProfiles) {
      const existing = await prisma.follow.findUnique({
        where: {
          follower_id_following_id: {
            follower_id: bot.id,
            following_id: target.id,
          },
        },
      })

      if (existing) {
        existingFollows += 1
        continue
      }

      await prisma.follow.create({
        data: {
          follower_id: bot.id,
          following_id: target.id,
        },
      })
      createdFollows += 1
    }
  }

  const targetPostIds = await prisma.post.findMany({
    where: {
      author_id: { in: targetProfiles.map(p => p.id) },
    },
    select: { id: true, author_id: true },
  })

  const targetCommentAuthors = await prisma.comment.findMany({
    where: { user_id: { in: targetProfiles.map(p => p.id) } },
    select: { id: true, user_id: true, post_id: true },
  })

  console.log(`TARGET_POSTS=${targetPostIds.length}`)
  console.log(`TARGET_COMMENTS=${targetCommentAuthors.length}`)

  let createdLikes = 0
  let existingLikes = 0

  for (const bot of botProfiles) {
    for (const post of targetPostIds) {
      const alreadyLiked = await prisma.like.findUnique({
        where: {
          post_id_user_id: {
            post_id: post.id,
            user_id: bot.id,
          },
        },
      })

      if (alreadyLiked) {
        existingLikes += 1
        continue
      }

      await prisma.like.create({
        data: {
          post_id: post.id,
          user_id: bot.id,
        },
      })
      createdLikes += 1
    }
  }

  const followerCounts = await Promise.all(
    targetProfiles.map(async (profile) => ({
      username: profile.username,
      followers_count: await prisma.follow.count({ where: { following_id: profile.id } }),
      following_count: await prisma.follow.count({ where: { follower_id: profile.id } }),
    }))
  )

  const likeCounts = await Promise.all(
    targetProfiles.map(async (profile) => ({
      username: profile.username,
      likes_on_own_posts: await prisma.like.count({
        where: {
          post: {
            author_id: profile.id,
          },
        },
      }),
    }))
  )

  console.log('RESULT')
  console.log(JSON.stringify({
    createdFollows,
    existingFollows,
    createdLikes,
    existingLikes,
    followerCounts,
    likeCounts,
  }, null, 2))
}

try {
  await main()
} catch (error) {
  console.error('SCRIPT_ERROR')
  console.error(error)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
