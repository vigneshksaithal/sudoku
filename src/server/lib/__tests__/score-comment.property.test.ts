import * as fc from 'fast-check'
import { describe, it } from 'vitest'

import { formatScoreComment } from '../score-comment'
import { validateSolveInput } from '../leaderboard'

const VALID_DIFFICULTIES = ['simple', 'easy', 'intermediate', 'expert'] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format seconds as m:ss — mirrors the pure function inside score-comment.ts */
const expectedFormattedTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Non-empty string for difficulty */
const difficultyArb = fc.string({ minLength: 1 })

/** Non-negative integer for time/hints/mistakes */
const nonNegativeIntArb = fc.nat()

/** A valid ScoreCommentData record (without notesUsed — used by Properties 1 & 2) */
const scoreCommentDataArb = fc.record({
    difficulty: difficultyArb,
    completionTime: nonNegativeIntArb,
    hintsUsed: nonNegativeIntArb,
    mistakesCount: nonNegativeIntArb,
    notesUsed: fc.boolean(),
})

/** A valid ScoreCommentData record with explicit boolean notesUsed */
const scoreCommentDataWithNotesArb = fc.record({
    difficulty: difficultyArb,
    completionTime: nonNegativeIntArb,
    hintsUsed: nonNegativeIntArb,
    mistakesCount: nonNegativeIntArb,
    notesUsed: fc.boolean(),
})

// ---------------------------------------------------------------------------
// Property 1: Score comment format completeness
// ---------------------------------------------------------------------------

describe('Property 1: Score comment format completeness', () => {
    /**
     * Feature: devvit-review-compliance, Property 1: Score comment format completeness
     *
     * For any valid ScoreCommentData, the formatted comment SHALL contain:
     * - the difficulty name
     * - the solve time formatted as m:ss
     * - the hints used count
     * - the mistakes count
     *
     * Validates: Requirements 5.4, 7.1
     */
    it('output contains difficulty name, formatted time, hints count, and mistakes count', () => {
        fc.assert(
            fc.property(scoreCommentDataArb, (data) => {
                const result = formatScoreComment(data)
                const formattedTime = expectedFormattedTime(data.completionTime)

                const containsDifficulty = result.includes(data.difficulty)
                const containsTime = result.includes(formattedTime)
                const containsHints = result.includes(String(data.hintsUsed))
                const containsMistakes = result.includes(String(data.mistakesCount))

                return containsDifficulty && containsTime && containsHints && containsMistakes
            }),
            { numRuns: 100 }
        )
    })
})

// ---------------------------------------------------------------------------
// Property 2: Perfect solve indicator correctness
// ---------------------------------------------------------------------------

describe('Property 2: Perfect solve indicator correctness', () => {
    /**
     * Feature: devvit-review-compliance, Property 2: Perfect solve indicator correctness
     *
     * For any valid ScoreCommentData, the formatted score comment text SHALL contain
     * "Perfect solve!" if and only if hintsUsed equals 0 and mistakesCount equals 0.
     *
     * Validates: Requirements 7.2
     */

    it('"Perfect solve!" is present when hintsUsed=0 and mistakesCount=0', () => {
        const perfectDataArb = fc.record({
            difficulty: difficultyArb,
            completionTime: nonNegativeIntArb,
            hintsUsed: fc.constant(0),
            mistakesCount: fc.constant(0),
        })

        fc.assert(
            fc.property(perfectDataArb, (data) => {
                const result = formatScoreComment(data)
                return result.includes('Perfect solve!')
            }),
            { numRuns: 100 }
        )
    })

    it('"Perfect solve!" is absent when hintsUsed>0 or mistakesCount>0', () => {
        // Generate data where at least one of hintsUsed or mistakesCount is non-zero
        const nonPerfectDataArb = fc
            .record({
                difficulty: difficultyArb,
                completionTime: nonNegativeIntArb,
                extra: fc.oneof(
                    fc.record({ hintsUsed: fc.nat({ min: 1 }), mistakesCount: fc.nat() }),
                    fc.record({ hintsUsed: fc.nat(), mistakesCount: fc.nat({ min: 1 }) })
                ),
            })
            .map(({ difficulty, completionTime, extra }) => ({
                difficulty,
                completionTime,
                hintsUsed: extra.hintsUsed,
                mistakesCount: extra.mistakesCount,
            }))

        fc.assert(
            fc.property(nonPerfectDataArb, (data) => {
                const result = formatScoreComment(data)
                return !result.includes('Perfect solve!')
            }),
            { numRuns: 100 }
        )
    })

    it('"Perfect solve!" is present if and only if hintsUsed===0 and mistakesCount===0', () => {
        fc.assert(
            fc.property(scoreCommentDataArb, (data) => {
                const result = formatScoreComment(data)
                const isPerfect = data.hintsUsed === 0 && data.mistakesCount === 0
                const hasPerfectIndicator = result.includes('Perfect solve!')
                return isPerfect === hasPerfectIndicator
            }),
            { numRuns: 100 }
        )
    })
})

