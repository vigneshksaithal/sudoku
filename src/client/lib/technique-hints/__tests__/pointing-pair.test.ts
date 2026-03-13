import { describe, expect, test } from 'vitest'
import { detectPointingPair } from '../pointing-pair'
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
// Test 1: Finds a pointing pair aligned on a row
// ---------------------------------------------------------------------------

describe('detectPointingPair — row alignment', () => {
    test('finds pointing pair in box 0 aligned on row 1', () => {
        // Box 0 = rows 0-2, cols 0-2
        // digit 7 appears only in (1,0) and (1,2) within box 0 → aligned on row 1
        // digit 7 also appears in (1,4) and (1,7) outside the box → eliminations
        const sets = defaultCandidates()

        // Remove digit 7 from all cells first
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const s = new Set(sets[r]![c]!)
                s.delete(7)
                sets[r]![c] = s
            }
        }

        // Add digit 7 to the two pointing pair cells in box 0, row 1
        sets[1]![0] = new Set([...sets[1]![0]!, 7])
        sets[1]![2] = new Set([...sets[1]![2]!, 7])

        // Add digit 7 to cells outside box 0 in row 1 (these should be eliminated)
        sets[1]![4] = new Set([...sets[1]![4]!, 7])
        sets[1]![7] = new Set([...sets[1]![7]!, 7])

        const hint = detectPointingPair(emptyBoard(), makeBoard(sets))

        expect(hint).not.toBeNull()
        expect(hint!.action).toBe('elimination')
        expect(hint!.primaryCells.length).toBeGreaterThanOrEqual(2)
        // All primary cells should be in box 0 (rows 0-2, cols 0-2)
        for (const [r, c] of hint!.primaryCells) {
            expect(r).toBeGreaterThanOrEqual(0)
            expect(r).toBeLessThanOrEqual(2)
            expect(c).toBeGreaterThanOrEqual(0)
            expect(c).toBeLessThanOrEqual(2)
        }
    })
})

// ---------------------------------------------------------------------------
// Test 2: Finds a pointing pair aligned on a column
// ---------------------------------------------------------------------------

describe('detectPointingPair — column alignment', () => {
    test('finds pointing pair in box 4 aligned on column 4', () => {
        // Box 4 = rows 3-5, cols 3-5
        // digit 9 appears only in (3,4) and (5,4) within box 4 → aligned on col 4
        // digit 9 also appears in (0,4) and (8,4) outside the box → eliminations
        const sets = defaultCandidates()

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const s = new Set(sets[r]![c]!)
                s.delete(9)
                sets[r]![c] = s
            }
        }

        // Add digit 9 to the two pointing pair cells in box 4, col 4
        sets[3]![4] = new Set([...sets[3]![4]!, 9])
        sets[5]![4] = new Set([...sets[5]![4]!, 9])

        // Add digit 9 to cells outside box 4 in col 4
        sets[0]![4] = new Set([...sets[0]![4]!, 9])
        sets[8]![4] = new Set([...sets[8]![4]!, 9])

        const hint = detectPointingPair(emptyBoard(), makeBoard(sets))

        expect(hint).not.toBeNull()
        expect(hint!.action).toBe('elimination')
        // All primary cells should be in box 4 (rows 3-5, cols 3-5)
        for (const [r, c] of hint!.primaryCells) {
            expect(r).toBeGreaterThanOrEqual(3)
            expect(r).toBeLessThanOrEqual(5)
            expect(c).toBeGreaterThanOrEqual(3)
            expect(c).toBeLessThanOrEqual(5)
        }
    })
})

// ---------------------------------------------------------------------------
// Test 3: eliminations lists cells outside the box in the aligned row/col
// ---------------------------------------------------------------------------

