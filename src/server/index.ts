import {
  context,
  createServer,
  getServerPort,
  redis
} from '@devvit/web/server'
import { serve } from '@hono/node-server'
import type { Context } from 'hono'
import { Hono } from 'hono'

import { createPost } from './post'

const HTTP_STATUS_BAD_REQUEST = 400
const VALID_DIFFICULTIES = ['simple', 'easy', 'intermediate', 'expert'] as const

type ValidDifficulty = (typeof VALID_DIFFICULTIES)[number]

const isValidDifficulty = (d: unknown): d is ValidDifficulty =>
  typeof d === 'string' && (VALID_DIFFICULTIES as readonly string[]).includes(d)

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

app.get('/api/puzzle', async (c) => {
  const postId = context.postId
  if (!postId) {
    return c.json({ status: 'error', message: 'Missing postId' }, HTTP_STATUS_BAD_REQUEST)
  }

  const data = await redis.hGetAll(`puzzle:${postId}`)
  const puzzles: Record<string, string> = {}
  for (const d of VALID_DIFFICULTIES) {
    const puzzle = data[`${d}:puzzle`]
    if (!puzzle) {
      return c.json({ status: 'error', message: 'Puzzle not found' }, HTTP_STATUS_BAD_REQUEST)
    }
    puzzles[d] = puzzle
  }

  return c.json({ status: 'success', data: puzzles })
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

// Only start the server when not in test mode
if (process.env['NODE_ENV'] !== 'test') {
  serve({ fetch: app.fetch, port: getServerPort(), createServer })
}
