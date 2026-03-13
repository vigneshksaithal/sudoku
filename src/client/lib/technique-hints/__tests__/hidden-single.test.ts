import { describe, expect, test } from 'vitest'

import { detectHiddenSingle } from '../hidden-single'
import type { CandidateBoard, CellState } from '../../types'

const makeCell = (value: number): CellState => ({ value, isGiven: value !== 0, hasConflict: false })
const emptyCell = (): CellState => makeCell(0)
const emptyBoard = (): CellState[][] =>
    Array.from({ length: 9 }, () => Array.from({ length: 9 }, emptyCell))

/** Build a CandidateBoard where every cell has the given set of candidates */
const uniformBoard = (candidates: ReadonlySet<number>): CandidateBoard =>
    Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, () => candidates)
    )

/** Build a solution array where cell (r,c) has the given digit, rest are 1 */
const solutionWith = (r: number, c: number, digit: number): number[] => {
    const sol = Array(81).fill(1) as number[]
    sol[r * 9 + c] = digit
    return sol
}

// ---------------------------------------------------------------------------
// Test 1: Finds a digit restricted to one cell in a row
// ---------------------------------------------------------------------------

describe('detectHiddenSingle — row', () => {
    test('returns hint with action=placement and correct primaryCells for a row hidden single', () => {
        // Row 2: digit 5 is a candidate only in cell (2, 3)
        const grid: ReadonlySet<number>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set([1, 2, 3, 4]))
        )
        // Give digit 5 to all cells in row 2 except (2,3)
        for (let c = 0; c < 9; c++) {
            if (c !== 3) grid[2]![c] = new Set([1, 2, 3, 4, 5])
        }
        // Only (2,3) does NOT have 5 — wait, we need (2,3) to be the ONLY cell with 5
        // Reset: row 2 cells have no 5, then add 5 only to (2,3)
        for (let c = 0; c < 9; c++) {
            grid[2]![c] = new Set([1, 2, 3, 4])
        }
        grid[2]![3] = new Set([1, 2, 3, 4, 5])

        const board = emptyBoard()
        const solution = solutionWith(2, 3, 5)

        const hint = detectHiddenSingle(board, grid as CandidateBoard, solution)

        expect(hint).not.toBeNull()
        expect(hint!.action).toBe('placement')
        expect(hint!.primaryCells).toContainEqual([2, 3])
    })
})

// ---------------------------------------------------------------------------
// Test 2: Finds a digit restricted to one cell in a column
// ---------------------------------------------------------------------------

describe('detectHiddenSingle — column', () => {
    test('returns hint for a column hidden single', () => {
        // Col 7: digit 8 is a candidate only in cell (4, 7)
        const grid: ReadonlySet<number>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set([1, 2, 3]))
        )
        // All cells in col 7 have no 8, then add 8 only to (4,7)
        grid[4]![7] = new Set([1, 2, 3, 8])

        const board = emptyBoard()
        const solution = solutionWith(4, 7, 8)

        const hint = detectHiddenSingle(board, grid as CandidateBoard, solution)

        expect(hint).not.toBeNull()
        expect(hint!.action).toBe('placement')
        expect(hint!.primaryCells).toContainEqual([4, 7])
        expect(hint!.digit).toBe(8)
    })
})

// ---------------------------------------------------------------------------
// Test 3: Finds a digit restricted to one cell in a box
// ---------------------------------------------------------------------------

describe('detectHiddenSingle — box', () => {
    test('returns hint for a box hidden single', () => {
        // Box 4 (rows 3-5, cols 3-5): digit 9 only in cell (5, 5)
        const grid: ReadonlySet<number>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set([1, 2, 3]))
        )
        grid[5]![5] = new Set([1, 2, 3, 9])

        const board = emptyBoard()
        const solution = solutionWith(5, 5, 9)

        const hint = detectHiddenSingle(board, grid as CandidateBoard, solution)

        expect(hint).not.toBeNull()
        expect(hint!.action).toBe('placement')
        expect(hint!.primaryCells).toContainEqual([5, 5])
        expect(hint!.digit).toBe(9)
    })
})

// ---------------------------------------------------------------------------
// Test 4: Returns null when every digit appears in 2+ cells in every unit
// ---------------------------------------------------------------------------

describe('detectHiddenSingle — returns null', () => {
    test('returns null when no digit is restricted to one cell in any unit', () => {
        // Every cell has the same candidates {1,2} — each digit appears in all 9 cells per unit
        const candidates = uniformBoard(new Set([1, 2]))
        const board = emptyBoard()
        const solution = Array(81).fill(1) as number[]

        const hint = detectHiddenSingle(board, candidates, solution)

        expect(hint).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Test 5: hint.digit equals solution[row * 9 + col]
// ---------------------------------------------------------------------------

describe('detectHiddenSingle — digit matches solution', () => {
    test('hint.digit equals solution[row * 9 + col]', () => {
        const r = 1
        const c = 6
        const digit = 7

        const grid: ReadonlySet<number>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set([1, 2, 3]))
        )
        // digit 7 only in (r, c) within row r
        grid[r]![c] = new Set([1, 2, 3, digit])

        const board = emptyBoard()
        const solution = solutionWith(r, c, digit)

        const hint = detectHiddenSingle(board, grid as CandidateBoard, solution)

        expect(hint).not.toBeNull()
        expect(hint!.digit).toBe(solution[r * 9 + c])
    })
})

// ---------------------------------------------------------------------------
// Test 6: Unit order — rows checked before columns before boxes
// ---------------------------------------------------------------------------

describe('detectHiddenSingle — unit order', () => {
    test('returns row hidden single before column hidden single', () => {
        // Set up: digit 3 is a hidden single in row 5 at (5,2)
        //         AND digit 4 is a hidden single in col 0 at (0,0)
        // Row check comes first, so the row single should be returned
        const grid: ReadonlySet<number>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set([1, 2]))
        )
        // Row 5: digit 3 only in (5,2)
        grid[5]![2] = new Set([1, 2, 3])
        // Col 0: digit 4 only in (8,0) — this is in a later row than (5,2)
        grid[8]![0] = new Set([1, 2, 4])

        const board = emptyBoard()
        const solution = Array(81).fill(1) as number[]
        solution[5 * 9 + 2] = 3
        solution[8 * 9 + 0] = 4

        const hint = detectHiddenSingle(board, grid as CandidateBoard, solution)

        expect(hint).not.toBeNull()
        // The row-based hidden single (row 5) should be found first
        expect(hint!.primaryCells[0]).toEqual([5, 2])
        expect(hint!.digit).toBe(3)
    })
})
