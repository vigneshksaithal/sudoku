import * as fc from 'fast-check'
import { describe, it } from 'vitest'

import { getBestHintCell, isHintApplicable } from '../hint-logic'
import type { CellState } from '../types'

/** Arbitrary: a single valid digit 1–9 */
const validDigit = fc.integer({ min: 1, max: 9 })

/** Arbitrary: a single CellState */
const cellStateArb = fc.record({
    value: fc.integer({ min: 0, max: 9 }),
    isGiven: fc.boolean(),
    hasConflict: fc.boolean(),
})

/** Arbitrary: a 9×9 board with arbitrary cell states */
const boardArb = fc.array(
    fc.array(cellStateArb, { minLength: 9, maxLength: 9 }),
    { minLength: 9, maxLength: 9 }
)

/** Arbitrary: a fully-filled 9×9 board (all values 1–9) */
const filledBoardArb = fc.array(
    fc.array(
        fc.record({
            value: validDigit,
            isGiven: fc.boolean(),
            hasConflict: fc.boolean(),
        }),
        { minLength: 9, maxLength: 9 }
    ),
    { minLength: 9, maxLength: 9 }
)

/** Arbitrary: a valid flat solution array (81 elements, values 1–9) */
const solutionArb = fc.array(validDigit, { minLength: 81, maxLength: 81 })

// ---------------------------------------------------------------------------
// Property 1: getBestHintCell returns null on a complete board
// ---------------------------------------------------------------------------

describe('Property 1: getBestHintCell returns null on a complete board', () => {
    /**
     * Validates: Requirement 2.2
     */
    it('returns null when every cell has a non-zero value', () => {
        fc.assert(
            fc.property(filledBoardArb, solutionArb, (board, solution) => {
                return getBestHintCell(board, solution) === null
            }),
            { numRuns: 100 }
        )
    })
})

// ---------------------------------------------------------------------------
// Property 2: getBestHintCell result is always an empty non-given cell
// ---------------------------------------------------------------------------

describe('Property 2: getBestHintCell result is always an empty non-given cell', () => {
    /**
     * Validates: Requirements 2.1, 2.4
     */
    it('result points to a cell with value === 0 and isGiven === false', () => {
        // Generate a board and then force at least one empty non-given cell
        const boardWithEmptyCell = fc.tuple(boardArb, fc.integer({ min: 0, max: 8 }), fc.integer({ min: 0, max: 8 })).map(
            ([board, row, col]): CellState[][] =>
                board.map((r, ri) =>
                    r.map((c, ci): CellState =>
                        ri === row && ci === col
                            ? { value: 0, isGiven: false, hasConflict: false }
                            : c
                    )
                )
        )

        fc.assert(
            fc.property(boardWithEmptyCell, solutionArb, (board, solution) => {
                const result = getBestHintCell(board, solution)
                if (result === null) return true
                const cell = board[result.row]![result.col]!
                return cell.value === 0 && cell.isGiven === false
            }),
            { numRuns: 100 }
        )
    })
})

// ---------------------------------------------------------------------------
// Property 3: getBestHintCell result value matches the solution
// ---------------------------------------------------------------------------

describe('Property 3: getBestHintCell result value matches the solution', () => {
    /**
     * Validates: Requirement 2.3
     */
    it('result.value === solution[result.row * 9 + result.col]', () => {
        fc.assert(
            fc.property(boardArb, solutionArb, (board, solution) => {
                const result = getBestHintCell(board, solution)
                if (result === null) return true
                return result.value === solution[result.row * 9 + result.col]
            }),
            { numRuns: 100 }
        )
    })
})

// ---------------------------------------------------------------------------
// Property 7: isHintApplicable rejects given and filled cells
// ---------------------------------------------------------------------------

describe('Property 7: isHintApplicable rejects given and filled cells', () => {
    /**
     * Validates: Requirements 7.1, 7.2
     */
    it('returns false for a given cell (isGiven === true)', () => {
        fc.assert(
            fc.property(
                boardArb,
                fc.integer({ min: 0, max: 8 }),
                fc.integer({ min: 0, max: 8 }),
                validDigit,
                (board, row, col, solutionValue) => {
                    const givenBoard = board.map((r, ri) =>
                        r.map((c, ci): CellState =>
                            ri === row && ci === col ? { ...c, isGiven: true } : c
                        )
                    )
                    return isHintApplicable(givenBoard, row, col, solutionValue) === false
                }
            ),
            { numRuns: 100 }
        )
    })

    it('returns false for a filled cell (value !== 0)', () => {
        fc.assert(
            fc.property(
                boardArb,
                fc.integer({ min: 0, max: 8 }),
                fc.integer({ min: 0, max: 8 }),
                validDigit,
                validDigit,
                (board, row, col, cellValue, solutionValue) => {
                    const filledBoard = board.map((r, ri) =>
                        r.map((c, ci): CellState =>
                            ri === row && ci === col
                                ? { ...c, value: cellValue, isGiven: false }
                                : c
                        )
                    )
                    return isHintApplicable(filledBoard, row, col, solutionValue) === false
                }
            ),
            { numRuns: 100 }
        )
    })
})

// ---------------------------------------------------------------------------
// Property 6: isHintApplicable is consistent with getBestHintCell
// ---------------------------------------------------------------------------

describe('Property 6: isHintApplicable is consistent with getBestHintCell', () => {
    /**
     * Validates: Requirement 7.4
     */
    it('isHintApplicable returns true for the cell returned by getBestHintCell', () => {
        fc.assert(
            fc.property(boardArb, solutionArb, (board, solution) => {
                const result = getBestHintCell(board, solution)
                if (result === null) return true
                return isHintApplicable(board, result.row, result.col, result.value) === true
            }),
            { numRuns: 100 }
        )
    })
})
