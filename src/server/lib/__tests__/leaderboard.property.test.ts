/**
 * Property-based tests for leaderboard.ts
 * Feature: leaderboards
 */

import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis } from '@devvit/redis'
import * as fc from 'fast-check'
import { expect } from 'vitest'

import {
    computeAdjustedTime,
    validateSolveInput,
    recordSolve,
    getLeaderboard,
} from '../leaderboard'
import { DIFFICULTIES } from '../sudoku'

const test = createDevvitTest()

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const arbNonNegInt = fc.integer({ min: 0, max: 10_000 })
const arbDifficulty = fc.constantFrom(...DIFFICULTIES)
const arbUserId = fc.string({ minLength: 1, maxLength: 10 }).map((s) => `t2_${s}`)
const arbPostId = fc.string({ minLength: 1, maxLength: 10 }).map((s) => `t3_${s}`)
const arbUsername = fc.string({ minLength: 1, maxLength: 20 })

const arbValidSolveInput = fc.record({
    difficulty: arbDifficulty,
    completionTime: arbNonNegInt,
    hintsUsed: arbNonNegInt,
    mistakesCount: arbNonNegInt,
})

// ─── Property 1: Solve record round-trip ─────────────────────────────────────
/**
 * **Validates: Requirements 1.1, 1.2, 10.3, 10.5**
 *
 * For any valid solve input, writing then reading back produces equivalent values.
 */
test('Property 1: Solve record round-trip', async () => {
    await fc.assert(
        fc.asyncProperty(
            arbPostId,
            arbUserId,
            arbUsername,
            arbValidSolveInput,
            async (postId, userId, username, input) => {
                const { difficulty, completionTime, hintsUsed, mistakesCount } = input
                const result = await recordSolve({
                    redis,
                    postId,
                    userId,
                    username,
                    difficulty,
                    completionTime,
                    hintsUsed,
                    mistakesCount,
                })
                // Should succeed (fresh redis per test)
                expect(typeof result).toBe('object')

                const data = await redis.hGetAll(`solve:${postId}:${difficulty}:${userId}`)
                expect(data['username']).toBe(username)
                expect(parseInt(data['completionTime']!, 10)).toBe(completionTime)
                expect(parseInt(data['hintsUsed']!, 10)).toBe(hintsUsed)
                expect(parseInt(data['mistakesCount']!, 10)).toBe(mistakesCount)
                expect(parseInt(data['adjustedTime']!, 10)).toBe(computeAdjustedTime(completionTime, hintsUsed))
            }
        ),
        { numRuns: 100 }
    )
})

// ─── Property 2: Adjusted time computation ───────────────────────────────────
/**
 * **Validates: Requirements 1.6, 4.4**
 *
 * For any non-negative completionTime and hintsUsed, result equals completionTime + hintsUsed * 30.
 */
test('Property 2: Adjusted time computation', () => {
    fc.assert(
        fc.property(arbNonNegInt, arbNonNegInt, (completionTime, hintsUsed) => {
            const result = computeAdjustedTime(completionTime, hintsUsed)
            expect(result).toBe(completionTime + hintsUsed * 30)
        }),
        { numRuns: 1000 }
    )
})

// ─── Property 3: Global leaderboard tracks minimum adjusted time ──────────────
/**
 * **Validates: Requirements 1.3, 1.4**
 *
 * For any sequence of solves by the same user across different posts,
 * global score equals the minimum adjusted time.
 */
test('Property 3: Global leaderboard minimum', async () => {
    await fc.assert(
        fc.asyncProperty(
            arbUserId,
            arbUsername,
            arbDifficulty,
            fc.array(
                fc.record({ completionTime: arbNonNegInt, hintsUsed: arbNonNegInt }),
                { minLength: 1, maxLength: 8 }
            ),
            async (userId, username, difficulty, solves) => {
                // Use unique postIds to avoid duplicate rejection
                const adjustedTimes: number[] = []
                for (let i = 0; i < solves.length; i++) {
                    const solve = solves[i]!
                    const postId = `t3_prop3_${i}_${userId.slice(3)}`
                    await recordSolve({
                        redis,
                        postId,
                        userId,
                        username,
                        difficulty,
                        completionTime: solve.completionTime,
                        hintsUsed: solve.hintsUsed,
                        mistakesCount: 0,
                    })
                    adjustedTimes.push(computeAdjustedTime(solve.completionTime, solve.hintsUsed))
                }

                const expectedMin = Math.min(...adjustedTimes)
                const globalScore = await redis.zScore(`leaderboard:global:${difficulty}`, userId)
                expect(globalScore).toBe(expectedMin)
            }
        ),
        { numRuns: 50 }
    )
})

// ─── Property 4: Duplicate solve rejection preserves original ─────────────────
/**
 * **Validates: Requirements 1.5, 10.4**
 *
 * For any valid solve, a second submission is rejected and original data is unchanged.
 */
