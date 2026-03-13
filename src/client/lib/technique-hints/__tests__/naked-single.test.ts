import { describe, expect, test } from 'vitest'

import { detectNakedSingle } from '../naked-single'
import type { CandidateBoard, CellState } from '../../types'

const makeCell = (value: number): CellState => ({ value, isGiven: value !== 0, hasConflict: false })

const emptyCell = (): CellState => makeCell(0)

/** Build a 9×9 board where every cell is empty (value=0) */
const emptyBoard = (): CellState[][] =>
    Array.from({ length: 9 }, () => Array.from({ length: 9 }, emptyCell))

/** Build a CandidateBoard from a 9×9 array of sets */
const makeBoard = (sets: ReadonlySet<number>[][]): CandidateBoard => sets

/** A 9×9 candidate board where every cell has 2+ candidates (no naked singles) */
const noSinglesBoard = (): CandidateBoard =>
    Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, () => new Set([1, 2]))
    )

/** A flat 81-element solution array filled with a given digit */
const uniformSolution = (digit: number): number[] => Array(81).fill(digit)

/** Build a solution array where cell (r,c) has the given digit, rest are 1 */
const solutionWith = (r: number, c: number, digit: number): number[] => {
    const sol = Array(81).fill(1) as number[]
    sol[r * 9 + c] = digit
    return sol
}

// ---------------------------------------------------------------------------
// Test 1: Returns a hint when a cell has exactly one candidate
// ---------------------------------------------------------------------------

describe('detectNakedSingle — basic detection', () => {
    test('returns a hint with action=placement and correct primaryCells when a cell has exactly one candidate', () => {
        const candidates = noSinglesBoard()
            // Override cell (2, 5) to have exactly one candidate: digit 7
            ; (candidates[2]![5] as Set<number>) = new Set([7])

        const board = emptyBoard()
        const solution = solutionWith(2, 5, 7)

        const hint = detectNakedSingle(board, candidates, solution)

        expect(hint).not.toBeNull()
        expect(hint!.action).toBe('placement')
        expect(hint!.primaryCells).toContainEqual([2, 5])
    })
})

// ---------------------------------------------------------------------------
// Test 2: hint.digit equals the sole candidate in that cell's set
// ---------------------------------------------------------------------------

describe('detectNakedSingle — digit matches sole candidate', () => {
    test('hint.digit equals the single candidate in the cell set', () => {
        const candidates = noSinglesBoard()
            ; (candidates[0]![0] as Set<number>) = new Set([4])

        const board = emptyBoard()
        const solution = solutionWith(0, 0, 4)

        const hint = detectNakedSingle(board, candidates, solution)

        expect(hint).not.toBeNull()
        expect(hint!.digit).toBe(4)
    })
})

// ---------------------------------------------------------------------------
// Test 3: hint.digit equals solution[row * 9 + col]
// ---------------------------------------------------------------------------

describe('detectNakedSingle — digit matches solution', () => {
    test('hint.digit equals solution[row * 9 + col] for the primary cell', () => {
        const r = 3
        const c = 7
        const digit = 9

        const candidates = noSinglesBoard()
            ; (candidates[r]![c] as Set<number>) = new Set([digit])

        const board = emptyBoard()
        const solution = solutionWith(r, c, digit)

        const hint = detectNakedSingle(board, candidates, solution)

        expect(hint).not.toBeNull()
        expect(hint!.digit).toBe(solution[r * 9 + c])
    })
})

// ---------------------------------------------------------------------------
// Test 4: Returns null when no cell has exactly one candidate
// ---------------------------------------------------------------------------

describe('detectNakedSingle — returns null when no naked single', () => {
    test('returns null when all cells have 2+ candidates', () => {
        const candidates = noSinglesBoard()
        const board = emptyBoard()
        const solution = uniformSolution(1)

        const hint = detectNakedSingle(board, candidates, solution)

        expect(hint).toBeNull()
    })

    test('returns null when all cells are filled (value !== 0)', () => {
        // All cells filled → candidates are empty sets (size 0, not 1)
        const candidates: CandidateBoard = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set<number>())
        )
        const board: CellState[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => makeCell(5))
        )
        const solution = uniformSolution(5)

        const hint = detectNakedSingle(board, candidates, solution)

        expect(hint).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Test 5: When multiple cells have exactly one candidate, returns lowest index
// ---------------------------------------------------------------------------

describe('detectNakedSingle — lowest cell index wins', () => {
    test('returns the cell with the lowest row*9+col index when multiple naked singles exist', () => {
        const candidates = noSinglesBoard()
            // Place naked singles at (1,3) and (0,8) — (0,8) has lower index (8) than (1,3) (12)
            ; (candidates[1]![3] as Set<number>) = new Set([6])
            ; (candidates[0]![8] as Set<number>) = new Set([3])

        const board = emptyBoard()
        const solution = Array(81).fill(1) as number[]
        solution[0 * 9 + 8] = 3
        solution[1 * 9 + 3] = 6

        const hint = detectNakedSingle(board, candidates, solution)

        expect(hint).not.toBeNull()
        expect(hint!.primaryCells[0]).toEqual([0, 8])
    })
})

// ---------------------------------------------------------------------------
// Test 6: primaryCells has exactly one entry for a placement hint
// ---------------------------------------------------------------------------

describe('detectNakedSingle — primaryCells length', () => {
    test('primaryCells has exactly one entry', () => {
        const candidates = noSinglesBoard()
            ; (candidates[4]![4] as Set<number>) = new Set([5])

        const board = emptyBoard()
        const solution = solutionWith(4, 4, 5)

        const hint = detectNakedSingle(board, candidates, solution)

        expect(hint).not.toBeNull()
        expect(hint!.primaryCells).toHaveLength(1)
    })
})
