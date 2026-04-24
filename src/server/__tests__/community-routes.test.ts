import { Header } from '@devvit/shared-types/Header.js'
import { MOCK_HEADERS } from '@devvit/shared-types/test/index.js'
import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis, reddit } from '@devvit/web/server'
import { expect, vi } from 'vitest'

import { app } from '../index'

    // Inject postId into the test context — createDevvitTest doesn't support it natively
    ; (MOCK_HEADERS as Record<string, string>)[Header.Post] = 't3_testpost'

// ─── Constants ────────────────────────────────────────────────────────────────

// Valid 81-char puzzle with unique solution (32 clues, simple difficulty)
const VALID_PUZZLE = '003020600900305001001806400008102900700000008006708200002609500800203009005010300'

// Invalid: wrong length
const INVALID_PUZZLE_SHORT = '123'

// Invalid: all zeros — fewer than 17 givens
const INVALID_PUZZLE_NO_GIVENS = '0'.repeat(81)

// ─── POST /api/community/validate ────────────────────────────────────────────

const testValidate = createDevvitTest()

testValidate('POST /api/community/validate returns difficulty and clueCount for valid puzzle', async () => {
    const res = await app.request('/api/community/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzle: VALID_PUZZLE }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.difficulty).toBe('simple')
    expect(json.data.clueCount).toBe(32)
    expect(json.data.preview).toBe(VALID_PUZZLE)
})

testValidate('POST /api/community/validate returns error for puzzle with wrong length', async () => {
    const res = await app.request('/api/community/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzle: INVALID_PUZZLE_SHORT }),
    })
    const json = await res.json()

    // Validation errors return 200 with status: 'error' (not a 4xx — the request itself is valid)
    expect(res.status).toBe(200)
    expect(json.status).toBe('error')
    expect(typeof json.message).toBe('string')
    expect(json.message.length).toBeGreaterThan(0)
})

testValidate('POST /api/community/validate returns error for puzzle with too few givens', async () => {
    const res = await app.request('/api/community/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzle: INVALID_PUZZLE_NO_GIVENS }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('error')
    expect(typeof json.message).toBe('string')
    expect(json.message.length).toBeGreaterThan(0)
})

testValidate('POST /api/community/validate returns 400 for missing puzzle field', async () => {
    const res = await app.request('/api/community/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
})

testValidate('POST /api/community/validate returns 400 for invalid JSON body', async () => {
    const res = await app.request('/api/community/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
    })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
})

// ─── POST /api/community/submit ───────────────────────────────────────────────

const testSubmit = createDevvitTest({ userId: 't2_testuser', username: 'testuser' })

testSubmit('POST /api/community/submit creates post, stores data, and sets cooldown on success', async ({ subredditName }) => {
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_newpost' } as never)
    vi.spyOn(reddit, 'getCurrentUsername').mockResolvedValue('testuser')
    vi.spyOn(reddit, 'submitComment').mockResolvedValue(undefined as never)

    const res = await app.request('/api/community/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzle: VALID_PUZZLE }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.postUrl).toBe(
        `https://reddit.com/r/${subredditName}/comments/t3_newpost`
    )

    // Verify puzzle data was stored in Redis
    const puzzleData = await redis.hGetAll('puzzle:t3_newpost')
    expect(puzzleData['type']).toBe('community')
    expect(puzzleData['creatorId']).toBe('t2_testuser')
    expect(puzzleData['creatorUsername']).toBe('testuser')
    expect(puzzleData['difficulty']).toBe('simple')
    expect(puzzleData['simple:puzzle']).toBe(VALID_PUZZLE)
    expect(typeof puzzleData['simple:solution']).toBe('string')
    expect(puzzleData['solveCount']).toBe('0')

    // Verify submission was added to history
    const history = await redis.zRange('submissions:t2_testuser', 0, -1, { by: 'rank' })
    expect(history.map((e) => e.member)).toContain('t3_newpost')

    // Verify cooldown was set
    const expiresAt = await redis.expireTime('cooldown:t2_testuser')
    expect(expiresAt).toBeGreaterThan(0)
})

testSubmit('POST /api/community/submit rejects second submission within cooldown', async () => {
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_post1' } as never)
    vi.spyOn(reddit, 'getCurrentUsername').mockResolvedValue('testuser')
    vi.spyOn(reddit, 'submitComment').mockResolvedValue(undefined as never)

    // First submission — should succeed
    const first = await app.request('/api/community/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzle: VALID_PUZZLE }),
    })
    expect(first.status).toBe(200)

    // Second submission — should be rejected by cooldown
    const second = await app.request('/api/community/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzle: VALID_PUZZLE }),
    })
    const json = await second.json()

    expect(second.status).toBe(400)
    expect(json.status).toBe('error')
    expect(json.message).toMatch(/wait/i)
})

