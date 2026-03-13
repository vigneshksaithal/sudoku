import { describe, expect, test } from 'vitest'
import { detectBoxLineReduction } from '../box-line-reduction'
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
// Test 1: Finds a box/line reduction in a row
// ---------------------------------------------------------------------------

describe('detectBoxLineReduction — row restriction', () => {
    test('finds box/line reduction when digit in row 0 is confined to box 0', () => {
        // Row 0: digit 7 appears only in (0,0) and (0,2) — both in box 0 (cols 0-2)
        // Box 0 also has digit 7 in (1,1) and (2,0) — these should be eliminated
        const sets = defaultCandidates()

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const s = new Set(sets[r]![c]!)
                s.delete(7)
                sets[r]![c] = s
            }
        }

        // Row 0 candidates for digit 7 — all in box 0
        sets[0]![0] = new Set([...sets[0]![0]!, 7])
        sets[0]![2] = new Set([...sets[0]![2]!, 7])

        // Other cells in box 0 outside row 0 that also have digit 7
        sets[1]![1] = new Set([...sets[1]![1]!, 7])
        sets[2]![0] = new Set([...sets[2]![0]!, 7])

        const hint = detectBoxLineReduction(emptyBoard(), makeBoard(sets))

        expect(hint).not.toBeNull()
        expect(hint!.technique).toBe('box-line-reduction')
        expect(hint!.action).toBe('elimination')
        expect(hint!.digit).toBe(7)
    })
})

// ---------------------------------------------------------------------------
// Test 2: Finds a box/line reduction in a column
// ---------------------------------------------------------------------------

describe('detectBoxLineReduction — column restriction', () => {
    test('finds box/line reduction when digit in col 4 is confined to box 4', () => {
        // Col 4: digit 9 appears only in (3,4) and (5,4) — both in box 4 (rows 3-5)
        // Box 4 also has digit 9 in (3,3) and (4,5) — these should be eliminated
        const sets = defaultCandidates()

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const s = new Set(sets[r]![c]!)
                s.delete(9)
                sets[r]![c] = s
            }
        }

        // Col 4 candidates for digit 9 — all in box 4
        sets[3]![4] = new Set([...sets[3]![4]!, 9])
        sets[5]![4] = new Set([...sets[5]![4]!, 9])

        // Other cells in box 4 outside col 4 that also have digit 9
        sets[3]![3] = new Set([...sets[3]![3]!, 9])
        sets[4]![5] = new Set([...sets[4]![5]!, 9])

        const hint = detectBoxLineReduction(emptyBoard(), makeBoard(sets))

        expect(hint).not.toBeNull()
        expect(hint!.technique).toBe('box-line-reduction')
        expect(hint!.action).toBe('elimination')
        expect(hint!.digit).toBe(9)
    })
})

// ---------------------------------------------------------------------------
// Test 3: primaryCells contains only cells in the row/col within the box
// ---------------------------------------------------------------------------

describe('detectBoxLineReduction — primaryCells', () => {
    test('primaryCells are the row cells within the box', () => {
        // Row 6: digit 3 appears only in (6,6) and (6,7) — both in box 8 (cols 6-8)
        // Box 8 also has digit 3 in (7,8) — should be eliminated
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
        sets[7]![8] = new Set([...sets[7]![8]!, 3])

        const hint = detectBoxLineReduction(emptyBoard(), makeBoard(sets))

        expect(hint).not.toBeNull()
        // All primary cells must be in row 6 and in box 8 (rows 6-8, cols 6-8)
        for (const [r, c] of hint!.primaryCells) {
            expect(r).toBe(6)
            expect(c).toBeGreaterThanOrEqual(6)
            expect(c).toBeLessThanOrEqual(8)
        }
    })
})

// ---------------------------------------------------------------------------
// Test 4: eliminations contains cells in the box outside the row/col
// ---------------------------------------------------------------------------

