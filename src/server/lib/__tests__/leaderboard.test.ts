import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis } from '@devvit/redis'
import { expect, describe, it } from 'vitest'

import {
    computeAdjustedTime,
    validateSolveInput,
    recordSolve,
    getLeaderboard,
} from '../leaderboard'

// ─── computeAdjustedTime ─────────────────────────────────────────────────────

describe('computeAdjustedTime', () => {
    it('returns 0 for completionTime=0 and hintsUsed=0', () => {
        expect(computeAdjustedTime(0, 0)).toBe(0)
    })

    it('returns 160 for completionTime=100 and hintsUsed=2', () => {
        expect(computeAdjustedTime(100, 2)).toBe(160)
    })

    it('returns 90 for completionTime=0 and hintsUsed=3', () => {
        expect(computeAdjustedTime(0, 3)).toBe(90)
    })

    it('returns completionTime when hintsUsed=0', () => {
        expect(computeAdjustedTime(300, 0)).toBe(300)
    })

    it('adds 30 per hint', () => {
        expect(computeAdjustedTime(0, 1)).toBe(30)
        expect(computeAdjustedTime(0, 5)).toBe(150)
    })
})

// ─── validateSolveInput ───────────────────────────────────────────────────────

describe('validateSolveInput', () => {
    it('returns parsed fields for valid input', () => {
        const result = validateSolveInput({
            difficulty: 'easy',
            completionTime: 120,
            hintsUsed: 2,
            mistakesCount: 3,
            notesUsed: true,
        })
        expect(result).toEqual({
            difficulty: 'easy',
            completionTime: 120,
            hintsUsed: 2,
            mistakesCount: 3,
            notesUsed: true,
            unranked: false,
        })
    })

    it('accepts all valid difficulties', () => {
        for (const d of ['simple', 'easy', 'intermediate', 'expert']) {
            const result = validateSolveInput({ difficulty: d, completionTime: 0, hintsUsed: 0, mistakesCount: 0, notesUsed: false })
            expect(typeof result).toBe('object')
        }
    })

    it('returns error string for invalid difficulty', () => {
        const result = validateSolveInput({ difficulty: 'hard', completionTime: 0, hintsUsed: 0, mistakesCount: 0, notesUsed: false })
        expect(typeof result).toBe('string')
    })

    it('returns error string for negative completionTime', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: -1, hintsUsed: 0, mistakesCount: 0, notesUsed: false })
        expect(typeof result).toBe('string')
    })

    it('returns error string for negative hintsUsed', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 0, hintsUsed: -5, mistakesCount: 0, notesUsed: false })
        expect(typeof result).toBe('string')
    })

    it('returns error string for negative mistakesCount', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 0, hintsUsed: 0, mistakesCount: -1, notesUsed: false })
        expect(typeof result).toBe('string')
    })

    it('returns error string for float completionTime', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 1.5, hintsUsed: 0, mistakesCount: 0, notesUsed: false })
        expect(typeof result).toBe('string')
    })

    it('returns error string for float hintsUsed', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 0, hintsUsed: 0.5, mistakesCount: 0, notesUsed: false })
        expect(typeof result).toBe('string')
    })

    it('returns error string for string completionTime', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: '120', hintsUsed: 0, mistakesCount: 0, notesUsed: false })
        expect(typeof result).toBe('string')
    })

    it('returns error string for null completionTime', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: null, hintsUsed: 0, mistakesCount: 0, notesUsed: false })
        expect(typeof result).toBe('string')
    })

    it('returns error string for null body', () => {
        const result = validateSolveInput(null)
        expect(typeof result).toBe('string')
    })

    it('returns error string for non-object body', () => {
        const result = validateSolveInput('invalid')
        expect(typeof result).toBe('string')
    })

    it('accepts zero values for all numeric fields', () => {
        const result = validateSolveInput({ difficulty: 'simple', completionTime: 0, hintsUsed: 0, mistakesCount: 0, notesUsed: false })
        expect(typeof result).toBe('object')
    })

    // notesUsed validation — Requirements 3.2, 3.3, 3.4
    it('accepts payload with notesUsed: true', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: true })
        expect(typeof result).toBe('object')
        if (typeof result === 'object') {
            expect(result.notesUsed).toBe(true)
        }
    })

    it('accepts payload with notesUsed: false', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: false })
        expect(typeof result).toBe('object')
        if (typeof result === 'object') {
            expect(result.notesUsed).toBe(false)
        }
    })

    it('returns error string for notesUsed: "true" (string)', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: 'true' })
        expect(typeof result).toBe('string')
    })

    it('returns error string for notesUsed: 1 (number)', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: 1 })
        expect(typeof result).toBe('string')
    })

    it('returns error string for notesUsed: null', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: null })
        expect(typeof result).toBe('string')
    })

    it('returns error string for missing notesUsed', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0 })
        expect(typeof result).toBe('string')
    })

    // unranked validation — Requirements 9.1, 9.2, 9.3, 9.4
    it('accepts payload with unranked: true and returns unranked: true in the result', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: true })
        expect(typeof result).toBe('object')
        if (typeof result === 'object') {
            expect(result.unranked).toBe(true)
        }
    })

    it('accepts payload with unranked: false and returns unranked: false in the result', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: false })
        expect(typeof result).toBe('object')
        if (typeof result === 'object') {
            expect(result.unranked).toBe(false)
        }
    })

    it('accepts payload with unranked key omitted and returns unranked: false (default)', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: false })
        expect(typeof result).toBe('object')
        if (typeof result === 'object') {
            expect(result.unranked).toBe(false)
        }
    })

    it('returns error string for unranked: "true" (string)', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: 'true' })
        expect(typeof result).toBe('string')
    })

    it('returns error string for unranked: 1 (number)', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: 1 })
        expect(typeof result).toBe('string')
    })

    it('returns error string for unranked: null', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: null })
        expect(typeof result).toBe('string')
    })

    it('returns error string for unranked: {} (object)', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: {} })
        expect(typeof result).toBe('string')
    })

    it('returns error string for unranked: [] (array)', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: [] })
        expect(typeof result).toBe('string')
    })

    it('error message for invalid unranked identifies field "unranked" and mentions boolean', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: 'true' })
        expect(typeof result).toBe('string')
        if (typeof result === 'string') {
            expect(result.toLowerCase()).toContain('unranked')
            expect(result.toLowerCase()).toContain('boolean')
        }
    })
})

