import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis } from '@devvit/redis'
import { expect } from 'vitest'
import {
    checkCooldown,
    setCooldown,
    addToSubmissionHistory,
    getSubmissionHistory,
    incrementSolveCount,
    COOLDOWN_SECONDS,
} from '../community-submit'

const test = createDevvitTest()

// ─── checkCooldown ────────────────────────────────────────────────────────────

test('checkCooldown returns allowed when no cooldown key exists', async () => {
    const result = await checkCooldown(redis, 't2_user1')
    expect(result).toEqual({ allowed: true })
})

test('checkCooldown returns not allowed with remainingSeconds when cooldown is active', async () => {
    await redis.set('cooldown:t2_user2', '1')
    await redis.expire('cooldown:t2_user2', 500)

    const result = await checkCooldown(redis, 't2_user2')
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
        // remainingSeconds is computed from absolute expiry timestamp minus now;
        // allow +1 for rounding at second boundaries
        expect(result.remainingSeconds).toBeGreaterThan(0)
        expect(result.remainingSeconds).toBeLessThanOrEqual(501)
    }
})

test('checkCooldown returns allowed when key has no TTL set', async () => {
    // Key exists but with no TTL — expireTime returns 0 — treated as no cooldown
    await redis.set('cooldown:t2_user3', '1')
    // No expire set — expireTime returns 0

    const result = await checkCooldown(redis, 't2_user3')
    expect(result).toEqual({ allowed: true })
})

// ─── setCooldown ──────────────────────────────────────────────────────────────

test('setCooldown sets cooldown key with a future expiry timestamp', async () => {
    const before = Math.floor(Date.now() / 1000)
    await setCooldown(redis, 't2_user4')

    // expireTime returns absolute Unix timestamp in seconds
    const expiresAt = await redis.expireTime('cooldown:t2_user4')
    expect(expiresAt).toBeGreaterThan(before)
    expect(expiresAt).toBeLessThanOrEqual(before + COOLDOWN_SECONDS + 2)
})

test('setCooldown makes checkCooldown return not allowed', async () => {
    await setCooldown(redis, 't2_user5')

    const result = await checkCooldown(redis, 't2_user5')
    expect(result.allowed).toBe(false)
})

// ─── addToSubmissionHistory ───────────────────────────────────────────────────

test('addToSubmissionHistory adds postId to sorted set with timestamp score', async () => {
    const timestamp = Date.now()
    await addToSubmissionHistory(redis, 't2_user6', 't3_post1', timestamp)

    const entries = await redis.zRange('submissions:t2_user6', 0, -1, { by: 'rank' })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.member).toBe('t3_post1')
    expect(entries[0]?.score).toBe(timestamp)
})

test('addToSubmissionHistory preserves insertion order by timestamp', async () => {
    const t1 = 1000
    const t2 = 2000
    await addToSubmissionHistory(redis, 't2_user7', 't3_postA', t1)
    await addToSubmissionHistory(redis, 't2_user7', 't3_postB', t2)

    const entries = await redis.zRange('submissions:t2_user7', 0, -1, { by: 'rank' })
    expect(entries.map((e) => e.member)).toEqual(['t3_postA', 't3_postB'])
})

// ─── getSubmissionHistory ─────────────────────────────────────────────────────

test('getSubmissionHistory returns empty array when no submissions', async () => {
    const result = await getSubmissionHistory(redis, 't2_nosubmissions')
    expect(result).toEqual([])
})

test('getSubmissionHistory returns entries with puzzle metadata', async () => {
    const timestamp = 1700000000000
    await addToSubmissionHistory(redis, 't2_user8', 't3_post2', timestamp)
    await redis.hSet('puzzle:t3_post2', {
        difficulty: 'intermediate',
        createdAt: String(timestamp),
        solveCount: '7',
    })

    const result = await getSubmissionHistory(redis, 't2_user8')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
        postId: 't3_post2',
        difficulty: 'intermediate',
        createdAt: timestamp,
        solveCount: 7,
    })
})

test('getSubmissionHistory skips entries with missing puzzle hash', async () => {
    const timestamp = 1700000000001
    await addToSubmissionHistory(redis, 't2_user9', 't3_missing', timestamp)
    // No puzzle hash stored for t3_missing

    const result = await getSubmissionHistory(redis, 't2_user9')
    expect(result).toEqual([])
})

test('getSubmissionHistory returns multiple entries ordered by timestamp', async () => {
    const t1 = 1700000000000
    const t2 = 1700000001000
    await addToSubmissionHistory(redis, 't2_user10', 't3_postX', t1)
    await addToSubmissionHistory(redis, 't2_user10', 't3_postY', t2)
    await redis.hSet('puzzle:t3_postX', {
        difficulty: 'simple',
        createdAt: String(t1),
        solveCount: '0',
    })
    await redis.hSet('puzzle:t3_postY', {
        difficulty: 'expert',
        createdAt: String(t2),
        solveCount: '3',
    })

    const result = await getSubmissionHistory(redis, 't2_user10')
    expect(result).toHaveLength(2)
    expect(result[0]?.postId).toBe('t3_postX')
    expect(result[1]?.postId).toBe('t3_postY')
})

// ─── incrementSolveCount ──────────────────────────────────────────────────────

test('incrementSolveCount initializes and increments from 0', async () => {
    await redis.hSet('puzzle:t3_post3', { difficulty: 'easy', createdAt: '1700000000000' })
    // solveCount not set — starts at 0

    const result = await incrementSolveCount(redis, 't3_post3')
    expect(result).toBe(1)
})

test('incrementSolveCount increments existing solve count', async () => {
    await redis.hSet('puzzle:t3_post4', {
        difficulty: 'easy',
        createdAt: '1700000000000',
        solveCount: '5',
    })

    const result = await incrementSolveCount(redis, 't3_post4')
    expect(result).toBe(6)
})

test('incrementSolveCount returns updated value on each call', async () => {
    await redis.hSet('puzzle:t3_post5', { difficulty: 'easy', createdAt: '1700000000000', solveCount: '0' })

    const first = await incrementSolveCount(redis, 't3_post5')
    const second = await incrementSolveCount(redis, 't3_post5')
    expect(first).toBe(1)
    expect(second).toBe(2)
})

// ─── Property 5: Rate limiting rejects submissions within cooldown ────────────
/**
 * **Validates: Requirements 8.1, 8.2**
 *
 * For any userId, after setCooldown is called, checkCooldown must return
 * { allowed: false } with remainingSeconds > 0 and <= COOLDOWN_SECONDS.
 * This invariant holds regardless of the userId value.
 */
import * as fc from 'fast-check'

const arbUserId = fc.string({ minLength: 1, maxLength: 20 }).map((s) => `t2_${s}`)

test('Property 5: Rate limiting rejects submissions within cooldown', async () => {
    await fc.assert(
        fc.asyncProperty(arbUserId, async (userId) => {
            await setCooldown(redis, userId)
            const result = await checkCooldown(redis, userId)

            expect(result.allowed).toBe(false)
            if (!result.allowed) {
                expect(result.remainingSeconds).toBeGreaterThan(0)
                // Allow +1 for rounding at second boundaries (same tolerance as unit tests)
                expect(result.remainingSeconds).toBeLessThanOrEqual(COOLDOWN_SECONDS + 1)
            }
        }),
        { numRuns: 100 }
    )
})
