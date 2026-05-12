import { Header } from '@devvit/shared-types/Header.js'
import { MOCK_HEADERS } from '@devvit/shared-types/test/index.js'
import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis, reddit } from '@devvit/web/server'
import { expect, vi } from 'vitest'

    // Inject postId into the test context
    ; (MOCK_HEADERS as Record<string, string>)[Header.Post] = 't3_testpost'

import { app } from '../index'

const POST_ID = 't3_testpost'
const SOLUTION = '1'.repeat(81)

const seedPuzzle = async (difficulty: string): Promise<void> => {
    await redis.hSet(`puzzle:${POST_ID}`, {
        [`${difficulty}:solution`]: SOLUTION,
        [`${difficulty}:puzzle`]: '0'.repeat(81),
    })
}

const solveBody = (overrides: Record<string, unknown> = {}): string =>
    JSON.stringify({
        difficulty: 'easy',
        completionTime: 120,
        hintsUsed: 1,
        mistakesCount: 2,
        notesUsed: false,
        ...overrides,
    })

const postSolve = (body: string): Promise<Response> =>
    app.request('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
    })

// ─── POST /api/solve ──────────────────────────────────────────────────────────

const testWithUser = createDevvitTest({ userId: 't2_testuser', username: 'testuser' })

testWithUser('POST /api/solve returns 200 with postRank, globalRank, adjustedTime on valid request', async () => {
    await seedPuzzle('easy')
    vi.spyOn(reddit, 'getCurrentUsername').mockResolvedValue('testuser')

    const res = await postSolve(solveBody())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.postRank).toBe(1)
    expect(json.data.globalRank).toBe(1)
    expect(json.data.adjustedTime).toBe(150) // 120 + 1*30
})

testWithUser('POST /api/solve returns 400 on duplicate solve', async () => {
    await seedPuzzle('easy')
    vi.spyOn(reddit, 'getCurrentUsername').mockResolvedValue('testuser')

    await postSolve(solveBody())
    const res = await postSolve(solveBody())
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
    expect(json.message).toBe('Already solved')
})

