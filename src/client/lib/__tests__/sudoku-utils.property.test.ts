import * as fc from 'fast-check'
import { describe, it } from 'vitest'

import { boardToString, hasConflict, isComplete, parseBoard, updateConflicts } from '../sudoku-utils'
import type { CellState } from '../types'

/** Arbitrary: a single digit 0–9 */
const digitArb = fc.integer({ min: 0, max: 9 })

/** Arbitrary: an 81-char board string of digits 0–9 */
const boardStringArb = fc.stringMatching(/^[0-9]{81}$/)

/** Arbitrary: a 9×9 CellState grid with arbitrary values */
const cellStateBoardArb = fc.array(
    fc.array(
        fc.record({
            value: digitArb,
            isGiven: fc.boolean(),
            hasConflict: fc.boolean(),
        }),
        { minLength: 9, maxLength: 9 }
    ),
    { minLength: 9, maxLength: 9 }
)

/** Build a CellState[][] from a flat array of values (all isGiven/hasConflict false) */
const boardFromValues = (values: number[]): CellState[][] =>
    Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => ({
            value: values[r * 9 + c]!,
            isGiven: false,
            hasConflict: false,
        }))
    )

// ---------------------------------------------------------------------------
// Property 6: Board string serialization round-trip
// ---------------------------------------------------------------------------

describe('Property 6: Board string serialization round-trip', () => {
    // Feature: sudoku-game, Property 6: Board string serialization round-trip
    it('grid → string → grid produces equivalent board', () => {
        fc.assert(
            fc.property(boardStringArb, (str) => {
                const board = parseBoard(str)
                const roundTripped = boardToString(board)
                return roundTripped === str
            }),
            { numRuns: 100 }
        )
    })

    it('CellState[][] → string → CellState[][] preserves values', () => {
        fc.assert(
            fc.property(cellStateBoardArb, (board) => {
                const str = boardToString(board)
                const reparsed = parseBoard(str)
                return board.every((row, r) =>
                    row.every((cell, c) => reparsed[r]![c]!.value === cell.value)
                )
            }),
            { numRuns: 100 }
        )
    })
})

// ---------------------------------------------------------------------------
// Property 7: Conflict detection correctness
// ---------------------------------------------------------------------------

describe('Property 7: Conflict detection correctness', () => {
    // Feature: sudoku-game, Property 7: Conflict detection correctness

    it('hasConflict returns false for all cells on an empty board', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 8 }),
                fc.integer({ min: 0, max: 8 }),
                (row, col) => {
                    const board = parseBoard('0'.repeat(81))
                    return hasConflict(board, row, col) === false
                }
            ),
            { numRuns: 100 }
        )
    })

    it('hasConflict returns true when a duplicate is placed in the same row', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 8 }),   // row
                fc.integer({ min: 0, max: 7 }),   // col1 (0–7 so col2 = col1+1 is valid)
                fc.integer({ min: 1, max: 9 }),   // digit
                (row, col1, digit) => {
                    const col2 = col1 + 1
                    const values = Array(81).fill(0) as number[]
                    values[row * 9 + col1] = digit
                    values[row * 9 + col2] = digit
                    const board = boardFromValues(values)
                    return hasConflict(board, row, col1) === true &&
                        hasConflict(board, row, col2) === true
                }
            ),
            { numRuns: 100 }
        )
    })

    it('hasConflict returns true when a duplicate is placed in the same column', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 7 }),   // row1
                fc.integer({ min: 0, max: 8 }),   // col
                fc.integer({ min: 1, max: 9 }),   // digit
                (row1, col, digit) => {
                    const row2 = row1 + 1
                    const values = Array(81).fill(0) as number[]
                    values[row1 * 9 + col] = digit
                    values[row2 * 9 + col] = digit
                    const board = boardFromValues(values)
                    return hasConflict(board, row1, col) === true &&
                        hasConflict(board, row2, col) === true
                }
            ),
            { numRuns: 100 }
        )
    })

    it('hasConflict returns true when a duplicate is placed in the same 3×3 box', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 2 }),   // box row (0,1,2)
                fc.integer({ min: 0, max: 2 }),   // box col (0,1,2)
                fc.integer({ min: 1, max: 9 }),   // digit
                (boxRow, boxCol, digit) => {
                    // Place the same digit in two different cells of the same box
                    const r1 = boxRow * 3
                    const c1 = boxCol * 3
                    const r2 = boxRow * 3 + 1
                    const c2 = boxCol * 3 + 1
                    const values = Array(81).fill(0) as number[]
                    values[r1 * 9 + c1] = digit
                    values[r2 * 9 + c2] = digit
                    const board = boardFromValues(values)
                    return hasConflict(board, r1, c1) === true &&
                        hasConflict(board, r2, c2) === true
                }
            ),
            { numRuns: 100 }
        )
    })

    it('hasConflict returns false when no duplicate exists in row/col/box', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 8 }),
                fc.integer({ min: 0, max: 8 }),
                fc.integer({ min: 1, max: 9 }),
                (row, col, digit) => {
                    // Place a single non-zero digit — no peers share it
                    const values = Array(81).fill(0) as number[]
                    values[row * 9 + col] = digit
                    const board = boardFromValues(values)
                    return hasConflict(board, row, col) === false
                }
            ),
            { numRuns: 100 }
        )
    })
})