// ─── recordSolve ─────────────────────────────────────────────────────────────

const test = createDevvitTest()

describe('recordSolve', () => {
    test('records a solve and returns postRank and globalRank', async () => {
        const result = await recordSolve({
            redis,
            postId: 't3_post1',
            userId: 't2_user1',
            username: 'alice',
            difficulty: 'easy',
            completionTime: 120,
            hintsUsed: 1,
            mistakesCount: 0,
            notesUsed: false,
        })
        expect(typeof result).toBe('object')
        if (typeof result === 'object') {
            expect(result.postRank).toBe(1)
            expect(result.globalRank).toBe(1)
            expect(result.adjustedTime).toBe(150) // 120 + 1*30
        }
    })

    test('rejects duplicate solve for same postId+difficulty+userId', async () => {
        const params = {
            redis,
            postId: 't3_post2',
            userId: 't2_user2',
            username: 'bob',
            difficulty: 'easy' as const,
            completionTime: 100,
            hintsUsed: 0,
            mistakesCount: 0,
            notesUsed: false,
        }
        await recordSolve(params)
        const second = await recordSolve(params)
        expect(typeof second).toBe('string')
        expect(second).toBe('Already solved')
    })

    test('stores solve hash with correct fields', async () => {
        await recordSolve({
            redis,
            postId: 't3_post3',
            userId: 't2_user3',
            username: 'carol',
            difficulty: 'simple',
            completionTime: 200,
            hintsUsed: 2,
            mistakesCount: 5,
            notesUsed: false,
        })
        const data = await redis.hGetAll('solve:t3_post3:simple:t2_user3')
        expect(data['username']).toBe('carol')
        expect(data['completionTime']).toBe('200')
        expect(data['hintsUsed']).toBe('2')
        expect(data['mistakesCount']).toBe('5')
        expect(data['adjustedTime']).toBe('260') // 200 + 2*30
    })

    test('updates global leaderboard only when new score is better', async () => {
        const baseParams = {
            redis,
            userId: 't2_user4',
            username: 'dave',
            difficulty: 'expert' as const,
            hintsUsed: 0,
            mistakesCount: 0,
            notesUsed: false,
        }
        // First solve on post1 with time 300
        await recordSolve({ ...baseParams, postId: 't3_post_a', completionTime: 300 })
        const score1 = await redis.zScore('leaderboard:global:expert', 't2_user4')
        expect(score1).toBe(300)

        // Second solve on post2 with worse time 400 — global should stay 300
        await recordSolve({ ...baseParams, postId: 't3_post_b', completionTime: 400 })
        const score2 = await redis.zScore('leaderboard:global:expert', 't2_user4')
        expect(score2).toBe(300)

        // Third solve on post3 with better time 200 — global should update to 200
        await recordSolve({ ...baseParams, postId: 't3_post_c', completionTime: 200 })
        const score3 = await redis.zScore('leaderboard:global:expert', 't2_user4')
        expect(score3).toBe(200)
    })

    // notesUsed persistence — Requirements 4.1, 4.2, 4.3, 7.3
    test('stores notesUsed as "true" in post-level Redis hash when notesUsed is true', async () => {
        await recordSolve({
            redis,
            postId: 't3_notes1',
            userId: 't2_notes1',
            username: 'eve',
            difficulty: 'easy',
            completionTime: 100,
            hintsUsed: 0,
            mistakesCount: 0,
            notesUsed: true,
        })
        const data = await redis.hGetAll('solve:t3_notes1:easy:t2_notes1')
        expect(data['notesUsed']).toBe('true')
    })

    test('stores notesUsed as "false" in post-level Redis hash when notesUsed is false', async () => {
        await recordSolve({
            redis,
            postId: 't3_notes2',
            userId: 't2_notes2',
            username: 'frank',
            difficulty: 'easy',
            completionTime: 100,
            hintsUsed: 0,
            mistakesCount: 0,
            notesUsed: false,
        })
        const data = await redis.hGetAll('solve:t3_notes2:easy:t2_notes2')
        expect(data['notesUsed']).toBe('false')
    })

    test('stores notesUsed as "true" in global-level Redis hash when notesUsed is true', async () => {
        await recordSolve({
            redis,
            postId: 't3_notes3',
            userId: 't2_notes3',
            username: 'grace',
            difficulty: 'intermediate',
            completionTime: 150,
            hintsUsed: 0,
            mistakesCount: 0,
            notesUsed: true,
        })
        const data = await redis.hGetAll('solve:global:intermediate:t2_notes3')
        expect(data['notesUsed']).toBe('true')
    })

    test('stores notesUsed as "false" in global-level Redis hash when notesUsed is false', async () => {
        await recordSolve({
            redis,
            postId: 't3_notes4',
            userId: 't2_notes4',
            username: 'henry',
            difficulty: 'intermediate',
            completionTime: 150,
            hintsUsed: 0,
            mistakesCount: 0,
            notesUsed: false,
        })
        const data = await redis.hGetAll('solve:global:intermediate:t2_notes4')
        expect(data['notesUsed']).toBe('false')
    })

    // unranked persistence — Requirements 8.1, 10.1, 10.2, 10.3, 10.6
    test('unranked: true — post-level hash is written with unranked: "true"', async () => {
        await recordSolve({
            redis,
            postId: 't3_unranked1',
            userId: 't2_unranked1',
            username: 'ivan',
            difficulty: 'easy',
            completionTime: 100,
            hintsUsed: 1,
            mistakesCount: 0,
            notesUsed: false,
            unranked: true,
        })
        const data = await redis.hGetAll('solve:t3_unranked1:easy:t2_unranked1')
        expect(data['unranked']).toBe('true')
    })

    test('unranked: true — global-level hash is written with unranked: "true"', async () => {
        await recordSolve({
            redis,
            postId: 't3_unranked2',
            userId: 't2_unranked2',
            username: 'julia',
            difficulty: 'easy',
            completionTime: 100,
            hintsUsed: 1,
            mistakesCount: 0,
            notesUsed: false,
            unranked: true,
        })
        const data = await redis.hGetAll('solve:global:easy:t2_unranked2')
        expect(data['unranked']).toBe('true')
    })

    test('unranked: true — userId is NOT a member of leaderboard:{postId}:{difficulty} sorted set', async () => {
        await recordSolve({
            redis,
            postId: 't3_unranked3',
            userId: 't2_unranked3',
            username: 'karl',
            difficulty: 'simple',
            completionTime: 80,
            hintsUsed: 0,
            mistakesCount: 0,
            notesUsed: false,
            unranked: true,
        })
        const score = await redis.zScore('leaderboard:t3_unranked3:simple', 't2_unranked3')
        expect(score).toBeUndefined()
    })

    test('unranked: true — userId is NOT a member of leaderboard:global:{difficulty} sorted set', async () => {
        await recordSolve({
            redis,
            postId: 't3_unranked4',
            userId: 't2_unranked4',
            username: 'laura',
            difficulty: 'simple',
            completionTime: 80,
            hintsUsed: 0,
            mistakesCount: 0,
            notesUsed: false,
            unranked: true,
        })
        const score = await redis.zScore('leaderboard:global:simple', 't2_unranked4')
        expect(score).toBeUndefined()
    })

    test('unranked: true — return value is { postRank: null, globalRank: null, adjustedTime }', async () => {
        const result = await recordSolve({
            redis,
            postId: 't3_unranked5',
            userId: 't2_unranked5',
            username: 'mike',
            difficulty: 'expert',
            completionTime: 200,
            hintsUsed: 2,
            mistakesCount: 1,
            notesUsed: true,
            unranked: true,
        })
        expect(typeof result).toBe('object')
        if (typeof result === 'object') {
            expect(result.postRank).toBeNull()
            expect(result.globalRank).toBeNull()
            expect(result.adjustedTime).toBe(260) // 200 + 2*30
        }
    })

    test('unranked: false — post-level hash is written with unranked: "false"', async () => {
        await recordSolve({
            redis,
            postId: 't3_ranked1',
            userId: 't2_ranked1',
            username: 'nina',
            difficulty: 'easy',
            completionTime: 120,
            hintsUsed: 1,
            mistakesCount: 0,
            notesUsed: false,
            unranked: false,
        })
        const data = await redis.hGetAll('solve:t3_ranked1:easy:t2_ranked1')
        expect(data['unranked']).toBe('false')
    })

    test('unranked: false — global-level hash is written with unranked: "false"', async () => {
        await recordSolve({
            redis,
            postId: 't3_ranked2',
            userId: 't2_ranked2',
            username: 'oscar',
            difficulty: 'easy',
            completionTime: 120,
            hintsUsed: 1,
            mistakesCount: 0,
            notesUsed: false,
            unranked: false,
        })
        const data = await redis.hGetAll('solve:global:easy:t2_ranked2')
        expect(data['unranked']).toBe('false')
    })

    test('unranked: false — userId IS a member of leaderboard:{postId}:{difficulty} with adjustedTime score', async () => {
        await recordSolve({
            redis,
            postId: 't3_ranked3',
            userId: 't2_ranked3',
            username: 'petra',
            difficulty: 'intermediate',
            completionTime: 150,
            hintsUsed: 2,
            mistakesCount: 0,
            notesUsed: false,
            unranked: false,
        })
        // adjustedTime = 150 + 2*30 = 210
        const score = await redis.zScore('leaderboard:t3_ranked3:intermediate', 't2_ranked3')
        expect(score).toBe(210)
    })

    test('unranked: false — userId IS a member of leaderboard:global:{difficulty} with adjustedTime score', async () => {
        await recordSolve({
            redis,
            postId: 't3_ranked4',
            userId: 't2_ranked4',
            username: 'quinn',
            difficulty: 'intermediate',
            completionTime: 150,
            hintsUsed: 2,
            mistakesCount: 0,
            notesUsed: false,
            unranked: false,
        })
        // adjustedTime = 150 + 2*30 = 210
        const score = await redis.zScore('leaderboard:global:intermediate', 't2_ranked4')
        expect(score).toBe(210)
    })

    test('unranked: false — returned postRank and globalRank are non-null numbers derived from zRank + 1', async () => {
        const result = await recordSolve({
            redis,
            postId: 't3_ranked5',
            userId: 't2_ranked5',
            username: 'rachel',
            difficulty: 'expert',
            completionTime: 300,
            hintsUsed: 0,
            mistakesCount: 0,
            notesUsed: false,
            unranked: false,
        })
        expect(typeof result).toBe('object')
        if (typeof result === 'object') {
            expect(result.postRank).not.toBeNull()
            expect(result.globalRank).not.toBeNull()
            expect(typeof result.postRank).toBe('number')
            expect(typeof result.globalRank).toBe('number')
            expect(result.postRank).toBeGreaterThanOrEqual(1)
            expect(result.globalRank).toBeGreaterThanOrEqual(1)
        }
    })
})

