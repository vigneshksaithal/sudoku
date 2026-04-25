import {
  cache,
  context,
  createServer,
  getServerPort,
  redis,
  reddit,
} from '@devvit/web/server'
import { serve } from '@hono/node-server'
import type { T1 } from '@devvit/shared-types/tid.js'
import type { Context } from 'hono'
import { Hono } from 'hono'

import { createPost } from './post'
import { formatPostDate } from './post'
import { DIFFICULTIES } from './lib/sudoku'
import { getLeaderboard, recordSolve, validateSolveInput } from './lib/leaderboard'
import { validatePuzzle } from './lib/puzzle-validator'
import { checkCooldown, setCooldown, addToSubmissionHistory, getSubmissionHistory, incrementSolveCount } from './lib/community-submit'
import { createStickyComment } from './lib/sticky-comment'
import { formatScoreComment } from './lib/score-comment'

const HTTP_STATUS_BAD_REQUEST = 400
const HTTP_STATUS_UNAUTHORIZED = 401
const HTTP_STATUS_INTERNAL_ERROR = 500

type ValidDifficulty = (typeof DIFFICULTIES)[number]

const isValidDifficulty = (d: unknown): d is ValidDifficulty =>
  typeof d === 'string' && (DIFFICULTIES as readonly string[]).includes(d)

export const app = new Hono()

// --- Post creation ---

