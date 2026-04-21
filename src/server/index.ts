import {
  context,
  createServer,
  getServerPort,
  reddit
} from '@devvit/web/server'
import { serve } from '@hono/node-server'
import type { Context } from 'hono'
import { Hono } from 'hono'

import { createPost } from './post'
import {
  commentScore,
  createWeeklyRoundup,
  ensureScoreThread,
  getBootstrapState,
  getConfiguredFeaturedDifficulty,
  getLeaderboardState,
  getPreviewState,
  getRaceRecord,
  recordCompletion,
  shouldRunDailyPost,
  shouldRunWeeklyRoundup,
} from './lib/community-game'
import { requirePostId, requireSubredditName, requireUserId } from './lib/context-guards'
import { DIFFICULTIES } from './lib/sudoku'
import type { Difficulty } from '../shared/community'
import type { CompletionSubmission } from '../shared/community'

const HTTP_STATUS_BAD_REQUEST = 400
const HTTP_STATUS_FORBIDDEN = 403
const HTTP_STATUS_INTERNAL_ERROR = 500

type ValidDifficulty = (typeof DIFFICULTIES)[number]
type ApiSuccess<T> = { status: 'success'; data: T }
type ApiError = { status: 'error'; message: string }

const isValidDifficulty = (d: unknown): d is ValidDifficulty =>
  typeof d === 'string' && (DIFFICULTIES as readonly string[]).includes(d)

export const app = new Hono()

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error'

const success = <T>(c: Context, data: T): Response =>
  c.json<ApiSuccess<T>>({ status: 'success', data })

const failure = (
  c: Context,
  message: string,
  status: 400 | 403 | 500 = HTTP_STATUS_BAD_REQUEST,
): Response =>
  c.json<ApiError>({ status: 'error', message }, status)

const parseTaskNow = (raw: unknown): Date => {
  if (!raw || typeof raw !== 'object') return new Date()
  const data = (raw as { data?: { nowIso?: string } }).data
  return data?.nowIso ? new Date(data.nowIso) : new Date()
}

const parseCompletionSubmission = (raw: unknown): CompletionSubmission | null => {
  if (!raw || typeof raw !== 'object') return null
  const body = raw as Record<string, unknown>
  const {
    board,
    difficulty,
    elapsedSeconds,
    hintsUsed,
    validationFailures,
    mode,
    completedAtIso,
  } = body

  if (typeof board !== 'string' || !/^[0-9]{81}$/.test(board)) return null
  if (!isValidDifficulty(difficulty)) return null
  if (typeof elapsedSeconds !== 'number' || elapsedSeconds < 0) return null
  if (typeof hintsUsed !== 'number' || hintsUsed < 0) return null
  if (typeof validationFailures !== 'number' || validationFailures < 0) return null
  if (mode !== 'featured' && mode !== 'practice') return null
  if (completedAtIso !== undefined && typeof completedAtIso !== 'string') return null

  return {
    board,
    difficulty,
    elapsedSeconds,
    hintsUsed,
    validationFailures,
    mode,
    ...(completedAtIso === undefined ? {} : { completedAtIso }),
  }
}

type CommentScoreRequest = {
  difficulty: Difficulty
  mode: 'featured' | 'practice'
  elapsedSeconds: number
  adjustedTime: number
  hintsUsed: number
  validationFailures: number
  rank?: number
  note?: string
}

const parseCommentScoreRequest = (raw: unknown): CommentScoreRequest | null => {
  if (!raw || typeof raw !== 'object') return null
  const body = raw as Record<string, unknown>
  const {
    difficulty,
    mode,
    elapsedSeconds,
    adjustedTime,
    hintsUsed,
    validationFailures,
    rank,
    note,
  } = body

  if (!isValidDifficulty(difficulty)) return null
  if (mode !== 'featured' && mode !== 'practice') return null
  if (typeof elapsedSeconds !== 'number' || elapsedSeconds < 0) return null
  if (typeof adjustedTime !== 'number' || adjustedTime < 0) return null
  if (typeof hintsUsed !== 'number' || hintsUsed < 0) return null
  if (typeof validationFailures !== 'number' || validationFailures < 0) return null
  if (rank !== undefined && (typeof rank !== 'number' || rank < 1)) return null
  if (note !== undefined && typeof note !== 'string') return null

  return {
    difficulty,
    mode,
    elapsedSeconds,
    adjustedTime,
    hintsUsed,
    validationFailures,
    ...(rank === undefined ? {} : { rank }),
    ...(note === undefined ? {} : { note }),
  }
}

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
app.post('/internal/on-post-create', async (c) => {
  try {
    const input = await c.req.json<{ post?: { id?: string } }>()
    const postId = input.post?.id
    if (!postId) return c.json({ status: 'ok' })

    await getRaceRecord(postId).catch(() => null)
    const exists = await getRaceRecord(postId).then(() => true).catch(() => false)
    if (!exists) return c.json({ status: 'ok' })

    await ensureScoreThread(postId)
    return c.json({ status: 'ok' })
  } catch {
    return c.json({ status: 'ok' })
  }
})

// --- GET /api/puzzle ---