test('Property 4: Duplicate solve rejection preserves original', async () => {
    await fc.assert(
        fc.asyncProperty(
            arbPostId,
            arbUserId,
            arbUsername,
            arbValidSolveInput,
            fc.record({ completionTime: arbNonNegInt, hintsUsed: arbNonNegInt, mistakesCount: arbNonNegInt }),
            async (postId, userId, username, original, second) => {
                const { difficulty, completionTime, hintsUsed, mistakesCount } = original

                // First solve — should succeed
                await recordSolve({
                    redis,
                    postId,
                    userId,
                    username,
                    difficulty,
                    completionTime,
                    hintsUsed,
                    mistakesCount,
                })

                // Second solve — should be rejected
                const secondResult = await recordSolve({
                    redis,
                    postId,
                    userId,
                    username: 'other',
                    difficulty,
                    completionTime: second.completionTime,
                    hintsUsed: second.hintsUsed,
                    mistakesCount: second.mistakesCount,
                })
                expect(typeof secondResult).toBe('string')

                // Original data should be unchanged
                const data = await redis.hGetAll(`solve:${postId}:${difficulty}:${userId}`)
                expect(data['username']).toBe(username)
                expect(parseInt(data['completionTime']!, 10)).toBe(completionTime)
                expect(parseInt(data['hintsUsed']!, 10)).toBe(hintsUsed)
                expect(parseInt(data['mistakesCount']!, 10)).toBe(mistakesCount)
            }
        ),
        { numRuns: 100 }
    )
})

// ─── Property 5: Invalid input rejection ─────────────────────────────────────
/**
 * **Validates: Requirements 1.8, 8.4, 8.5**
 *
 * For any invalid numeric field (negative, float, string, null), validateSolveInput returns an error string.
 */
test('Property 5: Invalid input rejection', () => {
    // Negative numbers
    fc.assert(
        fc.property(
            fc.integer({ min: -10_000, max: -1 }),
            fc.constantFrom('completionTime', 'hintsUsed', 'mistakesCount') as fc.Arbitrary<'completionTime' | 'hintsUsed' | 'mistakesCount'>,
            (negValue, field) => {
                const body = { difficulty: 'easy', completionTime: 0, hintsUsed: 0, mistakesCount: 0, [field]: negValue }
                const result = validateSolveInput(body)
                expect(typeof result).toBe('string')
            }
        ),
        { numRuns: 200 }
    )

    // Floats (non-integer positive numbers)
    fc.assert(
        fc.property(
            fc.integer({ min: 1, max: 9_999 }).map((n) => n + 0.5), // guaranteed non-integer
            fc.constantFrom('completionTime', 'hintsUsed', 'mistakesCount') as fc.Arbitrary<'completionTime' | 'hintsUsed' | 'mistakesCount'>,
            (floatValue, field) => {
                const body = { difficulty: 'easy', completionTime: 0, hintsUsed: 0, mistakesCount: 0, [field]: floatValue }
                const result = validateSolveInput(body)
                expect(typeof result).toBe('string')
            }
        ),
        { numRuns: 200 }
    )

    // Strings for numeric fields
    fc.assert(
        fc.property(
            fc.string(),
            fc.constantFrom('completionTime', 'hintsUsed', 'mistakesCount') as fc.Arbitrary<'completionTime' | 'hintsUsed' | 'mistakesCount'>,
            (strValue, field) => {
                const body = { difficulty: 'easy', completionTime: 0, hintsUsed: 0, mistakesCount: 0, [field]: strValue }
                const result = validateSolveInput(body)
                expect(typeof result).toBe('string')
            }
        ),
        { numRuns: 200 }
    )

    // Null for numeric fields
    fc.assert(
        fc.property(
            fc.constantFrom('completionTime', 'hintsUsed', 'mistakesCount') as fc.Arbitrary<'completionTime' | 'hintsUsed' | 'mistakesCount'>,
            (field) => {
                const body = { difficulty: 'easy', completionTime: 0, hintsUsed: 0, mistakesCount: 0, [field]: null }
                const result = validateSolveInput(body)
                expect(typeof result).toBe('string')
            }
        ),
        { numRuns: 50 }
    )
})

// ─── Property 6: Leaderboard ordering invariant ───────────────────────────────
/**
 * **Validates: Requirements 2.1, 3.1**
 *
 * For any set of solves, returned entries are sorted ascending by adjustedTime with length ≤ 10.
 */
test('Property 6: Leaderboard ordering', async () => {
    await fc.assert(
        fc.asyncProperty(
            fc.array(
                fc.record({
                    userId: arbUserId,
                    username: arbUsername,
                    completionTime: arbNonNegInt,
                    hintsUsed: arbNonNegInt,
                }),
                { minLength: 1, maxLength: 15 }
            ),
            arbDifficulty,
            async (solves, difficulty) => {
                const postId = `t3_prop6_${difficulty}`
                const seenUserIds = new Set<string>()

                for (const solve of solves) {
                    if (seenUserIds.has(solve.userId)) continue
                    seenUserIds.add(solve.userId)
                    await recordSolve({
                        redis,
                        postId,
                        userId: solve.userId,
                        username: solve.username,
                        difficulty,
                        completionTime: solve.completionTime,
                        hintsUsed: solve.hintsUsed,
                        mistakesCount: 0,
                    })
                }

                const result = await getLeaderboard({
                    redis,
                    key: `leaderboard:${postId}:${difficulty}`,
                    solveKeyPrefix: `solve:${postId}:${difficulty}`,
                })

                // Length ≤ 10
                expect(result.entries.length).toBeLessThanOrEqual(10)

                // Sorted ascending by adjustedTime
                for (let i = 1; i < result.entries.length; i++) {
                    expect(result.entries[i]!.adjustedTime).toBeGreaterThanOrEqual(result.entries[i - 1]!.adjustedTime)
                }

                // Ranks are 1-indexed and sequential
                for (let i = 0; i < result.entries.length; i++) {
                    expect(result.entries[i]!.rank).toBe(i + 1)
                }
            }
        ),
        { numRuns: 50 }
    )
})