const createPostHandler = async (c: Context): Promise<Response> => {
  try {
    const post = await createPost()
    return c.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`
    })
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : 'Failed to create post'
    return c.json(
      { status: 'error', message: errorMessage },
      HTTP_STATUS_BAD_REQUEST
    )
  }
}

app.post('/internal/on-app-install', createPostHandler)
app.post('/internal/menu/post-create', createPostHandler)

// --- GET /api/puzzle ---

const buildCommunityPuzzleResponse = (data: Record<string, string>): Record<string, unknown> => {
  const difficulty = data['difficulty'] ?? ''
  const puzzleString = data[`${difficulty}:puzzle`] ?? ''
  const solutionString = data[`${difficulty}:solution`] ?? ''
  const solveCount = parseInt(data['solveCount'] ?? '0', 10)
  const createdAt = parseInt(data['createdAt'] ?? '0', 10)
  return {
    type: 'community',
    creatorUsername: data['creatorUsername'] ?? '',
    puzzles: { [difficulty]: puzzleString },
    solutions: { [difficulty]: solutionString },
    solveCount: Number.isNaN(solveCount) ? 0 : solveCount,
    createdAt: Number.isNaN(createdAt) ? 0 : createdAt,
  }
}

const buildGeneratedPuzzleResponse = (data: Record<string, string>): Record<string, unknown> | null => {
  const puzzles: Record<string, string> = {}
  const solutions: Record<string, string> = {}
  for (const d of DIFFICULTIES) {
    const puzzle = data[`${d}:puzzle`]
    if (!puzzle) return null
    puzzles[d] = puzzle
    const solution = data[`${d}:solution`]
    if (solution) {
      solutions[d] = solution
    }
  }
  const createdAt = parseInt(data['createdAt'] ?? '0', 10)
  return { type: 'generated', puzzles, solutions, createdAt: Number.isNaN(createdAt) ? 0 : createdAt }
}

app.get('/api/puzzle', async (c) => {
  const postId = context.postId
  if (!postId) {
    return c.json({ status: 'error', message: 'Missing postId' }, HTTP_STATUS_BAD_REQUEST)
  }

  const data = await redis.hGetAll(`puzzle:${postId}`)

  if (data['type'] === 'community') {
    return c.json({ status: 'success', data: buildCommunityPuzzleResponse(data) })
  }

  const generated = buildGeneratedPuzzleResponse(data)
  if (!generated) {
    return c.json({ status: 'error', message: 'Puzzle not found' }, HTTP_STATUS_BAD_REQUEST)
  }

  return c.json({ status: 'success', data: generated })
})

// --- POST /api/validate ---

app.post('/api/validate', async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) {
    return c.json({ status: 'error', message: 'Invalid JSON' }, HTTP_STATUS_BAD_REQUEST)
  }

  const { board, difficulty } = body
  if (typeof board !== 'string' || typeof difficulty !== 'string') {
    return c.json({ status: 'error', message: 'Missing board or difficulty' }, HTTP_STATUS_BAD_REQUEST)
  }

  if (!isValidDifficulty(difficulty)) {
    return c.json({ status: 'error', message: 'Invalid difficulty' }, HTTP_STATUS_BAD_REQUEST)
  }

  if (board.length !== 81 || !/^[0-9]{81}$/.test(board)) {
    return c.json({ status: 'error', message: 'Invalid board' }, HTTP_STATUS_BAD_REQUEST)
  }

  const postId = context.postId
  if (!postId) {
    return c.json({ status: 'error', message: 'Missing postId' }, HTTP_STATUS_BAD_REQUEST)
  }

  const solution = await redis.hGet(`puzzle:${postId}`, `${difficulty}:solution`)
  if (!solution) {
    return c.json({ status: 'error', message: 'Solution not found' }, HTTP_STATUS_BAD_REQUEST)
  }

  return c.json({ valid: board === solution })
})

// --- POST /api/community/validate ---

app.post('/api/community/validate', async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) {
    return c.json({ status: 'error', message: 'Invalid JSON' }, HTTP_STATUS_BAD_REQUEST)
  }

  const { puzzle } = body
  if (typeof puzzle !== 'string') {
    return c.json({ status: 'error', message: 'Missing puzzle' }, HTTP_STATUS_BAD_REQUEST)
  }

  const result = validatePuzzle(puzzle)
  if (!result.valid) {
    return c.json({ status: 'error', message: result.error })
  }

  return c.json({
    status: 'success',
    data: {
      difficulty: result.difficulty,
      clueCount: result.clueCount,
      preview: puzzle,
    },
  })
})

// --- POST /api/community/submit ---

app.post('/api/community/submit', async (c) => {
  const userId = context.userId
  if (!userId) {
    return c.json({ status: 'error', message: 'User must be logged in' }, HTTP_STATUS_UNAUTHORIZED)
  }

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) {
    return c.json({ status: 'error', message: 'Invalid JSON' }, HTTP_STATUS_BAD_REQUEST)
  }

  const { puzzle } = body
  if (typeof puzzle !== 'string') {
    return c.json({ status: 'error', message: 'Missing puzzle' }, HTTP_STATUS_BAD_REQUEST)
  }

  const cooldown = await checkCooldown(redis, userId)
  if (!cooldown.allowed) {
    return c.json(
      { status: 'error', message: `Please wait ${cooldown.remainingSeconds} seconds before submitting again` },
      HTTP_STATUS_BAD_REQUEST
    )
  }

  const validation = validatePuzzle(puzzle)
  if (!validation.valid) {
    return c.json({ status: 'error', message: validation.error }, HTTP_STATUS_BAD_REQUEST)
  }

  const { difficulty, solution } = validation

  const username = await reddit.getCurrentUsername()
  if (!username) {
    return c.json({ status: 'error', message: 'Failed to get username' }, HTTP_STATUS_BAD_REQUEST)
  }

  const post = await reddit.submitCustomPost({
    subredditName: context.subredditName!,
    title: `Sudoku #${formatPostDate(new Date())} by u/${username} (${difficulty})`,
    entry: 'default',
    runAs: 'USER',
    userGeneratedContent: { text: puzzle },
  })

  const postId = post.id
  const createdAt = Date.now()
  const solutionString = solution.join('')

  await redis.hSet(`puzzle:${postId}`, {
    type: 'community',
    creatorId: userId,
    creatorUsername: username,
    difficulty,
    [`${difficulty}:puzzle`]: puzzle,
    [`${difficulty}:solution`]: solutionString,
    createdAt: String(createdAt),
    solveCount: '0',
  })

  await setCooldown(redis, userId)
  await addToSubmissionHistory(redis, userId, postId, createdAt)

  await createStickyComment(
    { reddit, redis },
    postId,
    '🏆 **Score Thread** — Share your solve time! Use the "Comment My Score" button after completing the puzzle.'
  )

  await reddit.submitComment({
    id: postId,
    text: `🧩 Community puzzle submitted by u/${username}! Difficulty: ${difficulty}. Think you can solve it?`,
  })

  const postUrl = `https://reddit.com/r/${context.subredditName}/comments/${postId}`
  return c.json({ status: 'success', data: { postUrl } })
})

// --- GET /api/community/my-puzzles ---

app.get('/api/community/my-puzzles', async (c) => {
  const userId = context.userId
  if (!userId) {
    return c.json({ status: 'error', message: 'User must be logged in' }, HTTP_STATUS_UNAUTHORIZED)
  }

  try {
    const puzzles = await getSubmissionHistory(redis, userId)
    return c.json({ status: 'success', data: { puzzles } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ status: 'error', message }, HTTP_STATUS_INTERNAL_ERROR)
  }
})

// --- POST /api/solve ---