describe('detectPointingPair — eliminations', () => {
    test('eliminations contains cells outside the box in the aligned row', () => {
        // Box 2 = rows 0-2, cols 6-8
        // digit 6 appears only in (0,6) and (0,8) within box 2 → aligned on row 0
        // digit 6 also appears in (0,1) and (0,3) outside the box
        const sets = defaultCandidates()

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const s = new Set(sets[r]![c]!)
                s.delete(6)
                sets[r]![c] = s
            }
        }

        sets[0]![6] = new Set([...sets[0]![6]!, 6])
        sets[0]![8] = new Set([...sets[0]![8]!, 6])
        sets[0]![1] = new Set([...sets[0]![1]!, 6])
        sets[0]![3] = new Set([...sets[0]![3]!, 6])

        const hint = detectPointingPair(emptyBoard(), makeBoard(sets))

        expect(hint).not.toBeNull()
        expect(hint!.eliminations).toBeDefined()
        const elims = hint!.eliminations!
        expect(elims.length).toBeGreaterThan(0)

        // All elimination cells must be in row 0 but outside box 2 (cols 6-8)
        for (const { row, col, digits } of elims) {
            expect(row).toBe(0)
            expect(col).toBeLessThan(6) // outside box 2
            expect(digits).toContain(6)
        }
    })
})

// ---------------------------------------------------------------------------
// Test 4: Returns null when candidates span multiple rows AND columns
// ---------------------------------------------------------------------------

describe('detectPointingPair — not aligned', () => {
    test('returns null when digit in box spans multiple rows and columns', () => {
        // digit 8 in box 0 appears in (0,0), (1,1), (2,2) — not aligned on any row or col
        const sets = defaultCandidates()

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const s = new Set(sets[r]![c]!)
                s.delete(8)
                sets[r]![c] = s
            }
        }

        sets[0]![0] = new Set([...sets[0]![0]!, 8])
        sets[1]![1] = new Set([...sets[1]![1]!, 8])
        sets[2]![2] = new Set([...sets[2]![2]!, 8])

        const hint = detectPointingPair(emptyBoard(), makeBoard(sets))

        expect(hint).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Test 5: Returns null when aligned but no other cells outside box have the digit
// ---------------------------------------------------------------------------

describe('detectPointingPair — no eliminations possible', () => {
    test('returns null when aligned but no cells outside box have the digit', () => {
        // digit 7 in box 0 appears only in (0,0) and (0,1) — aligned on row 0
        // but no other cells in row 0 have digit 7
        const sets = defaultCandidates()

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const s = new Set(sets[r]![c]!)
                s.delete(7)
                sets[r]![c] = s
            }
        }

        // Only the two box cells have digit 7, nothing outside
        sets[0]![0] = new Set([...sets[0]![0]!, 7])
        sets[0]![1] = new Set([...sets[0]![1]!, 7])

        const hint = detectPointingPair(emptyBoard(), makeBoard(sets))

        expect(hint).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Test 6: primaryCells contains only cells within the box
// ---------------------------------------------------------------------------

describe('detectPointingPair — primaryCells in box', () => {
    test('all primaryCells are within the box', () => {
        // Box 8 = rows 6-8, cols 6-8
        // digit 3 appears only in (6,6) and (6,7) within box 8 → aligned on row 6
        // digit 3 also appears in (6,2) outside the box
        const sets = defaultCandidates()

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const s = new Set(sets[r]![c]!)
                s.delete(3)
                sets[r]![c] = s
            }
        }

        sets[6]![6] = new Set([...sets[6]![6]!, 3])
        sets[6]![7] = new Set([...sets[6]![7]!, 3])
        sets[6]![2] = new Set([...sets[6]![2]!, 3])

        const hint = detectPointingPair(emptyBoard(), makeBoard(sets))

        expect(hint).not.toBeNull()
        // All primary cells must be in box 8 (rows 6-8, cols 6-8)
        for (const [r, c] of hint!.primaryCells) {
            expect(r).toBeGreaterThanOrEqual(6)
            expect(r).toBeLessThanOrEqual(8)
            expect(c).toBeGreaterThanOrEqual(6)
            expect(c).toBeLessThanOrEqual(8)
        }
    })
})
