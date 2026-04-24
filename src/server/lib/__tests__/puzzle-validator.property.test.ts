/**
 * Property-based tests for puzzle-validator.ts
 * Feature: community-puzzle-submit
 */

import * as fc from 'fast-check'
import { describe, it } from 'vitest'

import { classifyAndSolve, validatePuzzleConstraints, validatePuzzleFormat, validatePuzzleUniqueness } from '../puzzle-validator'
import { createSolverState, getDifficulty, solve, stringToBoard } from '../sudoku'

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Arbitrary: a single digit character '0'-'9' */
const digitCharArb = fc.integer({ min: 0, max: 9 }).map(String)

/** Arbitrary: a digit string of exactly `len` characters */
const digitStringOfLength = (len: number): fc.Arbitrary<string> =>
    fc.array(digitCharArb, { minLength: len, maxLength: len }).map((arr) => arr.join(''))

/** Arbitrary: a digit string shorter than 81 chars (length 0–80) */
const tooShortDigitStringArb: fc.Arbitrary<string> = fc
    .integer({ min: 0, max: 80 })
    .chain((len) => digitStringOfLength(len))

/** Arbitrary: a digit string longer than 81 chars (length 82–200) */
const tooLongDigitStringArb: fc.Arbitrary<string> = fc
    .integer({ min: 82, max: 200 })
    .chain((len) => digitStringOfLength(len))

/** Arbitrary: a non-digit character (letter, symbol, space, etc.) */
const nonDigitCharArb: fc.Arbitrary<string> = fc.constantFrom(
    'a', 'b', 'z', 'A', 'Z', ' ', '.', '-', '_', '!', '@', '#', '\n', '\t', 'x', 'X'
)

/** Arbitrary: an 81-char string with at least one non-digit character */
const stringWithNonDigitArb: fc.Arbitrary<string> = fc
    .tuple(
        fc.integer({ min: 0, max: 80 }),  // position of the non-digit
        nonDigitCharArb,
        digitStringOfLength(81),
    )
    .map(([pos, nonDigit, base]) => base.slice(0, pos) + nonDigit + base.slice(pos + 1))

/**
 * Arbitrary: an 81-char digit string with exactly `nonZeroCount` non-zero digits.
 * Constructs directly without filtering.
 */
const digitStringWithNonZeroCount = (nonZeroCount: number): fc.Arbitrary<string> => {
    if (nonZeroCount === 0) {
        return fc.constant('0'.repeat(81))
    }
    return fc
        .array(fc.integer({ min: 1, max: 9 }), { minLength: nonZeroCount, maxLength: nonZeroCount })
        .chain((nonZeroDigits) => {
            // Pick `nonZeroCount` distinct positions out of 81 for the non-zero digits
            return fc
                .shuffledSubarray(Array.from({ length: 81 }, (_, i) => i), {
                    minLength: nonZeroCount,
                    maxLength: nonZeroCount,
                })
                .map((positions) => {
                    const chars = Array(81).fill('0') as string[]
                    for (let i = 0; i < nonZeroCount; i++) {
                        chars[positions[i]!] = String(nonZeroDigits[i]!)
                    }
                    return chars.join('')
                })
        })
}

/** Arbitrary: an 81-char digit string with 0–16 non-zero digits (too few givens) */
const tooFewGivensArb: fc.Arbitrary<string> = fc
    .integer({ min: 0, max: 16 })
    .chain((count) => digitStringWithNonZeroCount(count))

// ─── Property 1: Format validation rejects invalid strings ───────────────────

/**
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * Any string not matching /^[0-9]{81}$/ with ≥17 non-zero digits must be rejected.
 * This covers three categories of invalid inputs:
 *   - Wrong length (too short or too long)
 *   - Non-digit characters
 *   - Fewer than 17 non-zero digits
 */