app.post('/api/solve', async (c) => {
  const userId = context.userId
  if (!userId) {
    return c.json({ status: 'error', message: 'User must be logged in' }, HTTP_STATUS_BAD_REQUEST)
  }

  const postId = context.postId
  if (!postId) {
    return c.json({ status: 'error', message: 'Missing postId' }, HTTP_STATUS_BAD_REQUEST)
  }

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  const parsed = validateSolveInput(body)
  if (typeof parsed === 'string') {
    return c.json({ status: 'error', message: parsed }, HTTP_STATUS_BAD_REQUEST)
  }

  const { difficulty, completionTime, hintsUsed, mistakesCount } = parsed

  const solution = await redis.hGet(`puzzle:${postId}`, `${difficulty}:solution`)
  if (!solution) {
    return c.json({ status: 'error', message: 'Solution not found' }, HTTP_STATUS_BAD_REQUEST)
  }

  const username = await reddit.getCurrentUsername()
  if (!username) {
    return c.json({ status: 'error', message: 'Failed to get username' }, HTTP_STATUS_BAD_REQUEST)
  }

  const result = await recordSolve({ redis, postId, userId, username, difficulty, completionTime, hintsUsed, mistakesCount })
  if (typeof result === 'string') {
    return c.json({ status: 'error', message: result }, HTTP_STATUS_BAD_REQUEST)
  }

  const puzzleType = await redis.hGet(`puzzle:${postId}`, 'type')
  if (puzzleType === 'community') {
    await incrementSolveCount(redis, postId)
  }

  return c.json({ status: 'success', data: result })
})

// --- GET /api/leaderboard/post ---

app.get('/api/leaderboard/post', async (c) => {
  const difficulty = c.req.query('difficulty')
  if (!isValidDifficulty(difficulty)) {
    return c.json({ status: 'error', message: 'Invalid difficulty' }, HTTP_STATUS_BAD_REQUEST)
  }

  const postId = context.postId
  if (!postId) {
    return c.json({ status: 'error', message: 'Missing postId' }, HTTP_STATUS_BAD_REQUEST)
  }

  const userId = context.userId
  const data = await cache(
    async () => {
      const result = await getLeaderboard({
        redis,
        key: `leaderboard:${postId}:${difficulty}`,
        solveKeyPrefix: `solve:${postId}:${difficulty}`,
        ...(userId !== undefined ? { userId } : {}),
      })
      return JSON.stringify(result)
    },
    { key: `leaderboard:post:${postId}:${difficulty}`, ttl: 10 }
  )

  return c.json({ status: 'success', data: JSON.parse(data) })
})

// --- GET /api/leaderboard/global ---

app.get('/api/leaderboard/global', async (c) => {
  const difficulty = c.req.query('difficulty')
  if (!isValidDifficulty(difficulty)) {
    return c.json({ status: 'error', message: 'Invalid difficulty' }, HTTP_STATUS_BAD_REQUEST)
  }

  const userId = context.userId
  const data = await cache(
    async () => {
      const result = await getLeaderboard({
        redis,
        key: `leaderboard:global:${difficulty}`,
        solveKeyPrefix: `solve:global:${difficulty}`,
        ...(userId !== undefined ? { userId } : {}),
      })
      return JSON.stringify(result)
    },
    { key: `leaderboard:global:${difficulty}`, ttl: 10 }
  )

  return c.json({ status: 'success', data: JSON.parse(data) })
})

// --- POST /api/score/comment ---

app.post('/api/score/comment', async (c) => {
  const userId = context.userId
  if (!userId) {
    return c.json({ status: 'error', message: 'User must be logged in' }, HTTP_STATUS_UNAUTHORIZED)
  }

  const postId = context.postId
  if (!postId) {
    return c.json({ status: 'error', message: 'Missing postId' }, HTTP_STATUS_BAD_REQUEST)
  }

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  const parsed = validateSolveInput(body)
  if (typeof parsed === 'string') {
    return c.json({ status: 'error', message: parsed }, HTTP_STATUS_BAD_REQUEST)
  }

  const stickyCommentId = await redis.hGet(`puzzle:${postId}`, 'stickyCommentId')
  if (!stickyCommentId) {
    return c.json({ status: 'error', message: 'Score thread unavailable' }, HTTP_STATUS_BAD_REQUEST)
  }

  const text = formatScoreComment(parsed)

  try {
    await reddit.submitComment({ id: stickyCommentId as T1, text, runAs: 'USER' })
    return c.json({ status: 'success', data: {} })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to post score comment'
    return c.json({ status: 'error', message }, HTTP_STATUS_INTERNAL_ERROR)
  }
})

// --- Scheduler: daily post ---

app.post('/internal/scheduler/daily-post', async (c) => {
  try {
    await createPost()
    return c.json({ status: 'ok' }, 200)
  } catch (error) {
    console.error('Failed to create daily post:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create daily post'
    return c.json({ status: 'error', message: errorMessage }, HTTP_STATUS_INTERNAL_ERROR)
  }
})

// --- GET /api/ping ---

const pingHandler = (c: Context): Response => {
  return c.json({ status: 'success', data: { message: 'pong' } })
}

app.get('/api/ping', pingHandler)

// Only start the server when not in test mode
if (process.env['NODE_ENV'] !== 'test') {
  serve({ fetch: app.fetch, port: getServerPort(), createServer })
}