// ---------------------------------------------------------------------------
// Property 3: Score endpoint input validation
// ---------------------------------------------------------------------------

describe('Property 3: Score endpoint input validation', () => {
    /**
     * Feature: devvit-review-compliance, Property 3: Score endpoint input validation
     *
     * For any JSON payload, validateSolveInput SHALL return a string (error) if and
     * only if the payload is invalid — i.e. it is missing any required field, has a
     * field of the wrong type, has a negative number, has a non-integer number, or
     * has an unrecognised difficulty string.
     *
     * Valid payload: valid difficulty string, non-negative integer completionTime,
     * non-negative integer hintsUsed, non-negative integer mistakesCount.
     *
     * Validates: Requirements 5.1
     */

    // ── Arbitraries ──────────────────────────────────────────────────────────

    /** A valid difficulty string */
    const validDifficultyArb = fc.constantFrom(...VALID_DIFFICULTIES)

    /** A non-negative integer */
    const nonNegativeIntArb = fc.nat()

    /** A valid payload — validateSolveInput must accept this */
    const validPayloadArb = fc.record({
        difficulty: validDifficultyArb,
        completionTime: nonNegativeIntArb,
        hintsUsed: nonNegativeIntArb,
        mistakesCount: nonNegativeIntArb,
        notesUsed: fc.boolean(),
    })

    /** An invalid difficulty: any string not in the valid set */
    const invalidDifficultyArb = fc.string().filter(
        (s) => !(VALID_DIFFICULTIES as readonly string[]).includes(s)
    )

    /** A negative integer */
    const negativeIntArb = fc.integer({ max: -1 })

    /** A non-integer number (float with fractional part) */
    const nonIntegerNumberArb = fc
        .float({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true })
        .filter((n) => !Number.isInteger(n))

    /** Any non-number value for a numeric field */
    const nonNumberArb = fc.oneof(
        fc.string(),
        fc.boolean(),
        fc.constant(null),
        fc.constant(undefined),
        fc.record({ x: fc.nat() }),
        fc.array(fc.nat()),
    )

    // ── Tests ─────────────────────────────────────────────────────────────────

    it('accepts valid payloads (returns parsed object, not a string)', () => {
        fc.assert(
            fc.property(validPayloadArb, (payload) => {
                const result = validateSolveInput(payload)
                return typeof result !== 'string'
            }),
            { numRuns: 100 }
        )
    })

    it('rejects payloads with an invalid difficulty string', () => {
        const arb = fc.record({
            difficulty: invalidDifficultyArb,
            completionTime: nonNegativeIntArb,
            hintsUsed: nonNegativeIntArb,
            mistakesCount: nonNegativeIntArb,
        })
        fc.assert(
            fc.property(arb, (payload) => {
                const result = validateSolveInput(payload)
                return typeof result === 'string'
            }),
            { numRuns: 100 }
        )
    })

    it('rejects payloads with a negative completionTime', () => {
        const arb = fc.record({
            difficulty: validDifficultyArb,
            completionTime: negativeIntArb,
            hintsUsed: nonNegativeIntArb,
            mistakesCount: nonNegativeIntArb,
        })
        fc.assert(
            fc.property(arb, (payload) => {
                const result = validateSolveInput(payload)
                return typeof result === 'string'
            }),
            { numRuns: 100 }
        )
    })

    it('rejects payloads with a negative hintsUsed', () => {
        const arb = fc.record({
            difficulty: validDifficultyArb,
            completionTime: nonNegativeIntArb,
            hintsUsed: negativeIntArb,
            mistakesCount: nonNegativeIntArb,
        })
        fc.assert(
            fc.property(arb, (payload) => {
                const result = validateSolveInput(payload)
                return typeof result === 'string'
            }),
            { numRuns: 100 }
        )
    })

    it('rejects payloads with a negative mistakesCount', () => {
        const arb = fc.record({
            difficulty: validDifficultyArb,
            completionTime: nonNegativeIntArb,
            hintsUsed: nonNegativeIntArb,
            mistakesCount: negativeIntArb,
        })
        fc.assert(
            fc.property(arb, (payload) => {
                const result = validateSolveInput(payload)
                return typeof result === 'string'
            }),
            { numRuns: 100 }
        )
    })

    it('rejects payloads with a non-integer completionTime', () => {
        const arb = fc.record({
            difficulty: validDifficultyArb,
            completionTime: nonIntegerNumberArb,
            hintsUsed: nonNegativeIntArb,
            mistakesCount: nonNegativeIntArb,
        })
        fc.assert(
            fc.property(arb, (payload) => {
                const result = validateSolveInput(payload)
                return typeof result === 'string'
            }),
            { numRuns: 100 }
        )
    })

    it('rejects payloads with a non-integer hintsUsed', () => {
        const arb = fc.record({
            difficulty: validDifficultyArb,
            completionTime: nonNegativeIntArb,
            hintsUsed: nonIntegerNumberArb,
            mistakesCount: nonNegativeIntArb,
        })
        fc.assert(
            fc.property(arb, (payload) => {
                const result = validateSolveInput(payload)
                return typeof result === 'string'
            }),
            { numRuns: 100 }
        )
    })

    it('rejects payloads with a non-integer mistakesCount', () => {
        const arb = fc.record({
            difficulty: validDifficultyArb,
            completionTime: nonNegativeIntArb,
            hintsUsed: nonNegativeIntArb,
            mistakesCount: nonIntegerNumberArb,
        })
        fc.assert(
            fc.property(arb, (payload) => {
                const result = validateSolveInput(payload)
                return typeof result === 'string'
            }),
            { numRuns: 100 }
        )
    })

    it('rejects payloads where a numeric field is not a number', () => {
        // Pick one of the three numeric fields at random and replace it with a non-number
        const arb = fc.record({
            difficulty: validDifficultyArb,
            completionTime: nonNegativeIntArb,
            hintsUsed: nonNegativeIntArb,
            mistakesCount: nonNegativeIntArb,
            // which field to corrupt and what to replace it with
            corruptField: fc.constantFrom('completionTime', 'hintsUsed', 'mistakesCount' as const),
            badValue: nonNumberArb,
        }).map(({ difficulty, completionTime, hintsUsed, mistakesCount, corruptField, badValue }) => ({
            difficulty,
            completionTime: corruptField === 'completionTime' ? badValue : completionTime,
            hintsUsed: corruptField === 'hintsUsed' ? badValue : hintsUsed,
            mistakesCount: corruptField === 'mistakesCount' ? badValue : mistakesCount,
        }))

        fc.assert(
            fc.property(arb, (payload) => {
                const result = validateSolveInput(payload)
                return typeof result === 'string'
            }),
            { numRuns: 100 }
        )
    })

    it('rejects null and non-object bodies', () => {
        const nonObjectArb = fc.oneof(
            fc.constant(null),
            fc.string(),
            fc.integer(),
            fc.boolean(),
        )
        fc.assert(
            fc.property(nonObjectArb, (payload) => {
                const result = validateSolveInput(payload)
                return typeof result === 'string'
            }),
            { numRuns: 100 }
        )
    })

    it('accepts iff payload has valid difficulty, non-negative integer numeric fields (bimodal)', () => {
        // Mix valid and invalid payloads; verify acceptance matches validity
        const payloadArb = fc.oneof(
            // valid
            validPayloadArb.map((p) => ({ payload: p as unknown, valid: true })),
            // invalid difficulty
            fc.record({
                difficulty: invalidDifficultyArb,
                completionTime: nonNegativeIntArb,
                hintsUsed: nonNegativeIntArb,
                mistakesCount: nonNegativeIntArb,
                notesUsed: fc.boolean(),
            }).map((p) => ({ payload: p as unknown, valid: false })),
            // negative numeric field
            fc.record({
                difficulty: validDifficultyArb,
                completionTime: fc.oneof(nonNegativeIntArb, negativeIntArb),
                hintsUsed: fc.oneof(nonNegativeIntArb, negativeIntArb),
                mistakesCount: fc.oneof(nonNegativeIntArb, negativeIntArb),
                notesUsed: fc.boolean(),
            }).map((p) => ({
                payload: p as unknown,
                valid: p.completionTime >= 0 && p.hintsUsed >= 0 && p.mistakesCount >= 0,
            })),
        )

        fc.assert(
            fc.property(payloadArb, ({ payload, valid }) => {
                const result = validateSolveInput(payload)
                const accepted = typeof result !== 'string'
                return accepted === valid
            }),
            { numRuns: 100 }
        )
    })
})

