import { describe, expect, test } from 'vitest'
import { detectHiddenPair } from '../hidden-pair'
import type { CandidateBoard, CellState } from '../../types'

const emptyCell = (): CellState => ({ value: 0, isGiven: false, hasConflict: false })

const emptyBoard = (): CellState[][] =>
    Array.from({ length: 9 }, () => Array.from({ length: 9 }, emptyCell))

const makeBoard = (sets: ReadonlySet<number>[][]): CandidateBoard => sets

/** 9×9 board where every cell has candidates {1,2,3,4,5} */
const defaultCandidates = (): ReadonlySet<number>[][] =>
    Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, () => new Set([1, 2, 3, 4, 5]))
    )

// ---------------------------------------------------------------------------
// Test 1: Finds a hidden pair in a row
// ---------------------------------------------------------------------------

describe('detectHiddenPair — row', () => {
    test('finds hidden pair in row 0 where d1,d2 appear only in two cells', () => {
        const sets = defaultCandidates()
        // d1=7, d2=8 appear ONLY in cells (0,2) and (0,5)
        // All other cells in row 0 must NOT have 7 or 8
        for (let c = 0; c < 9; c++) {
            sets[0]![c] = new Set([1, 2, 3, 4, 5])
        }
        // The two hidden-pair cells have extra candidates beyond {7,8}
        sets[0]![2] = new Set([1, 3, 7, 8])
        sets[0]![5] = new Set([2, 4, 7, 8])

        const board = emptyBoard()
        const hint = detectHiddenPair(board, makeBoard(sets))

        expect(hint).not.toBeNull()
        expect(hint!.action).toBe('elimination')
        expect(hint!.primaryCells).toHaveLength(2)
    })
})

// ---------------------------------------------------------------------------
// Test 2: Finds a hidden pair in a column
// ---------------------------------------------------------------------------

describe('detectHiddenPair — column', () => {
    test('finds hidden pair in column 4 where d1,d2 appear only in two cells', () => {
        const sets = defaultCandidates()
        // d1=6, d2=9 appear ONLY in cells (1,4) and (7,4)
        for (let r = 0; r < 9; r++) {
            sets[r]![4] = new Set([1, 2, 3, 4, 5])
        }
        sets[1]![4] = new Set([1, 3, 6, 9])
        sets[7]![4] = new Set([2, 5, 6, 9])

        const board = emptyBoard()
        const hint = detectHiddenPair(board, makeBoard(sets))

        expect(hint).not.toBeNull()
        expect(hint!.action).toBe('elimination')
        expect(hint!.primaryCells).toHaveLength(2)
    })
})

// ---------------------------------------------------------------------------
// Test 3: Finds a hidden pair in a box
// ---------------------------------------------------------------------------

describe('detectHiddenPair — box', () => {
    test('finds hidden pair in box 8 (bottom-right) where d1,d2 appear only in two cells', () => {
        // Box 8 = rows 6-8, cols 6-8
        const sets: ReadonlySet<number>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set([1, 2, 3, 4, 5]))
        )
        // d1=7, d2=8 appear ONLY in (6,6) and (8,8) within box 8
        sets[6]![6] = new Set([1, 3, 7, 8])
        sets[8]![8] = new Set([2, 4, 7, 8])

        const board = emptyBoard()
        const hint = detectHiddenPair(board, makeBoard(sets))

        expect(hint).not.toBeNull()
        expect(hint!.action).toBe('elimination')
        expect(hint!.primaryCells).toHaveLength(2)
    })
})

// ---------------------------------------------------------------------------
// Test 4: eliminations removes only non-pair candidates from the two cells
// ---------------------------------------------------------------------------

describe('detectHiddenPair — eliminations', () => {
    test('eliminations list only non-pair candidates from the two primary cells', () => {
        const sets = defaultCandidates()
        // d1=7, d2=8 appear ONLY in (2,0) and (2,3) in row 2
        for (let c = 0; c < 9; c++) {
            sets[2]![c] = new Set([1, 2, 3])
        }
        // Primary cells have extra candidates beyond {7,8}
        sets[2]![0] = new Set([1, 3, 7, 8])  // extras: 1, 3
        sets[2]![3] = new Set([2, 5, 7, 8])  // extras: 2, 5

        const board = emptyBoard()
        const hint = detectHiddenPair(board, makeBoard(sets))

        expect(hint).not.toBeNull()
        const elims = hint!.eliminations!
        expect(elims).toBeDefined()

        const cell20 = elims.find((e) => e.row === 2 && e.col === 0)
        const cell23 = elims.find((e) => e.row === 2 && e.col === 3)

        expect(cell20).toBeDefined()
        expect(cell20!.digits).toContain(1)
        expect(cell20!.digits).toContain(3)
        expect(cell20!.digits).not.toContain(7)
        expect(cell20!.digits).not.toContain(8)

        expect(cell23).toBeDefined()
        expect(cell23!.digits).toContain(2)
        expect(cell23!.digits).toContain(5)
        expect(cell23!.digits).not.toContain(7)
        expect(cell23!.digits).not.toContain(8)
    })
})

// ---------------------------------------------------------------------------
// Test 5: Returns null when pair digits appear in 3+ cells
// ---------------------------------------------------------------------------

describe('detectHiddenPair — not a pair (3+ cells)', () => {
    test('returns null when d1 and d2 both appear in 3 cells of the unit', () => {
        const sets = defaultCandidates()
        // d1=7, d2=8 appear in 3 cells of row 0 → not a hidden pair
        for (let c = 0; c < 9; c++) {
            sets[0]![c] = new Set([1, 2, 3])
        }
        sets[0]![0] = new Set([1, 7, 8])
        sets[0]![3] = new Set([2, 7, 8])
        sets[0]![6] = new Set([3, 7, 8])

        const board = emptyBoard()
        const hint = detectHiddenPair(board, makeBoard(sets))

        expect(hint).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Test 6: Returns null when the two cells have no extra candidates (already clean)
// ---------------------------------------------------------------------------

describe('detectHiddenPair — no extra candidates', () => {
    test('returns null when the two cells contain only the pair digits', () => {
        const sets = defaultCandidates()
        // d1=7, d2=8 appear ONLY in (0,1) and (0,4), but those cells have ONLY {7,8}
        for (let c = 0; c < 9; c++) {
            sets[0]![c] = new Set([1, 2, 3])
        }
        sets[0]![1] = new Set([7, 8])  // no extras
        sets[0]![4] = new Set([7, 8])  // no extras

        const board = emptyBoard()
        const hint = detectHiddenPair(board, makeBoard(sets))

        expect(hint).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Test 7: primaryCells contains exactly the two cells
// ---------------------------------------------------------------------------

describe('detectHiddenPair — primaryCells', () => {
    test('primaryCells contains exactly the two hidden-pair cells', () => {
        const sets = defaultCandidates()
        // d1=6, d2=9 appear ONLY in (5,1) and (5,7) in row 5
        for (let c = 0; c < 9; c++) {
            sets[5]![c] = new Set([1, 2, 3, 4, 5])
        }
        sets[5]![1] = new Set([1, 4, 6, 9])
        sets[5]![7] = new Set([2, 3, 6, 9])

        const board = emptyBoard()
        const hint = detectHiddenPair(board, makeBoard(sets))

        expect(hint).not.toBeNull()
        expect(hint!.primaryCells).toHaveLength(2)
        const coords = hint!.primaryCells.map(([r, c]) => `${r},${c}`)
        expect(coords).toContain('5,1')
        expect(coords).toContain('5,7')
    })
})