app.get('/api/puzzle', async (c) => {
  try {
    const race = await getRaceRecord(requirePostId())
    return success(c, {
      puzzles: race.puzzles,
      solutions: race.solutions,
    })
  } catch (error) {
    return failure(c, getErrorMessage(error))
  }
})

app.get('/api/bootstrap', async (c) => {
  try {
    const postId = requirePostId()
    const subredditName = requireSubredditName()
    const data = await getBootstrapState(postId, subredditName, context.userId)
    return success(c, data)
  } catch (error) {
    return failure(c, getErrorMessage(error))
  }
})

app.get('/api/preview-state', async (c) => {
  try {
    const data = await getPreviewState(requirePostId(), context.userId)
    return success(c, data)
  } catch (error) {
    return failure(c, getErrorMessage(error))
  }
})

app.get('/api/leaderboard', async (c) => {
  try {
    const { entries, currentUserRank, recentCompletions } = await getLeaderboardState(
      requirePostId(),
      context.userId
    )
    return success(c, { entries, currentUserRank, recentCompletions })
  } catch (error) {
    return failure(c, getErrorMessage(error))
  }
})

// --- POST /api/validate ---

app.post('/api/validate', async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return failure(c, 'Invalid JSON')
  const { board, difficulty } = body
  if (typeof board !== 'string' || typeof difficulty !== 'string') {
    return failure(c, 'Missing board or difficulty')
  }
  if (!isValidDifficulty(difficulty)) return failure(c, 'Invalid difficulty')
  if (board.length !== 81 || !/^[0-9]{81}$/.test(board)) return failure(c, 'Invalid board')

  try {
    const race = await getRaceRecord(requirePostId())
    return c.json({ valid: board === race.solutions[difficulty] })
  } catch (error) {
    return failure(c, getErrorMessage(error))
  }
})

app.post('/api/complete', async (c) => {
  const body = await c.req.json().catch(() => null)
  const submission = parseCompletionSubmission(body)
  if (submission === null) return failure(c, 'Invalid completion payload')

  try {
    const userId = requireUserId()
    const postId = requirePostId()
    const subredditName = requireSubredditName()
    const username = await reddit.getCurrentUsername()
    if (!username) return failure(c, 'User must be logged in', HTTP_STATUS_FORBIDDEN)

    const outcome = await recordCompletion({
      postId,
      subredditName,
      userId,
      username,
      submission,
    })

    if (!outcome.valid) {
      return success(c, { valid: false })
    }

    return success(c, { valid: true, completion: outcome.completion })
  } catch (error) {
    return failure(c, getErrorMessage(error), HTTP_STATUS_INTERNAL_ERROR)
  }
})

app.post('/api/comment-score', async (c) => {
  const body = await c.req.json().catch(() => null)
  const payload = parseCommentScoreRequest(body)
  if (payload === null) return failure(c, 'Invalid score comment payload')

  try {
    const postId = requirePostId()
    const username = await reddit.getCurrentUsername()
    if (!username) return failure(c, 'User must be logged in', HTTP_STATUS_FORBIDDEN)

    const result = await commentScore({
      postId,
      difficulty: payload.difficulty,
      mode: payload.mode,
      elapsedSeconds: payload.elapsedSeconds,
      adjustedTime: payload.adjustedTime,
      hintsUsed: payload.hintsUsed,
      validationFailures: payload.validationFailures,
      rank: payload.rank ?? null,
      ...(payload.note === undefined ? {} : { note: payload.note }),
    })

    return success(c, result)
  } catch (error) {
    return failure(c, getErrorMessage(error), HTTP_STATUS_INTERNAL_ERROR)
  }
})

app.post('/api/subscribe', async (c) => {
  try {
    await reddit.subscribeToCurrentSubreddit()
    return success(c, { subscribed: true })
  } catch (error) {
    return failure(c, getErrorMessage(error), HTTP_STATUS_INTERNAL_ERROR)
  }
})

// --- Scheduler: daily post ---

app.post('/internal/cron/daily-post', async (c) => {
  try {
    const now = parseTaskNow(await c.req.json().catch(() => null))
    const subredditName = requireSubredditName()
    if (!(await shouldRunDailyPost(subredditName, now))) {
      return c.json({ status: 'ok' }, 200)
    }

    await createPost({
      now,
      featuredDifficulty: await getConfiguredFeaturedDifficulty(),
    })
    return c.json({ status: 'ok' }, 200)
  } catch (error) {
    console.error('Failed to create daily post:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create daily post'
    return c.json({ status: 'error', message: errorMessage }, HTTP_STATUS_INTERNAL_ERROR)
  }
})

app.post('/internal/cron/weekly-roundup', async (c) => {
  try {
    const now = parseTaskNow(await c.req.json().catch(() => null))
    const subredditName = requireSubredditName()
    if (!(await shouldRunWeeklyRoundup(subredditName, now))) {
      return c.json({ status: 'ok' }, 200)
    }

    await createWeeklyRoundup(subredditName)
    return c.json({ status: 'ok' }, 200)
  } catch (error) {
    return c.json({ status: 'error', message: getErrorMessage(error) }, HTTP_STATUS_INTERNAL_ERROR)
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