testSubmit('POST /api/community/submit returns 400 for invalid puzzle', async () => {
    const res = await app.request('/api/community/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzle: INVALID_PUZZLE_SHORT }),
    })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
})

// Note: the test harness always provides a userId (defaults to 't2_testuser').
// The "user not logged in" guard for /api/community/submit and /api/community/my-puzzles
// is verified by the route implementation (HTTP_STATUS_UNAUTHORIZED guard on context.userId).
// Route-level unauthenticated tests are not feasible with the current test harness since
// createDevvitTest always injects a userId into the request context.

// ─── GET /api/community/my-puzzles ────────────────────────────────────────────

const testMyPuzzles = createDevvitTest({ userId: 't2_creator', username: 'creator' })

testMyPuzzles('GET /api/community/my-puzzles returns submission history', async () => {
    const timestamp = 1700000000000
    await redis.zAdd('submissions:t2_creator', { member: 't3_mypuzzle', score: timestamp })
    await redis.hSet('puzzle:t3_mypuzzle', {
        difficulty: 'intermediate',
        createdAt: String(timestamp),
        solveCount: '5',
    })

    const res = await app.request('/api/community/my-puzzles')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.puzzles).toHaveLength(1)
    expect(json.data.puzzles[0]).toEqual({
        postId: 't3_mypuzzle',
        difficulty: 'intermediate',
        createdAt: timestamp,
        solveCount: 5,
    })
})

testMyPuzzles('GET /api/community/my-puzzles returns empty array when no submissions exist', async () => {
    const res = await app.request('/api/community/my-puzzles')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.puzzles).toEqual([])
})

testMyPuzzles('GET /api/community/my-puzzles returns multiple submissions ordered by timestamp', async () => {
    const t1 = 1700000000000
    const t2 = 1700000001000
    await redis.zAdd('submissions:t2_creator', { member: 't3_puzzle1', score: t1 })
    await redis.zAdd('submissions:t2_creator', { member: 't3_puzzle2', score: t2 })
    await redis.hSet('puzzle:t3_puzzle1', {
        difficulty: 'simple',
        createdAt: String(t1),
        solveCount: '0',
    })
    await redis.hSet('puzzle:t3_puzzle2', {
        difficulty: 'expert',
        createdAt: String(t2),
        solveCount: '3',
    })

    const res = await app.request('/api/community/my-puzzles')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.puzzles).toHaveLength(2)
    expect(json.data.puzzles[0].postId).toBe('t3_puzzle1')
    expect(json.data.puzzles[1].postId).toBe('t3_puzzle2')
})

// ─── GET /api/puzzle — community puzzle shape ─────────────────────────────────

const testGetPuzzleCommunity = createDevvitTest({ userId: 't2_solver', username: 'solver' })

testGetPuzzleCommunity('GET /api/puzzle with community puzzle data returns correct shape', async () => {
    await redis.hSet('puzzle:t3_testpost', {
        type: 'community',
        creatorUsername: 'creator',
        difficulty: 'intermediate',
        'intermediate:puzzle': '3'.repeat(81),
        'intermediate:solution': '7'.repeat(81),
        solveCount: '42',
    })

    const res = await app.request('/api/puzzle')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.type).toBe('community')
    expect(json.data.creatorUsername).toBe('creator')
    expect(json.data.puzzles).toEqual({ intermediate: '3'.repeat(81) })
    expect(json.data.solutions).toEqual({ intermediate: '7'.repeat(81) })
    expect(json.data.solveCount).toBe(42)
})

// ─── GET /api/puzzle — auto-generated puzzle backward-compatible shape ─────────

const testGetPuzzleGenerated = createDevvitTest()

testGetPuzzleGenerated('GET /api/puzzle with auto-generated puzzle returns backward-compatible shape with type: generated', async () => {
    await redis.hSet('puzzle:t3_testpost', {
        'simple:puzzle': '1'.repeat(81),
        'simple:solution': '5'.repeat(81),
        'easy:puzzle': '2'.repeat(81),
        'easy:solution': '6'.repeat(81),
        'intermediate:puzzle': '3'.repeat(81),
        'intermediate:solution': '7'.repeat(81),
        'expert:puzzle': '4'.repeat(81),
        'expert:solution': '8'.repeat(81),
    })

    const res = await app.request('/api/puzzle')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.type).toBe('generated')
    expect(json.data.puzzles).toEqual({
        simple: '1'.repeat(81),
        easy: '2'.repeat(81),
        intermediate: '3'.repeat(81),
        expert: '4'.repeat(81),
    })
    expect(json.data.solutions).toEqual({
        simple: '5'.repeat(81),
        easy: '6'.repeat(81),
        intermediate: '7'.repeat(81),
        expert: '8'.repeat(81),
    })
    // No creatorUsername or solveCount on generated puzzles
    expect(json.data.creatorUsername).toBeUndefined()
    expect(json.data.solveCount).toBeUndefined()
})