// ─── getLeaderboard ───────────────────────────────────────────────────────────

describe('getLeaderboard', () => {
    test('returns empty entries for empty leaderboard', async () => {
        const result = await getLeaderboard({
            redis,
            key: 'leaderboard:t3_empty:easy',
            solveKeyPrefix: 'solve:t3_empty:easy',
        })
        expect(result.entries).toEqual([])
        expect(result.userEntry).toBeNull()
    })

    test('returns top 10 entries sorted by adjustedTime ascending', async () => {
        const postId = 't3_top10'
        const difficulty = 'easy'
        // Seed 12 users with different times
        for (let i = 1; i <= 12; i++) {
            await recordSolve({
                redis,
                postId,
                userId: `t2_user${i}`,
                username: `user${i}`,
                difficulty,
                completionTime: i * 10,
                hintsUsed: 0,
                mistakesCount: 0,
                notesUsed: false,
            })
        }
        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
        })
        expect(result.entries).toHaveLength(10)
        // Verify ascending order
        for (let i = 1; i < result.entries.length; i++) {
            expect(result.entries[i]!.adjustedTime).toBeGreaterThanOrEqual(result.entries[i - 1]!.adjustedTime)
        }
        // Rank 1 should be user1 (lowest time = 10)
        expect(result.entries[0]!.rank).toBe(1)
        expect(result.entries[0]!.username).toBe('user1')
    })

    test('includes user entry with rank when user is outside top 10', async () => {
        const postId = 't3_outside'
        const difficulty = 'intermediate'
        // Seed 10 users with times 10..100
        for (let i = 1; i <= 10; i++) {
            await recordSolve({
                redis,
                postId,
                userId: `t2_top${i}`,
                username: `top${i}`,
                difficulty,
                completionTime: i * 10,
                hintsUsed: 0,
                mistakesCount: 0,
                notesUsed: false,
            })
        }
        // Seed user11 with a worse time (rank 11)
        await recordSolve({
            redis,
            postId,
            userId: 't2_user11',
            username: 'user11',
            difficulty,
            completionTime: 200,
            hintsUsed: 0,
            mistakesCount: 0,
            notesUsed: false,
        })
        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
            userId: 't2_user11',
        })
        expect(result.entries).toHaveLength(10)
        expect(result.userEntry).not.toBeNull()
        expect(result.userEntry!.rank).toBe(11)
        expect(result.userEntry!.username).toBe('user11')
    })

    test('returns null userEntry when user is in top 10', async () => {
        const postId = 't3_intop'
        const difficulty = 'simple'
        await recordSolve({
            redis,
            postId,
            userId: 't2_topuser',
            username: 'topuser',
            difficulty,
            completionTime: 50,
            hintsUsed: 0,
            mistakesCount: 0,
            notesUsed: false,
        })
        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
            userId: 't2_topuser',
        })
        expect(result.entries).toHaveLength(1)
        expect(result.userEntry).toBeNull()
    })

    // parseSolveRecord notesUsed parsing — Requirements 4.1, 4.2, 4.3, 7.3
    // Tested indirectly via getLeaderboard by seeding Redis directly with hSet

    test('parseSolveRecord parses notesUsed: "true" to true', async () => {
        const postId = 't3_parse1'
        const difficulty = 'easy'
        const userId = 't2_parse1'
        // Seed Redis directly with notesUsed="true"
        await redis.hSet(`solve:${postId}:${difficulty}:${userId}`, {
            username: 'alice',
            completionTime: '100',
            hintsUsed: '0',
            mistakesCount: '0',
            adjustedTime: '100',
            notesUsed: 'true',
        })
        await redis.zAdd(`leaderboard:${postId}:${difficulty}`, { member: userId, score: 100 })

        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
        })
        expect(result.entries).toHaveLength(1)
        expect(result.entries[0]!.notesUsed).toBe(true)
    })

    test('parseSolveRecord parses notesUsed: "false" to false', async () => {
        const postId = 't3_parse2'
        const difficulty = 'easy'
        const userId = 't2_parse2'
        // Seed Redis directly with notesUsed="false"
        await redis.hSet(`solve:${postId}:${difficulty}:${userId}`, {
            username: 'bob',
            completionTime: '200',
            hintsUsed: '0',
            mistakesCount: '0',
            adjustedTime: '200',
            notesUsed: 'false',
        })
        await redis.zAdd(`leaderboard:${postId}:${difficulty}`, { member: userId, score: 200 })

        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
        })
        expect(result.entries).toHaveLength(1)
        expect(result.entries[0]!.notesUsed).toBe(false)
    })

    test('parseSolveRecord parses missing notesUsed to undefined (legacy records)', async () => {
        const postId = 't3_parse3'
        const difficulty = 'easy'
        const userId = 't2_parse3'
        // Seed Redis directly WITHOUT notesUsed field (legacy record)
        await redis.hSet(`solve:${postId}:${difficulty}:${userId}`, {
            username: 'carol',
            completionTime: '300',
            hintsUsed: '0',
            mistakesCount: '0',
            adjustedTime: '300',
        })
        await redis.zAdd(`leaderboard:${postId}:${difficulty}`, { member: userId, score: 300 })

        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
        })
        expect(result.entries).toHaveLength(1)
        expect(result.entries[0]!.notesUsed).toBeUndefined()
    })

    test('parseSolveRecord parses unexpected string values (e.g. "yes") to undefined', async () => {
        const postId = 't3_parse4'
        const difficulty = 'easy'
        const userId = 't2_parse4'
        // Seed Redis directly with an unexpected notesUsed value
        await redis.hSet(`solve:${postId}:${difficulty}:${userId}`, {
            username: 'dave',
            completionTime: '400',
            hintsUsed: '0',
            mistakesCount: '0',
            adjustedTime: '400',
            notesUsed: 'yes',
        })
        await redis.zAdd(`leaderboard:${postId}:${difficulty}`, { member: userId, score: 400 })

        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
        })
        expect(result.entries).toHaveLength(1)
        expect(result.entries[0]!.notesUsed).toBeUndefined()
    })

    // parseSolveRecord unranked parsing — Requirements 11.1, 11.2, 11.3, 12.1, 12.2, 12.3
    // Tested indirectly via getLeaderboard by seeding Redis directly with hSet

    test('parseSolveRecord parses unranked: "true" to unranked: true', async () => {
        const postId = 't3_unranked_parse1'
        const difficulty = 'easy'
        const userId = 't2_unranked_parse1'
        await redis.hSet(`solve:${postId}:${difficulty}:${userId}`, {
            username: 'alice',
            completionTime: '100',
            hintsUsed: '0',
            mistakesCount: '0',
            adjustedTime: '100',
            notesUsed: 'false',
            unranked: 'true',
        })
        await redis.zAdd(`leaderboard:${postId}:${difficulty}`, { member: userId, score: 100 })

        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
        })
        expect(result.entries).toHaveLength(1)
        // LeaderboardEntry must have unranked field — fails until parseSolveRecord is widened
        expect((result.entries[0]! as { unranked: boolean }).unranked).toBe(true)
        // rank must accept number | null
        const rank: number | null = result.entries[0]!.rank
        expect(rank).toBe(1)
    })

    test('parseSolveRecord parses unranked: "false" to unranked: false', async () => {
        const postId = 't3_unranked_parse2'
        const difficulty = 'easy'
        const userId = 't2_unranked_parse2'
        await redis.hSet(`solve:${postId}:${difficulty}:${userId}`, {
            username: 'bob',
            completionTime: '200',
            hintsUsed: '0',
            mistakesCount: '0',
            adjustedTime: '200',
            notesUsed: 'false',
            unranked: 'false',
        })
        await redis.zAdd(`leaderboard:${postId}:${difficulty}`, { member: userId, score: 200 })

        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
        })
        expect(result.entries).toHaveLength(1)
        expect((result.entries[0]! as { unranked: boolean }).unranked).toBe(false)
    })

    test('parseSolveRecord treats missing unranked key as unranked: false (legacy record)', async () => {
        const postId = 't3_unranked_parse3'
        const difficulty = 'easy'
        const userId = 't2_unranked_parse3'
        // Legacy record — no unranked field
        await redis.hSet(`solve:${postId}:${difficulty}:${userId}`, {
            username: 'carol',
            completionTime: '300',
            hintsUsed: '0',
            mistakesCount: '0',
            adjustedTime: '300',
            notesUsed: 'false',
        })
        await redis.zAdd(`leaderboard:${postId}:${difficulty}`, { member: userId, score: 300 })

        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
        })
        expect(result.entries).toHaveLength(1)
        expect((result.entries[0]! as { unranked: boolean }).unranked).toBe(false)
    })

    test('parseSolveRecord treats unranked: "" (empty string) as unranked: false', async () => {
        const postId = 't3_unranked_parse4'
        const difficulty = 'easy'
        const userId = 't2_unranked_parse4'
        await redis.hSet(`solve:${postId}:${difficulty}:${userId}`, {
            username: 'dave',
            completionTime: '400',
            hintsUsed: '0',
            mistakesCount: '0',
            adjustedTime: '400',
            notesUsed: 'false',
            unranked: '',
        })
        await redis.zAdd(`leaderboard:${postId}:${difficulty}`, { member: userId, score: 400 })

        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
        })
        expect(result.entries).toHaveLength(1)
        expect((result.entries[0]! as { unranked: boolean }).unranked).toBe(false)
    })

    test('parseSolveRecord treats unranked: "maybe" (unexpected string) as unranked: false without throwing', async () => {
        const postId = 't3_unranked_parse5'
        const difficulty = 'easy'
        const userId = 't2_unranked_parse5'
        await redis.hSet(`solve:${postId}:${difficulty}:${userId}`, {
            username: 'eve',
            completionTime: '500',
            hintsUsed: '0',
            mistakesCount: '0',
            adjustedTime: '500',
            notesUsed: 'false',
            unranked: 'maybe',
        })
        await redis.zAdd(`leaderboard:${postId}:${difficulty}`, { member: userId, score: 500 })

        // Must not throw
        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
        })
        expect(result.entries).toHaveLength(1)
        expect((result.entries[0]! as { unranked: boolean }).unranked).toBe(false)
    })

    // getLeaderboard unranked-user fallback — Requirements 11.4, 11.5, 12.5

    test('returns userEntry with rank: null and unranked: true when userId has no sorted-set membership but solve hash exists with unranked: "true"', async () => {
        const postId = 't3_lb_unranked1'
        const difficulty = 'easy'
        const userId = 't2_lb_unranked1'
        // Seed hash only — no zAdd, simulating an unranked user
        await redis.hSet(`solve:${postId}:${difficulty}:${userId}`, {
            username: 'frank',
            completionTime: '120',
            hintsUsed: '1',
            mistakesCount: '0',
            adjustedTime: '150',
            notesUsed: 'false',
            unranked: 'true',
        })

        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
            userId,
        })
        expect(result.entries).toHaveLength(0)
        expect(result.userEntry).not.toBeNull()
        expect(result.userEntry!.rank).toBeNull()
        expect(result.userEntry!.unranked).toBe(true)
        expect(result.userEntry!.username).toBe('frank')
    })

    test('returns userEntry: null when userId has no sorted-set membership and no solve hash exists', async () => {
        const postId = 't3_lb_unranked2'
        const difficulty = 'easy'
        const userId = 't2_lb_unranked2'
        // No hash, no sorted-set entry

        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
            userId,
        })
        expect(result.entries).toHaveLength(0)
        expect(result.userEntry).toBeNull()
    })

    test('returns userEntry: null when userId has no sorted-set membership but solve hash exists with unranked: "false" (inconsistent state)', async () => {
        const postId = 't3_lb_unranked3'
        const difficulty = 'easy'
        const userId = 't2_lb_unranked3'
        // Hash exists with unranked: "false" but no sorted-set entry — inconsistent state
        await redis.hSet(`solve:${postId}:${difficulty}:${userId}`, {
            username: 'grace',
            completionTime: '200',
            hintsUsed: '0',
            mistakesCount: '0',
            adjustedTime: '200',
            notesUsed: 'false',
            unranked: 'false',
        })

        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
            userId,
        })
        expect(result.entries).toHaveLength(0)
        // Must not fabricate a rank — return null rather than a fake ranked entry
        expect(result.userEntry).toBeNull()
    })

    test('top-N entries never carry unranked: true (sorted set only holds ranked members)', async () => {
        const postId = 't3_lb_unranked4'
        const difficulty = 'easy'
        // Seed 3 ranked users via recordSolve (unranked: false)
        for (let i = 1; i <= 3; i++) {
            await recordSolve({
                redis,
                postId,
                userId: `t2_ranked_top${i}`,
                username: `rankeduser${i}`,
                difficulty,
                completionTime: i * 50,
                hintsUsed: 0,
                mistakesCount: 0,
                notesUsed: false,
                unranked: false,
            })
        }

        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
        })
        expect(result.entries).toHaveLength(3)
        for (const entry of result.entries) {
            expect(entry.unranked).toBe(false)
        }
    })

    test('when userId IS in the sorted set, existing in-top-N fallback path is unchanged and returns user entry with a numeric rank', async () => {
        const postId = 't3_lb_unranked5'
        const difficulty = 'easy'
        // Seed 12 ranked users so user1 is outside top 10
        for (let i = 1; i <= 12; i++) {
            await recordSolve({
                redis,
                postId,
                userId: `t2_ranked_u${i}`,
                username: `rankeduser${i}`,
                difficulty,
                completionTime: i * 10,
                hintsUsed: 0,
                mistakesCount: 0,
                notesUsed: false,
                unranked: false,
            })
        }

        // user12 is rank 12 — outside top 10
        const result = await getLeaderboard({
            redis,
            key: `leaderboard:${postId}:${difficulty}`,
            solveKeyPrefix: `solve:${postId}:${difficulty}`,
            userId: 't2_ranked_u12',
        })
        expect(result.entries).toHaveLength(10)
        expect(result.userEntry).not.toBeNull()
        expect(typeof result.userEntry!.rank).toBe('number')
        expect(result.userEntry!.rank).toBe(12)
        expect(result.userEntry!.unranked).toBe(false)
    })
})
