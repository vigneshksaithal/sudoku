import * as fc from 'fast-check'
import { describe, it } from 'vitest'
import { isMistake } from '../app-logic'

describe('leaderboard property tests', () => {
    /**
     * Feature: leaderboards, Property 7
     * Mistakes increment only on solution mismatch — for any cell position (0–80)
     * and digit (1–9), isMistake returns true if and only if digit !== solution[cellIndex].
     *
     * **Validates: Requirements 4.1, 4.2**
     */
    it('Property 7: isMistake returns true iff digit !== solution[cellIndex]', () => {
        // Arbitrary: a flat solution array of 81 digits (1–9)
        const solutionArb = fc.array(fc.integer({ min: 1, max: 9 }), {
            minLength: 81,
            maxLength: 81,
        })
        // Arbitrary: a valid cell index (0–80)
        const cellIndexArb = fc.integer({ min: 0, max: 80 })
        // Arbitrary: a digit (1–9)
        const digitArb = fc.integer({ min: 1, max: 9 })

        fc.assert(
            fc.property(solutionArb, cellIndexArb, digitArb, (solution, cellIndex, digit) => {
                const result = isMistake(solution, cellIndex, digit)
                const expected = digit !== solution[cellIndex]
                return result === expected
            }),
            { numRuns: 100 },
        )
    })
})
