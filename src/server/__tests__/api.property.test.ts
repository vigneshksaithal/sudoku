// Feature: sudoku-game, Property 5: Validation returns true if and only if board matches solution

import { Header } from '@devvit/shared-types/Header.js'
import { MOCK_HEADERS } from '@devvit/shared-types/test/index.js'
import { createDevvitTest } from '@devvit/test/server/vitest'
import { context, redis } from '@devvit/web/server'
import * as fc from 'fast-check'
import { expect } from 'vitest'

    // Inject postId into the test context
    ; (MOCK_HEADERS as Record<string, string>)[Header.Post] = 't3_testpost'

import { app } from '../index'

const test = createDevvitTest()

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

// Generates an 81-char string of digits 1-9 paired with a single-cell mutation:
// { solution, mismatchedBoard } where mismatchedBoard differs from solution at exactly one index
const validationScenarioArb = fc
    .array(fc.constantFrom(...DIGITS), { minLength: 81, maxLength: 81 })
    .chain((chars) =>
        fc.integer({ min: 0, max: 80 }).chain((idx) => {
            const original = chars[idx]!
            const otherDigits = DIGITS.filter((d) => d !== original) as [string, ...string[]]
            return fc.constantFrom(...otherDigits).map((replacement) => {
                const solution = chars.join('')
                const mismatchedBoard = solution.slice(0, idx) + replacement + solution.slice(idx + 1)
                return { solution, mismatchedBoard }
            })
        })
    )

/**
 * **Validates: Requirements 5.1, 5.2, 5.3**
 *
 * Property 5: Validation returns true if and only if board matches solution.
 * - Submitting the exact solution string returns { valid: true }
 * - Submitting a board that differs in at least one cell returns { valid: false }
 */
test('Property 5: validation returns true iff board matches solution', async () => {
    const postId = context.postId!
    const difficulty = 'easy'

    await fc.assert(
        fc.asyncProperty(validationScenarioArb, async ({ solution, mismatchedBoard }) => {
            // Seed Redis with the generated solution
            await redis.hSet(`puzzle:${postId}`, {
                [`${difficulty}:solution`]: solution,
                [`${difficulty}:puzzle`]: '0'.repeat(81),
            })

            // Case 1: exact match → valid: true
            const matchRes = await app.request('/api/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ board: solution, difficulty }),
            })
            const matchJson = await matchRes.json()
            expect(matchRes.status).toBe(200)
            expect(matchJson).toEqual({ valid: true })

            // Case 2: one cell changed → valid: false
            const mismatchRes = await app.request('/api/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ board: mismatchedBoard, difficulty }),
            })
            const mismatchJson = await mismatchRes.json()
            expect(mismatchRes.status).toBe(200)
            expect(mismatchJson).toEqual({ valid: false })
        }),
        { numRuns: 100 }
    )
})
