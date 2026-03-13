import { describe, expect, test } from 'vitest'
import { detectNakedPair } from '../naked-pair'
import type { CandidateBoard, CellState } from '../../types'

const emptyCell = (): CellState => ({ value: 0, isGiven: false, hasConflict: false })
const filledCell = (v: number): CellState => ({ value: v, isGiven: true, hasConflict: false })

const emptyBoard = (): CellState[][] =>
    Array.from({ length: 9 }, () => Array.from({ length: 9 }, emptyCell))

/** Build a 9×9 CandidateBoard from a 9×9 array of sets */
const makeBoard = (sets: ReadonlySet<number>[][]): CandidateBoard => sets

/** A 9×9 candidate board where every cell has 3 candidates {1,2,3} */
const defaultCandidates = (): ReadonlySet<number>[][] =>
    Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, () => new Set([1, 2, 3]))
    )

// ---------------------------------------------------------------------------
// Test 1: Finds a naked pair in a row
// ---------------------------------------------------------------------------

describe('detectNakedPair — row', () => {
    test('finds naked pair in row 0, returns elimination hint with 2 primaryCells', () => {
        const sets = defaultCandidates()
        // Naked pair at (0,0) and (0,1) with {4,5}
        sets[0]![0] = new Set([4, 5])
        sets[0]![1] = new Set([4, 5])
        // Other cells in row 0 contain 4 or 5 → eliminations exist
        sets[0]![2] = new Set([4, 7])
        sets[0]![3] = new Set([5, 8])

        const board = emptyBoard()
        const hint = detectNakedPair(board, makeBoard(sets))

        expect(hint).not.toBeNull()
        expect(hint!.action).toBe('elimination')
        expect(hint!.primaryCells).toHaveLength(2)
    })
})

// ---------------------------------------------------------------------------
// Test 2: Finds a naked pair in a column
// ---------------------------------------------------------------------------

describe('detectNakedPair — column', () => {
    test('finds naked pair in column 3', () => {
        const sets = defaultCandidates()
        // Naked pair at (2,3) and (5,3) with {6,7}
        sets[2]![3] = new Set([6, 7])
        sets[5]![3] = new Set([6, 7])
        // Another cell in col 3 has 6 → elimination exists
        sets[8]![3] = new Set([6, 9])

        const board = emptyBoard()
        const hint = detectNakedPair(board, makeBoard(sets))

        expect(hint).not.toBeNull()
        expect(hint!.action).toBe('elimination')
        expect(hint!.primaryCells).toHaveLength(2)
    })
})

// ---------------------------------------------------------------------------
// Test 3: Finds a naked pair in a box
// ---------------------------------------------------------------------------

describe('detectNakedPair — box', () => {
    test('finds naked pair in box 4 (center box)', () => {
        // Use a board where rows/cols have no pair but box does
        const sets: ReadonlySet<number>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set([1, 2, 3, 4]))
        )
        // Box 4 = rows 3-5, cols 3-5
        // Naked pair at (3,3) and (3,4) with {8,9}
        sets[3]![3] = new Set([8, 9])
        sets[3]![4] = new Set([8, 9])
        // Another cell in box 4 has 8 → elimination
        sets[4]![5] = new Set([8, 2])

        const board = emptyBoard()
        const hint = detectNakedPair(board, makeBoard(sets))

        expect(hint).not.toBeNull()
        expect(hint!.action).toBe('elimination')
    })
})

// ---------------------------------------------------------------------------
// Test 4: hint.eliminations lists correct cells and digits
// ---------------------------------------------------------------------------

describe('detectNakedPair — eliminations', () => {
    test('eliminations list correct cells and digits to remove', () => {
        const sets = defaultCandidates()
        // Naked pair at (1,0) and (1,1) with {2,3}
        sets[1]![0] = new Set([2, 3])
        sets[1]![1] = new Set([2, 3])
        // Cell (1,2) has {2,5} → should eliminate 2
        sets[1]![2] = new Set([2, 5])
        // Cell (1,5) has {3,7} → should eliminate 3
        sets[1]![5] = new Set([3, 7])
        // Cell (1,8) has {1,4} → no elimination (doesn't contain 2 or 3)
        sets[1]![8] = new Set([1, 4])

        const board = emptyBoard()
        const hint = detectNakedPair(board, makeBoard(sets))

        expect(hint).not.toBeNull()
        expect(hint!.eliminations).toBeDefined()

        const elims = hint!.eliminations!
        const cell12 = elims.find((e) => e.row === 1 && e.col === 2)
        const cell15 = elims.find((e) => e.row === 1 && e.col === 5)
        const cell18 = elims.find((e) => e.row === 1 && e.col === 8)

        expect(cell12).toBeDefined()
        expect(cell12!.digits).toContain(2)
        expect(cell12!.digits).not.toContain(3)

        expect(cell15).toBeDefined()
        expect(cell15!.digits).toContain(3)
        expect(cell15!.digits).not.toContain(2)

        expect(cell18).toBeUndefined()
    })
})

// ---------------------------------------------------------------------------
// Test 5: Returns null when pair exists but no other cell has those digits
// ---------------------------------------------------------------------------

describe('detectNakedPair — no useful eliminations', () => {
    test('returns null when naked pair exists but no other cell in unit has those digits', () => {
        const sets: ReadonlySet<number>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set([6, 7, 8]))
        )
        // Naked pair at (0,0) and (0,1) with {1,2}
        sets[0]![0] = new Set([1, 2])
        sets[0]![1] = new Set([1, 2])
        // All other cells in row 0 have {6,7,8} — no 1 or 2

        const board = emptyBoard()
        const hint = detectNakedPair(board, makeBoard(sets))

        expect(hint).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Test 6: Returns null when no naked pair exists at all
// ---------------------------------------------------------------------------

describe('detectNakedPair — no pair', () => {
    test('returns null when no two cells share identical 2-candidate sets', () => {
        const sets: ReadonlySet<number>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set([1, 2, 3]))
        )
        // All cells have 3 candidates — no naked pair

        const board = emptyBoard()
        const hint = detectNakedPair(board, makeBoard(sets))

        expect(hint).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Test 7: primaryCells contains exactly the two paired cells
// ---------------------------------------------------------------------------

describe('detectNakedPair — primaryCells', () => {
    test('primaryCells contains exactly the two paired cells', () => {
        const sets = defaultCandidates()
        sets[4]![2] = new Set([3, 9])
        sets[4]![7] = new Set([3, 9])
        // Another cell in row 4 has 3 → elimination exists
        sets[4]![0] = new Set([3, 6])

        const board = emptyBoard()
        const hint = detectNakedPair(board, makeBoard(sets))

        expect(hint).not.toBeNull()
        expect(hint!.primaryCells).toHaveLength(2)
        const coords = hint!.primaryCells.map(([r, c]) => `${r},${c}`)
        expect(coords).toContain('4,2')
        expect(coords).toContain('4,7')
    })
})