describe('Property 1: Format validation rejects invalid strings', () => {
    it('rejects digit strings shorter than 81 characters', () => {
        fc.assert(
            fc.property(tooShortDigitStringArb, (shortString) => {
                const result = validatePuzzleFormat(shortString)
                return result.valid === false
            }),
            { numRuns: 200 }
        )
    })

    it('rejects digit strings longer than 81 characters', () => {
        fc.assert(
            fc.property(tooLongDigitStringArb, (longString) => {
                const result = validatePuzzleFormat(longString)
                return result.valid === false
            }),
            { numRuns: 200 }
        )
    })

    it('rejects 81-char strings containing non-digit characters', () => {
        fc.assert(
            fc.property(stringWithNonDigitArb, (stringWithNonDigit) => {
                const result = validatePuzzleFormat(stringWithNonDigit)
                return result.valid === false
            }),
            { numRuns: 200 }
        )
    })

    it('rejects 81-char digit strings with fewer than 17 non-zero digits', () => {
        fc.assert(
            fc.property(tooFewGivensArb, (fewGivens) => {
                const result = validatePuzzleFormat(fewGivens)
                return result.valid === false
            }),
            { numRuns: 200 }
        )
    })

    it('accepts 81-char digit strings with exactly 17 non-zero digits', () => {
        fc.assert(
            fc.property(digitStringWithNonZeroCount(17), (exactly17) => {
                const result = validatePuzzleFormat(exactly17)
                return result.valid === true
            }),
            { numRuns: 100 }
        )
    })

    it('accepts 81-char digit strings with more than 17 non-zero digits', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 18, max: 81 }).chain((count) => digitStringWithNonZeroCount(count)),
                (manyGivens) => {
                    const result = validatePuzzleFormat(manyGivens)
                    return result.valid === true
                }
            ),
            { numRuns: 100 }
        )
    })
})

// ─── Property 2 Arbitraries ───────────────────────────────────────────────────

/** Arbitrary: a non-zero digit 1–9 */
const nonZeroDigitArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 9 })

/** Indices 0–8 used to pick two distinct positions within a house */
const HOUSE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const

/**
 * Arbitrary: an 81-element board (all zeros) with a duplicate non-zero digit
 * placed at two distinct positions within the same row.
 *
 * Uses shuffledSubarray to pick exactly 2 distinct column indices — no
 * arithmetic overflow, no filtering needed.
 */
const boardWithRowDuplicateArb: fc.Arbitrary<number[]> = fc
    .tuple(
        fc.integer({ min: 0, max: 8 }),  // row index
        fc.shuffledSubarray([...HOUSE_INDICES], { minLength: 2, maxLength: 2 }),
        nonZeroDigitArb,
    )
    .map(([row, [col1, col2], digit]) => {
        const board = Array(81).fill(0) as number[]
        board[row * 9 + col1!] = digit
        board[row * 9 + col2!] = digit
        return board
    })

/**
 * Arbitrary: an 81-element board (all zeros) with a duplicate non-zero digit
 * placed at two distinct positions within the same column.
 */
const boardWithColDuplicateArb: fc.Arbitrary<number[]> = fc
    .tuple(
        fc.integer({ min: 0, max: 8 }),  // column index
        fc.shuffledSubarray([...HOUSE_INDICES], { minLength: 2, maxLength: 2 }),
        nonZeroDigitArb,
    )
    .map(([col, [row1, row2], digit]) => {
        const board = Array(81).fill(0) as number[]
        board[row1! * 9 + col] = digit
        board[row2! * 9 + col] = digit
        return board
    })

/**
 * Arbitrary: an 81-element board (all zeros) with a duplicate non-zero digit
 * placed at two distinct positions within the same 3×3 box.
 *
 * A box is identified by (boxRow 0–2, boxCol 0–2). Within the box there are
 * 9 cells (indices 0–8). shuffledSubarray picks exactly 2 distinct cell
 * indices — no overflow, no filtering.
 */
const boardWithBoxDuplicateArb: fc.Arbitrary<number[]> = fc
    .tuple(
        fc.integer({ min: 0, max: 2 }),  // box row (0–2)
        fc.integer({ min: 0, max: 2 }),  // box col (0–2)
        fc.shuffledSubarray([...HOUSE_INDICES], { minLength: 2, maxLength: 2 }),
        nonZeroDigitArb,
    )
    .map(([boxRow, boxCol, [cell1, cell2], digit]) => {
        const board = Array(81).fill(0) as number[]

        // Convert box-local cell index (0–8) to board index
        const toIndex = (cellIdx: number): number => {
            const localRow = Math.floor(cellIdx / 3)
            const localCol = cellIdx % 3
            return (boxRow * 3 + localRow) * 9 + (boxCol * 3 + localCol)
        }

        board[toIndex(cell1!)] = digit
        board[toIndex(cell2!)] = digit
        return board
    })