describe('detectBoxLineReduction — eliminations', () => {
    test('eliminations contains cells in the box outside the row', () => {
        // Row 0: digit 6 appears only in (0,0) and (0,1) — both in box 0
        // Box 0 also has digit 6 in (1,2) and (2,1)
        const sets = defaultCandidates()

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const s = new Set(sets[r]![c]!)
                s.delete(6)
                sets[r]![c] = s
            }
        }

        sets[0]![0] = new Set([...sets[0]![0]!, 6])
        sets[0]![1] = new Set([...sets[0]![1]!, 6])
        sets[1]![2] = new Set([...sets[1]![2]!, 6])
        sets[2]![1] = new Set([...sets[2]![1]!, 6])

        const hint = detectBoxLineReduction(emptyBoard(), makeBoard(sets))

        expect(hint).not.toBeNull()
        expect(hint!.eliminations).toBeDefined()
        const elims = hint!.eliminations!
        expect(elims.length).toBeGreaterThan(0)

        // All elimination cells must be in box 0 (rows 0-2, cols 0-2) but NOT in row 0
        for (const { row, col, digits } of elims) {
            expect(row).toBeGreaterThan(0) // outside row 0
            expect(row).toBeLessThanOrEqual(2) // still in box 0
            expect(col).toBeGreaterThanOrEqual(0)
            expect(col).toBeLessThanOrEqual(2)
            expect(digits).toContain(6)
        }
    })
})

// ---------------------------------------------------------------------------
// Test 5: Returns null when digit in row spans multiple boxes
// ---------------------------------------------------------------------------

describe('detectBoxLineReduction — not confined to one box', () => {
    test('returns null when digit in row spans multiple boxes', () => {
        // Row 0: digit 8 appears in (0,0) and (0,5) — different boxes (box 0 and box 1)
        const sets = defaultCandidates()

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const s = new Set(sets[r]![c]!)
                s.delete(8)
                sets[r]![c] = s
            }
        }

        sets[0]![0] = new Set([...sets[0]![0]!, 8])
        sets[0]![5] = new Set([...sets[0]![5]!, 8])

        const hint = detectBoxLineReduction(emptyBoard(), makeBoard(sets))

        expect(hint).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Test 6: Returns null when confined to one box but no other cells in box have the digit
// ---------------------------------------------------------------------------

describe('detectBoxLineReduction — no eliminations possible', () => {
    test('returns null when confined to box but no other box cells have the digit', () => {
        // Row 0: digit 7 appears only in (0,0) — confined to box 0
        // Col 0: digit 7 appears only in (0,0) — confined to box 0
        // Box 0: digit 7 appears only in (0,0) — no other box cells to eliminate from
        // So no eliminations are possible → should return null
        const sets: ReadonlySet<number>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set<number>())
        )

        // Only a single cell has digit 7 — no other cells in the box to eliminate from
        sets[0]![0] = new Set([7])

        const hint = detectBoxLineReduction(emptyBoard(), makeBoard(sets))

        expect(hint).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Test 7: Returns null on empty board (no candidates)
// ---------------------------------------------------------------------------

describe('detectBoxLineReduction — empty candidates', () => {
    test('returns null when all candidate sets are empty', () => {
        const sets: ReadonlySet<number>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set<number>())
        )

        const hint = detectBoxLineReduction(emptyBoard(), makeBoard(sets))

        expect(hint).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Test 8: Checks rows first, then columns (deterministic order)
// ---------------------------------------------------------------------------

describe('detectBoxLineReduction — deterministic order', () => {
    test('returns a row-based reduction when both row and col reductions exist', () => {
        // Set up a row-based reduction in row 0 (box 0)
        // AND a col-based reduction in col 0 (box 0)
        // The row-based one should be returned first
        const sets = defaultCandidates()

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const s = new Set(sets[r]![c]!)
                s.delete(7)
                s.delete(8)
                sets[r]![c] = s
            }
        }

        // Row 0 reduction: digit 7 in (0,0),(0,1) → box 0; also in (1,2),(2,2)
        sets[0]![0] = new Set([...sets[0]![0]!, 7])
        sets[0]![1] = new Set([...sets[0]![1]!, 7])
        sets[1]![2] = new Set([...sets[1]![2]!, 7])
        sets[2]![2] = new Set([...sets[2]![2]!, 7])

        const hint = detectBoxLineReduction(emptyBoard(), makeBoard(sets))

        expect(hint).not.toBeNull()
        // The primary cells should be in row 0 (row-based reduction found first)
        const rows = hint!.primaryCells.map(([r]) => r)
        expect(rows.every((r) => r === 0)).toBe(true)
    })
})