testWithUser('POST /api/solve returns 400 for invalid difficulty', async () => {
    const res = await postSolve(solveBody({ difficulty: 'extreme' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
})

testWithUser('POST /api/solve returns 400 for negative completionTime', async () => {
    const res = await postSolve(solveBody({ completionTime: -1 }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
})

testWithUser('POST /api/solve returns 400 when solution not found in Redis', async () => {
    // No puzzle seeded — route should return 400 with "Solution not found"
    vi.spyOn(reddit, 'getCurrentUsername').mockResolvedValue('testuser')

    const res = await postSolve(solveBody())
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.message).toBe('Solution not found')
})

testWithUser('POST /api/solve stores notesUsed as "true" in Redis when notesUsed is true', async () => {
    await seedPuzzle('easy')
    vi.spyOn(reddit, 'getCurrentUsername').mockResolvedValue('testuser')

    const res = await postSolve(solveBody({ notesUsed: true }))
    expect(res.status).toBe(200)

    const stored = await redis.hGet(`solve:${POST_ID}:easy:t2_testuser`, 'notesUsed')
    expect(stored).toBe('true')
})

testWithUser('POST /api/solve stores notesUsed as "false" in Redis when notesUsed is false', async () => {
    await seedPuzzle('easy')
    vi.spyOn(reddit, 'getCurrentUsername').mockResolvedValue('testuser')

    const res = await postSolve(solveBody({ notesUsed: false }))
    expect(res.status).toBe(200)

    const stored = await redis.hGet(`solve:${POST_ID}:easy:t2_testuser`, 'notesUsed')
    expect(stored).toBe('false')
})

testWithUser('POST /api/solve returns 400 for non-boolean notesUsed (string)', async () => {
    const res = await postSolve(solveBody({ notesUsed: 'true' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
})

testWithUser('POST /api/solve returns 400 for non-boolean notesUsed (number)', async () => {
    const res = await postSolve(solveBody({ notesUsed: 1 }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
})

// Note: the test harness always provides a userId (defaults to 't2_testuser').
// The "user not logged in" guard is verified by the leaderboard lib unit tests.
// Here we verify the route returns 400 for missing auth by testing the next guard
// (solution not found) which proves the route processes guards in order.

// ─── GET /api/leaderboard/post ────────────────────────────────────────────────
// Each test uses a unique difficulty to avoid cache key collisions between tests.

const testPostLb = createDevvitTest({ userId: 't2_alice', username: 'alice' })

testPostLb('GET /api/leaderboard/post returns entries for valid request', async () => {
    const difficulty = 'simple'
    await redis.hSet(`solve:${POST_ID}:${difficulty}:t2_alice`, {
        username: 'alice',
        completionTime: '100',
        hintsUsed: '0',
        mistakesCount: '1',
        adjustedTime: '100',
    })
    await redis.zAdd(`leaderboard:${POST_ID}:${difficulty}`, { member: 't2_alice', score: 100 })

    const res = await app.request(`/api/leaderboard/post?difficulty=${difficulty}`)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.entries).toHaveLength(1)
    expect(json.data.entries[0].username).toBe('alice')
    expect(json.data.entries[0].rank).toBe(1)
})

testPostLb('GET /api/leaderboard/post returns 400 for invalid difficulty', async () => {
    const res = await app.request('/api/leaderboard/post?difficulty=extreme')
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
})

testPostLb('GET /api/leaderboard/post returns 400 when no difficulty param provided', async () => {
    // No difficulty query param — isValidDifficulty(undefined) returns false → 400
    const res = await app.request('/api/leaderboard/post')
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
    expect(json.message).toBe('Invalid difficulty')
})

testPostLb('GET /api/leaderboard/post returns empty entries array when no solves exist', async () => {
    // Use a difficulty with no seeded data (intermediate has no entries)
    const res = await app.request('/api/leaderboard/post?difficulty=intermediate')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.entries).toEqual([])
    expect(json.data.userEntry).toBeNull()
})

testPostLb('GET /api/leaderboard/post response entries include notesUsed field when seeded with notesUsed: "true"', async () => {
    const difficulty = 'easy'
    await redis.hSet(`solve:${POST_ID}:${difficulty}:t2_alice`, {
        username: 'alice',
        completionTime: '90',
        hintsUsed: '0',
        mistakesCount: '0',
        adjustedTime: '90',
        notesUsed: 'true',
    })
    await redis.zAdd(`leaderboard:${POST_ID}:${difficulty}`, { member: 't2_alice', score: 90 })

    const res = await app.request(`/api/leaderboard/post?difficulty=${difficulty}`)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.entries).toHaveLength(1)
    expect(json.data.entries[0].notesUsed).toBe(true)
})

testPostLb('GET /api/leaderboard/post handles legacy entries without notesUsed gracefully', async () => {
    const difficulty = 'simple'
    await redis.hSet(`solve:${POST_ID}:${difficulty}:t2_alice`, {
        username: 'alice',
        completionTime: '200',
        hintsUsed: '1',
        mistakesCount: '0',
        adjustedTime: '230',
        // notesUsed intentionally omitted — legacy record
    })
    await redis.zAdd(`leaderboard:${POST_ID}:${difficulty}`, { member: 't2_alice', score: 230 })

    const res = await app.request(`/api/leaderboard/post?difficulty=${difficulty}`)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.entries).toHaveLength(1)
    // Legacy records have notesUsed: undefined, which JSON.stringify omits
    expect(json.data.entries[0].notesUsed).toBeUndefined()
})

testPostLb('GET /api/leaderboard/post includes user entry when outside top 10', async () => {
    const difficulty = 'expert'
    // Seed 10 other users with better scores
    for (let i = 1; i <= 10; i++) {
        const uid = `t2_user${i}`
        await redis.hSet(`solve:${POST_ID}:${difficulty}:${uid}`, {
            username: `user${i}`,
            completionTime: String(i * 10),
            hintsUsed: '0',
            mistakesCount: '0',
            adjustedTime: String(i * 10),
        })
        await redis.zAdd(`leaderboard:${POST_ID}:${difficulty}`, { member: uid, score: i * 10 })
    }
    // alice is rank 11
    await redis.hSet(`solve:${POST_ID}:${difficulty}:t2_alice`, {
        username: 'alice',
        completionTime: '500',
        hintsUsed: '0',
        mistakesCount: '0',
        adjustedTime: '500',
    })
    await redis.zAdd(`leaderboard:${POST_ID}:${difficulty}`, { member: 't2_alice', score: 500 })

    const res = await app.request(`/api/leaderboard/post?difficulty=${difficulty}`)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.entries).toHaveLength(10)
    expect(json.data.userEntry).not.toBeNull()
    expect(json.data.userEntry.username).toBe('alice')
    expect(json.data.userEntry.rank).toBe(11)
})

// ─── GET /api/leaderboard/global ─────────────────────────────────────────────

const testGlobal = createDevvitTest({ userId: 't2_bob', username: 'bob' })

testGlobal('GET /api/leaderboard/global returns entries for valid request', async () => {
    const difficulty = 'simple'
    await redis.hSet(`solve:global:${difficulty}:t2_bob`, {
        username: 'bob',
        completionTime: '200',
        hintsUsed: '2',
        mistakesCount: '0',
        adjustedTime: '260',
    })
    await redis.zAdd(`leaderboard:global:${difficulty}`, { member: 't2_bob', score: 260 })

    const res = await app.request(`/api/leaderboard/global?difficulty=${difficulty}`)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.entries).toHaveLength(1)
    expect(json.data.entries[0].username).toBe('bob')
})

testGlobal('GET /api/leaderboard/global returns 400 for invalid difficulty', async () => {
    const res = await app.request('/api/leaderboard/global?difficulty=invalid')
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
})

testGlobal('GET /api/leaderboard/global includes user entry when outside top 10', async () => {
    const difficulty = 'expert'
    // Seed 10 users with better scores
    for (let i = 1; i <= 10; i++) {
        const uid = `t2_guser${i}`
        await redis.hSet(`solve:global:${difficulty}:${uid}`, {
            username: `guser${i}`,
            completionTime: String(i * 10),
            hintsUsed: '0',
            mistakesCount: '0',
            adjustedTime: String(i * 10),
        })
        await redis.zAdd(`leaderboard:global:${difficulty}`, { member: uid, score: i * 10 })
    }
    // bob is rank 11
    await redis.hSet(`solve:global:${difficulty}:t2_bob`, {
        username: 'bob',
        completionTime: '999',
        hintsUsed: '0',
        mistakesCount: '0',
        adjustedTime: '999',
    })
    await redis.zAdd(`leaderboard:global:${difficulty}`, { member: 't2_bob', score: 999 })

    const res = await app.request(`/api/leaderboard/global?difficulty=${difficulty}`)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.entries).toHaveLength(10)
    expect(json.data.userEntry).not.toBeNull()
    expect(json.data.userEntry.username).toBe('bob')
    expect(json.data.userEntry.rank).toBe(11)
})

// ─── POST /api/solve — unranked field (task 7.1) ──────────────────────────────

const testUnranked = createDevvitTest({ userId: 't2_unrankeduser', username: 'unrankeduser' })

testUnranked('POST /api/solve with unranked: true persists solve hash with unranked: "true" and produces no sorted-set membership', async () => {
    await seedPuzzle('easy')
    vi.spyOn(reddit, 'getCurrentUsername').mockResolvedValue('unrankeduser')

    const res = await postSolve(solveBody({ unranked: true }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.postRank).toBeNull()
    expect(json.data.globalRank).toBeNull()

    const storedUnranked = await redis.hGet(`solve:${POST_ID}:easy:t2_unrankeduser`, 'unranked')
    expect(storedUnranked).toBe('true')

    // Must NOT be a member of either sorted set
    const postScore = await redis.zScore(`leaderboard:${POST_ID}:easy`, 't2_unrankeduser')
    expect(postScore).toBeUndefined()

    const globalScore = await redis.zScore('leaderboard:global:easy', 't2_unrankeduser')
    expect(globalScore).toBeUndefined()
})

testUnranked('POST /api/solve with unranked: false persists solve hash with unranked: "false" and both sorted sets contain userId', async () => {
    await seedPuzzle('easy')
    vi.spyOn(reddit, 'getCurrentUsername').mockResolvedValue('unrankeduser')

    const res = await postSolve(solveBody({ unranked: false }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.postRank).not.toBeNull()
    expect(json.data.globalRank).not.toBeNull()

    const storedUnranked = await redis.hGet(`solve:${POST_ID}:easy:t2_unrankeduser`, 'unranked')
    expect(storedUnranked).toBe('false')

    const postScore = await redis.zScore(`leaderboard:${POST_ID}:easy`, 't2_unrankeduser')
    expect(postScore).toBeDefined()

    const globalScore = await redis.zScore('leaderboard:global:easy', 't2_unrankeduser')
    expect(globalScore).toBeDefined()
})

testUnranked('POST /api/solve with unranked: "true" (string) returns 400 with validator error in body', async () => {
    const res = await postSolve(solveBody({ unranked: 'true' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
    expect(json.message).toContain('unranked')
})

testUnranked('POST /api/solve with unranked omitted treats it as false (backwards compatibility)', async () => {
    await seedPuzzle('easy')
    vi.spyOn(reddit, 'getCurrentUsername').mockResolvedValue('unrankeduser')

    // solveBody() does not include unranked — omitted key
    const res = await postSolve(solveBody())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.postRank).not.toBeNull()
    expect(json.data.globalRank).not.toBeNull()

    const storedUnranked = await redis.hGet(`solve:${POST_ID}:easy:t2_unrankeduser`, 'unranked')
    expect(storedUnranked).toBe('false')
})

// ─── GET /api/leaderboard/post — unranked entries (task 7.1) ─────────────────
// Use a distinct subredditId to get a unique in-memory cache namespace,
// avoiding collisions with other tests that use the same difficulty keys.

const testUnrankedLb = createDevvitTest({ userId: 't2_unrankedlb', username: 'unrankedlb', subredditId: 't5_unrankedsub' as `t5_${string}` })

testUnrankedLb('GET /api/leaderboard/post response entries include unranked: boolean and rank: number | null', async () => {
    const difficulty = 'simple'
    await redis.hSet(`solve:${POST_ID}:${difficulty}:t2_unrankedlb`, {
        username: 'unrankedlb',
        completionTime: '80',
        hintsUsed: '0',
        mistakesCount: '0',
        adjustedTime: '80',
        unranked: 'false',
    })
    await redis.zAdd(`leaderboard:${POST_ID}:${difficulty}`, { member: 't2_unrankedlb', score: 80 })

    const res = await app.request(`/api/leaderboard/post?difficulty=${difficulty}`)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.entries).toHaveLength(1)
    expect(typeof json.data.entries[0].unranked).toBe('boolean')
    expect(json.data.entries[0].unranked).toBe(false)
    expect(typeof json.data.entries[0].rank).toBe('number')
    expect(json.data.entries[0].rank).toBe(1)
})

testUnrankedLb('GET /api/leaderboard/post returns userEntry.rank === null and userEntry.unranked === true when requesting user has only an unranked solve', async () => {
    const difficulty = 'intermediate'
    // Seed the user's solve hash as unranked (no sorted-set entry)
    await redis.hSet(`solve:${POST_ID}:${difficulty}:t2_unrankedlb`, {
        username: 'unrankedlb',
        completionTime: '200',
        hintsUsed: '0',
        mistakesCount: '0',
        adjustedTime: '200',
        unranked: 'true',
    })
    // Deliberately do NOT add to the sorted set

    const res = await app.request(`/api/leaderboard/post?difficulty=${difficulty}`)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.userEntry).not.toBeNull()
    expect(json.data.userEntry.rank).toBeNull()
    expect(json.data.userEntry.unranked).toBe(true)
})