// ─── POST /api/solve — solve count tracking for community puzzles ─────────────

const testSolveCount = createDevvitTest({ userId: 't2_solver', username: 'solver' })

testSolveCount('POST /api/solve increments solveCount for community puzzles on first solve', async () => {
    await redis.hSet('puzzle:t3_testpost', {
        type: 'community',
        difficulty: 'simple',
        'simple:solution': '1'.repeat(81),
        'simple:puzzle': '0'.repeat(81),
        solveCount: '0',
    })
    vi.spyOn(reddit, 'getCurrentUsername').mockResolvedValue('solver')

    const res = await app.request('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: 'simple', completionTime: 100, hintsUsed: 0, mistakesCount: 0 }),
    })

    expect(res.status).toBe(200)
    const solveCount = await redis.hGet('puzzle:t3_testpost', 'solveCount')
    expect(solveCount).toBe('1')
})

testSolveCount('POST /api/solve does not increment solveCount on duplicate solve by same user', async () => {
    await redis.hSet('puzzle:t3_testpost', {
        type: 'community',
        difficulty: 'simple',
        'simple:solution': '1'.repeat(81),
        'simple:puzzle': '0'.repeat(81),
        solveCount: '0',
    })
    vi.spyOn(reddit, 'getCurrentUsername').mockResolvedValue('solver')

    const body = JSON.stringify({ difficulty: 'simple', completionTime: 100, hintsUsed: 0, mistakesCount: 0 })

    // First solve — should succeed and increment
    const first = await app.request('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
    })
    expect(first.status).toBe(200)

    // Second solve by same user — should be rejected (Already solved) without incrementing
    const second = await app.request('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
    })
    expect(second.status).toBe(400)

    const solveCount = await redis.hGet('puzzle:t3_testpost', 'solveCount')
    expect(solveCount).toBe('1')
})

testSolveCount('POST /api/solve does not increment solveCount for auto-generated puzzles', async () => {
    await redis.hSet('puzzle:t3_testpost', {
        // no type field — auto-generated
        'simple:solution': '1'.repeat(81),
        'simple:puzzle': '0'.repeat(81),
    })
    vi.spyOn(reddit, 'getCurrentUsername').mockResolvedValue('solver')

    const res = await app.request('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: 'simple', completionTime: 100, hintsUsed: 0, mistakesCount: 0 }),
    })

    expect(res.status).toBe(200)
    // solveCount field should not exist on auto-generated puzzles
    const solveCount = await redis.hGet('puzzle:t3_testpost', 'solveCount')
    expect(solveCount).toBeUndefined()
})

// ─── Property 6: Each user counted at most once per puzzle for solve count ────

import * as fc from 'fast-check'

/**
 * **Validates: Requirements 9.1, 11.1, 11.3**
 *
 * Property 6: Each user is counted at most once per puzzle for solve count,
 * regardless of how many times they complete the puzzle.
 *
 * Strategy: use the fixed postId `t3_testpost` (already in MOCK_HEADERS) and
 * delete the solve dedup key before each fc run so each iteration is independent.
 * The completionTime is varied to ensure the property holds across different inputs.
 */
const testProperty6 = createDevvitTest({ userId: 't2_propuser', username: 'propuser' })

testProperty6('Property 6: each user counted at most once per puzzle for solve count', async () => {
    vi.spyOn(reddit, 'getCurrentUsername').mockResolvedValue('propuser')

    await fc.assert(
        fc.asyncProperty(
            // Vary completionTime to exercise different adjusted-time scores
            fc.integer({ min: 1, max: 3600 }),
            async (completionTime) => {
                // Reset puzzle and dedup key so each run is independent
                await redis.hSet('puzzle:t3_testpost', {
                    type: 'community',
                    difficulty: 'simple',
                    'simple:solution': '1'.repeat(81),
                    'simple:puzzle': '0'.repeat(81),
                    solveCount: '0',
                })
                await redis.del('solve:t3_testpost:simple:t2_propuser')

                const body = JSON.stringify({ difficulty: 'simple', completionTime, hintsUsed: 0, mistakesCount: 0 })

                // First solve — should succeed and set solveCount to 1
                const first = await app.request('/api/solve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body,
                })
                expect(first.status).toBe(200)

                const afterFirst = await redis.hGet('puzzle:t3_testpost', 'solveCount')
                expect(afterFirst).toBe('1')

                // Second solve by same user — should be rejected, solveCount stays at 1
                const second = await app.request('/api/solve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body,
                })
                expect(second.status).toBe(400)

                const afterSecond = await redis.hGet('puzzle:t3_testpost', 'solveCount')
                expect(afterSecond).toBe('1')
            }
        ),
        { numRuns: 20 }
    )
})