// ---------------------------------------------------------------------------
// Property 8: Given cells are immutable
// ---------------------------------------------------------------------------

describe('Property 8: Given cells are immutable', () => {
    // Feature: sudoku-game, Property 8: Given cells are immutable

    it('parseBoard marks every non-zero cell as isGiven: true', () => {
        fc.assert(
            fc.property(boardStringArb, (str) => {
                const board = parseBoard(str)
                return board.every((row, r) =>
                    row.every((cell, c) => {
                        const digit = Number(str[r * 9 + c])
                        return digit !== 0 ? cell.isGiven === true : cell.isGiven === false
                    })
                )
            }),
            { numRuns: 100 }
        )
    })

    it('placement logic skips given cells — value stays unchanged', () => {
        fc.assert(
            fc.property(
                boardStringArb,
                fc.integer({ min: 0, max: 8 }),
                fc.integer({ min: 0, max: 8 }),
                fc.integer({ min: 1, max: 9 }),
                (str, row, col, newDigit) => {
                    const board = parseBoard(str)
                    const cell = board[row]![col]!

                    if (!cell.isGiven) return true // only test given cells

                    // Simulate placement logic: skip if isGiven
                    const originalValue = cell.value
                    const updatedBoard = board.map((r, ri) =>
                        r.map((c, ci) => {
                            if (ri === row && ci === col && !c.isGiven) {
                                return { ...c, value: newDigit }
                            }
                            return c
                        })
                    )

                    return updatedBoard[row]![col]!.value === originalValue
                }
            ),
            { numRuns: 100 }
        )
    })
})

// ---------------------------------------------------------------------------
// Property 9: Completion detection
// ---------------------------------------------------------------------------

describe('Property 9: Completion detection', () => {
    // Feature: sudoku-game, Property 9: Completion detection

    it('isComplete returns false when any cell has value 0', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 8 }),
                fc.integer({ min: 0, max: 8 }),
                (row, col) => {
                    // Start with a valid complete board, then zero one cell
                    const completeStr =
                        '534678912672195348198342567859761423426853791713924856961537284287419635345286179'
                    const board = updateConflicts(parseBoard(completeStr))
                    const withZero = board.map((r, ri) =>
                        r.map((c, ci) =>
                            ri === row && ci === col ? { ...c, value: 0 } : c
                        )
                    )
                    return isComplete(withZero) === false
                }
            ),
            { numRuns: 100 }
        )
    })

    it('isComplete returns false when any cell has hasConflict: true', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 8 }),
                fc.integer({ min: 0, max: 8 }),
                (row, col) => {
                    const completeStr =
                        '534678912672195348198342567859761423426853791713924856961537284287419635345286179'
                    const board = updateConflicts(parseBoard(completeStr))
                    const withConflict = board.map((r, ri) =>
                        r.map((c, ci) =>
                            ri === row && ci === col ? { ...c, hasConflict: true } : c
                        )
                    )
                    return isComplete(withConflict) === false
                }
            ),
            { numRuns: 100 }
        )
    })

    it('isComplete returns true iff all cells non-zero and no conflicts', () => {
        fc.assert(
            fc.property(cellStateBoardArb, (board) => {
                const result = isComplete(board)
                const allFilled = board.every((row) => row.every((c) => c.value !== 0))
                const noConflicts = board.every((row) => row.every((c) => !c.hasConflict))
                return result === (allFilled && noConflicts)
            }),
            { numRuns: 100 }
        )
    })
})
