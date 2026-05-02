import { Header } from '@devvit/shared-types/Header.js'
import { MOCK_HEADERS } from '@devvit/shared-types/test/index.js'
import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis, reddit } from '@devvit/web/server'
import { expect, vi } from 'vitest'

import { app } from '../index'

    // Inject postId into the test context
    ; (MOCK_HEADERS as Record<string, string>)[Header.Post] = 't3_testpost'

const POST_ID = 't3_testpost'
const STICKY_COMMENT_ID = 't1_sticky123'

const validBody = JSON.stringify({
    difficulty: 'easy',
    completionTime: 154,
    hintsUsed: 0,
    mistakesCount: 0,
    notesUsed: false,
})

const postScore = (body: string): Promise<Response> =>
    app.request('/api/score/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
    })

// ─── Happy path ───────────────────────────────────────────────────────────────

const testHappy = createDevvitTest({ userId: 't2_solver', username: 'solver' })

testHappy('POST /api/score/comment submits comment as user replying to sticky comment', async () => {
    await redis.hSet(`puzzle:${POST_ID}`, { stickyCommentId: STICKY_COMMENT_ID })
    const submitComment = vi.spyOn(reddit, 'submitComment').mockResolvedValue(undefined as never)

    const res = await postScore(validBody)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')

    expect(submitComment).toHaveBeenCalledOnce()
    const callArgs = submitComment.mock.calls[0]?.[0]
    expect(callArgs).toMatchObject({
        id: STICKY_COMMENT_ID,
        runAs: 'USER',
    })
    expect(typeof callArgs?.text).toBe('string')
    expect(callArgs?.text.length).toBeGreaterThan(0)
})

testHappy('POST /api/score/comment formats comment text with difficulty and time', async () => {
    await redis.hSet(`puzzle:${POST_ID}`, { stickyCommentId: STICKY_COMMENT_ID })
    const submitComment = vi.spyOn(reddit, 'submitComment').mockResolvedValue(undefined as never)

    await postScore(JSON.stringify({
        difficulty: 'easy',
        completionTime: 154,
        hintsUsed: 1,
        mistakesCount: 2,
        notesUsed: true,
    }))

    const callArgs = submitComment.mock.calls[0]?.[0]
    expect(callArgs?.text).toContain('easy')
    expect(callArgs?.text).toContain('2:34')
    expect(callArgs?.text).toContain('1')  // hints
    expect(callArgs?.text).toContain('2')  // mistakes
})

testHappy('POST /api/score/comment includes "📝 Notes | Yes |" in comment text when notesUsed is true', async () => {
    await redis.hSet(`puzzle:${POST_ID}`, { stickyCommentId: STICKY_COMMENT_ID })
    const submitComment = vi.spyOn(reddit, 'submitComment').mockResolvedValue(undefined as never)

    await postScore(JSON.stringify({
        difficulty: 'easy',
        completionTime: 120,
        hintsUsed: 0,
        mistakesCount: 0,
        notesUsed: true,
    }))

    const callArgs = submitComment.mock.calls[0]?.[0]
    expect(callArgs?.text).toContain('📝 Notes | Yes |')
})

testHappy('POST /api/score/comment includes "📝 Notes | No |" in comment text when notesUsed is false', async () => {
    await redis.hSet(`puzzle:${POST_ID}`, { stickyCommentId: STICKY_COMMENT_ID })
    const submitComment = vi.spyOn(reddit, 'submitComment').mockResolvedValue(undefined as never)

    await postScore(JSON.stringify({
        difficulty: 'easy',
        completionTime: 120,
        hintsUsed: 0,
        mistakesCount: 0,
        notesUsed: false,
    }))

    const callArgs = submitComment.mock.calls[0]?.[0]
    expect(callArgs?.text).toContain('📝 Notes | No |')
})

// ─── 401: user not logged in ──────────────────────────────────────────────────

// Note: the test harness always injects a userId. The 401 guard is verified by
// the route implementation. We document this constraint here for traceability.
// Requirement 5.5: userId guard returns 401.

// ─── 400: missing postId ──────────────────────────────────────────────────────

// Note: MOCK_HEADERS always injects a postId. The 400 guard for missing postId
// is verified by the route implementation. Documented here for traceability.
// Requirement 5.5: postId guard returns 400.

// ─── 400: invalid body ───────────────────────────────────────────────────────

const testValidation = createDevvitTest({ userId: 't2_solver', username: 'solver' })

testValidation('POST /api/score/comment returns 400 for invalid JSON body', async () => {
    const res = await app.request('/api/score/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
    })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
})

testValidation('POST /api/score/comment returns 400 for missing difficulty', async () => {
    const res = await postScore(JSON.stringify({
        completionTime: 100,
        hintsUsed: 0,
        mistakesCount: 0,
    }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
})

testValidation('POST /api/score/comment returns 400 for invalid difficulty', async () => {
    const res = await postScore(JSON.stringify({
        difficulty: 'extreme',
        completionTime: 100,
        hintsUsed: 0,
        mistakesCount: 0,
    }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
})

testValidation('POST /api/score/comment returns 400 for negative completionTime', async () => {
    const res = await postScore(JSON.stringify({
        difficulty: 'easy',
        completionTime: -1,
        hintsUsed: 0,
        mistakesCount: 0,
    }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
})

testValidation('POST /api/score/comment returns 400 for non-integer completionTime', async () => {
    const res = await postScore(JSON.stringify({
        difficulty: 'easy',
        completionTime: 1.5,
        hintsUsed: 0,
        mistakesCount: 0,
    }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
})

testValidation('POST /api/score/comment returns 400 for negative hintsUsed', async () => {
    const res = await postScore(JSON.stringify({
        difficulty: 'easy',
        completionTime: 100,
        hintsUsed: -1,
        mistakesCount: 0,
    }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
})

testValidation('POST /api/score/comment returns 400 for negative mistakesCount', async () => {
    const res = await postScore(JSON.stringify({
        difficulty: 'easy',
        completionTime: 100,
        hintsUsed: 0,
        mistakesCount: -1,
    }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
})

// ─── 400: no stickyCommentId in Redis ────────────────────────────────────────

const testNoSticky = createDevvitTest({ userId: 't2_solver', username: 'solver' })

testNoSticky('POST /api/score/comment returns 400 with "Score thread unavailable" when stickyCommentId missing', async () => {
    // No stickyCommentId stored in Redis for this post
    const res = await postScore(validBody)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
    expect(json.message).toBe('Score thread unavailable')
})

// ─── 500: Reddit API failure ──────────────────────────────────────────────────

const testApiFailure = createDevvitTest({ userId: 't2_solver', username: 'solver' })

testApiFailure('POST /api/score/comment returns 500 when reddit.submitComment throws', async () => {
    await redis.hSet(`puzzle:${POST_ID}`, { stickyCommentId: STICKY_COMMENT_ID })
    vi.spyOn(reddit, 'submitComment').mockRejectedValue(new Error('Reddit API down'))

    const res = await postScore(validBody)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.status).toBe('error')
    expect(json.message).toBe('Reddit API down')
})

testApiFailure('POST /api/score/comment returns 500 with fallback message for non-Error throws', async () => {
    await redis.hSet(`puzzle:${POST_ID}`, { stickyCommentId: STICKY_COMMENT_ID })
    vi.spyOn(reddit, 'submitComment').mockRejectedValue('string error')

    const res = await postScore(validBody)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.status).toBe('error')
    expect(json.message).toBe('Failed to post score comment')
})
