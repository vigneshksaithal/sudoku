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
        })
        expect(result).toEqual({
            difficulty: 'easy',
            completionTime: 120,
            hintsUsed: 2,
            mistakesCount: 3,
        })
    })

    it('accepts all valid difficulties', () => {
        for (const d of ['simple', 'easy', 'intermediate', 'expert']) {
            const result = validateSolveInput({ difficulty: d, completionTime: 0, hintsUsed: 0, mistakesCount: 0 })
            expect(typeof result).toBe('object')
        }
    })

    it('returns error string for invalid difficulty', () => {
        const result = validateSolveInput({ difficulty: 'hard', completionTime: 0, hintsUsed: 0, mistakesCount: 0 })
        expect(typeof result).toBe('string')
    })

    it('returns error string for negative completionTime', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: -1, hintsUsed: 0, mistakesCount: 0 })
        expect(typeof result).toBe('string')
    })

    it('returns error string for negative hintsUsed', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 0, hintsUsed: -5, mistakesCount: 0 })
        expect(typeof result).toBe('string')
    })

    it('returns error string for negative mistakesCount', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 0, hintsUsed: 0, mistakesCount: -1 })
        expect(typeof result).toBe('string')
    })

    it('returns error string for float completionTime', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 1.5, hintsUsed: 0, mistakesCount: 0 })
        expect(typeof result).toBe('string')
    })

    it('returns error string for float hintsUsed', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: 0, hintsUsed: 0.5, mistakesCount: 0 })
        expect(typeof result).toBe('string')
    })

    it('returns error string for string completionTime', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: '120', hintsUsed: 0, mistakesCount: 0 })
        expect(typeof result).toBe('string')
    })

    it('returns error string for null completionTime', () => {
        const result = validateSolveInput({ difficulty: 'easy', completionTime: null, hintsUsed: 0, mistakesCount: 0 })
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
        const result = validateSolveInput({ difficulty: 'simple', completionTime: 0, hintsUsed: 0, mistakesCount: 0 })
        expect(typeof result).toBe('object')
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
})