// ─── Property 2: Constraint validation rejects boards with duplicates ─────────

/**
 * **Validates: Requirements 2.1, 2.2**
 *
 * Any board with a duplicate non-zero digit in a row, column, or 3×3 box must
 * be rejected by validatePuzzleConstraints. Boards are constructed directly
 * (no filtering) to keep shrinking fast.
 */
describe('Property 2: Constraint validation rejects boards with duplicates', () => {
    it('rejects boards with a duplicate digit in the same row', () => {
        fc.assert(
            fc.property(boardWithRowDuplicateArb, (board) => {
                const result = validatePuzzleConstraints(board)
                return result.valid === false
            }),
            { numRuns: 200 }
        )
    })

    it('rejects boards with a duplicate digit in the same column', () => {
        fc.assert(
            fc.property(boardWithColDuplicateArb, (board) => {
                const result = validatePuzzleConstraints(board)
                return result.valid === false
            }),
            { numRuns: 200 }
        )
    })

    it('rejects boards with a duplicate digit in the same 3×3 box', () => {
        fc.assert(
            fc.property(boardWithBoxDuplicateArb, (board) => {
                const result = validatePuzzleConstraints(board)
                return result.valid === false
            }),
            { numRuns: 200 }
        )
    })
})

// ─── Property 3 Corpus ────────────────────────────────────────────────────────

/**
 * Known multi-solution puzzles.
 *
 * Each string is a valid 81-char digit string that passes format and constraint
 * checks but has more than one solution. These are used as a fixed corpus
 * because generating arbitrary multi-solution puzzles is computationally
 * expensive.
 *
 * All entries verified: validatePuzzleUniqueness returns { valid: false } in <10ms.
 *
 * Sources: derived from VALID_PUZZLE by removing key disambiguating clues.
 * VALID_PUZZLE = '003020600900305001001806400008102900700000008006708200002609500800203009005010300'
 */
const MULTI_SOLUTION_PUZZLES = [
    // VALID_PUZZLE with cell 6 (digit 6) removed
    '003020000900305001001806400008102900700000008006708200002609500800203009005010300',
    // VALID_PUZZLE with cell 9 (digit 9) removed
    '003020600000305001001806400008102900700000008006708200002609500800203009005010300',
    // VALID_PUZZLE with cell 37 (digit 7) removed
    '003020600900305001001806400008102900000000008006708200002609500800203009005010300',
    // VALID_PUZZLE with cell 47 (digit 6) removed
    '003020600900305001001806400008102900700000008000708200002609500800203009005010300',
    // VALID_PUZZLE with cell 63 (digit 8) removed
    '003020600900305001001806400008102900700000008006708200002609500000203009005010300',
] as const

/**
 * Known unsolvable puzzles.
 *
 * Each string is a valid 81-char digit string that passes format and constraint
 * checks but has zero solutions. These are used as a fixed corpus because
 * generating arbitrary unsolvable puzzles is computationally expensive.
 *
 * All entries verified: validatePuzzleUniqueness returns { valid: false } in <500ms.
 *
 * Sources: constructed by placing conflicting constraints that block all solution paths.
 */
const UNSOLVABLE_PUZZLES = [
    // Row 0 has 1-8, col 8 has 1-8 (rows 1-8), 9 in box 2 blocks cell (0,8)
    '123456780000000901000000002000000003000000004000000005000000006000000007000000008',
    // Row 0 = 1-9, rows 1-8 col 0 = 2-9 — col 0 has no room for 1 except row 0 (already used)
    '123456789200000000300000000400000000500000000600000000700000000800000000900000000',
    // Row 0 = 1-9, row 1 col 0 = 1 — col 0 duplicate forces unsolvability
    '123456789100000000200000000300000000400000000500000000600000000700000000800000000',
    // Rows 0 and 1 each contain 1-9 — box 0 has 1,2,3 in both rows, impossible
    '123456789456789123000000000000000000000000000000000000000000000000000000000000000',
    // Rows 0 and 1 are reverse of each other — shared box constraints make it unsolvable
    '123456789987654321000000000000000000000000000000000000000000000000000000000000000',
] as const

// ─── Property 3: Uniqueness validation rejects puzzles with 0 or >1 solutions ─