// ---------------------------------------------------------------------------
// Property 3: Score comment includes notes indicator
// ---------------------------------------------------------------------------

describe('Property 3: Score comment includes notes indicator', () => {
    /**
     * Feature: candidate-size-and-notes-leaderboard, Property 3
     *
     * For any valid ScoreCommentData with boolean notesUsed, the output of
     * formatScoreComment SHALL contain "📝 Notes | Yes |" when notesUsed is true,
     * and "📝 Notes | No |" when notesUsed is false. The presence of "Yes" in the
     * notes row corresponds exactly to notesUsed === true.
     *
     * Validates: Requirements 6.2
     */

    it('contains "📝 Notes | Yes |" when notesUsed is true', () => {
        const trueNotesArb = scoreCommentDataWithNotesArb.filter((d) => d.notesUsed === true)

        fc.assert(
            fc.property(trueNotesArb, (data) => {
                const result = formatScoreComment(data)
                return result.includes('📝 Notes | Yes |')
            }),
            { numRuns: 100 }
        )
    })

    it('contains "📝 Notes | No |" when notesUsed is false', () => {
        const falseNotesArb = scoreCommentDataWithNotesArb.filter((d) => d.notesUsed === false)

        fc.assert(
            fc.property(falseNotesArb, (data) => {
                const result = formatScoreComment(data)
                return result.includes('📝 Notes | No |')
            }),
            { numRuns: 100 }
        )
    })

    it('"Yes" in notes row corresponds exactly to notesUsed === true', () => {
        fc.assert(
            fc.property(scoreCommentDataWithNotesArb, (data) => {
                const result = formatScoreComment(data)
                const hasYes = result.includes('📝 Notes | Yes |')
                const hasNo = result.includes('📝 Notes | No |')
                // Exactly one of Yes/No is present, and it matches notesUsed
                return hasYes === data.notesUsed && hasNo === !data.notesUsed
            }),
            { numRuns: 100 }
        )
    })
})