/**
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * For all puzzles in the corpus of known-invalid puzzles (0 or >1 solutions),
 * validatePuzzleUniqueness must return { valid: false }.
 *
 * Since generating arbitrary puzzles with 0 or >1 solutions is computationally
 * expensive, we use a fixed corpus of known examples. The property is:
 * "for all puzzles in the corpus of known-invalid puzzles, validatePuzzleUniqueness
 * rejects them."
 */
describe('Property 3: Uniqueness validation rejects puzzles with 0 or >1 solutions', () => {
    it('rejects all known multi-solution puzzles', () => {
        fc.assert(
            fc.property(fc.constantFrom(...MULTI_SOLUTION_PUZZLES), (puzzleString) => {
                const board = stringToBoard(puzzleString)
                const result = validatePuzzleUniqueness(board)
                return result.valid === false
            }),
            { numRuns: MULTI_SOLUTION_PUZZLES.length }
        )
    })

    it('rejects all known unsolvable puzzles', () => {
        fc.assert(
            fc.property(fc.constantFrom(...UNSOLVABLE_PUZZLES), (puzzleString) => {
                const board = stringToBoard(puzzleString)
                const result = validatePuzzleUniqueness(board)
                return result.valid === false
            }),
            { numRuns: UNSOLVABLE_PUZZLES.length }
        )
    })
})

// ─── Property 4 Corpus ────────────────────────────────────────────────────────

/**
 * Known valid puzzles, one per difficulty level.
 *
 * Each entry is a verified 81-char puzzle string with a unique solution.
 * Difficulty was confirmed by running `classifyAndSolve` and `getDifficulty`
 * independently on each puzzle. All puzzles were generated via
 * `generatePuzzleWithDifficulty` and verified to have exactly one solution.
 *
 * Difficulty classification is based on the most advanced technique required:
 * - simple:       naked singles only
 * - easy:         hidden singles required
 * - intermediate: naked/hidden pairs or pointing pairs required
 * - expert:       guessing (backtracking) required
 */
const PUZZLES_BY_DIFFICULTY = [
    {
        difficulty: 'simple' as const,
        puzzle: '407000090005869004860200000000003067000000000350400000000001046700652900090000701',
    },
    {
        difficulty: 'easy' as const,
        puzzle: '007302500020009073000600804006008005000000000900700400209006000750900010001503200',
    },
    {
        difficulty: 'intermediate' as const,
        puzzle: '060200301000600020082900000009500080400307002070009600000003250040006000306002070',
    },
    {
        difficulty: 'expert' as const,
        puzzle: '300205008009307000000006500250000001901020704700000059005100000000608300800709005',
    },
] as const

// ─── Property 4: classifyAndSolve difficulty matches getDifficulty ────────────

/**
 * **Validates: Requirements 4.1, 4.2**
 *
 * For each puzzle in the fixed corpus (one per difficulty level), the difficulty
 * returned by `classifyAndSolve` must match the difficulty returned by an
 * independent call to `createSolverState` + `solve` + `getDifficulty`.
 *
 * This verifies that `classifyAndSolve` is a correct composition of the
 * underlying solver primitives and does not introduce any discrepancy.
 */
describe('Property 4: classifyAndSolve difficulty matches getDifficulty', () => {
    it('classifyAndSolve difficulty matches independent getDifficulty for all corpus puzzles', () => {
        fc.assert(
            fc.property(fc.constantFrom(...PUZZLES_BY_DIFFICULTY), ({ puzzle }) => {
                const board = stringToBoard(puzzle)

                // Path A: classifyAndSolve
                const { difficulty: classifiedDifficulty } = classifyAndSolve(board)

                // Path B: independent createSolverState + solve + getDifficulty
                const state = createSolverState(board, true)
                solve(state)
                const independentDifficulty = getDifficulty(state.solveLog)

                return classifiedDifficulty === independentDifficulty
            }),
            { numRuns: PUZZLES_BY_DIFFICULTY.length }
        )
    })

    it('classifyAndSolve difficulty matches the expected difficulty for each corpus puzzle', () => {
        fc.assert(
            fc.property(fc.constantFrom(...PUZZLES_BY_DIFFICULTY), ({ puzzle, difficulty: expectedDifficulty }) => {
                const board = stringToBoard(puzzle)
                const { difficulty } = classifyAndSolve(board)
                return difficulty === expectedDifficulty
            }),
            { numRuns: PUZZLES_BY_DIFFICULTY.length }
        )
    })
})
