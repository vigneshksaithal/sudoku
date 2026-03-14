import { describe, expect, test } from 'vitest'

import { buildCandidateBoard } from '../candidate-board'
import { detectNakedPair } from '../naked-pair'
import type { CellState } from '../../types'

const makeCell = (value: number): CellState => ({ value, isGiven: value !== 0, hasConflict: false })

const makeBoard = (values: number[][]): CellState[][] =>
    values.map((row) => row.map(makeCell))

const emptyBoard = (): CellState[][] =>
    makeBoard(Array.from({ length: 9 }, () => Array(9).fill(0) as number[]))

const ALL_DIGITS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])

// --- empty board ---

describe('buildCandidateBoard — empty board', () => {
    test('every cell has all 9 candidates', () => {
        const board = emptyBoard()
        const result = buildCandidateBoard(board)

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                expect(result[r]![c]).toEqual(ALL_DIGITS)
            }
        }
    })
})

// --- filled board ---

describe('buildCandidateBoard — filled board', () => {
    test('every cell has an empty candidate set', () => {
        // Use a valid solved board
        const values = [
            [5, 3, 4, 6, 7, 8, 9, 1, 2],
            [6, 7, 2, 1, 9, 5, 3, 4, 8],
            [1, 9, 8, 3, 4, 2, 5, 6, 7],
            [8, 5, 9, 7, 6, 1, 4, 2, 3],
            [4, 2, 6, 8, 5, 3, 7, 9, 1],
            [7, 1, 3, 9, 2, 4, 8, 5, 6],
            [9, 6, 1, 5, 3, 7, 2, 8, 4],
            [2, 8, 7, 4, 1, 9, 6, 3, 5],
            [3, 4, 5, 2, 8, 6, 1, 7, 9],
        ]
        const board = makeBoard(values)
        const result = buildCandidateBoard(board)

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                expect(result[r]![c]!.size).toBe(0)
            }
        }
    })
})

// --- partial board: row elimination ---

describe('buildCandidateBoard — partial board', () => {
    test('empty cell in a row with digits 1-8 has only {9} as candidate', () => {
        // Row 0: digits 1-8 placed, col 8 is empty
        const row0 = [1, 2, 3, 4, 5, 6, 7, 8, 0]
        const values = [row0, ...Array.from({ length: 8 }, () => Array(9).fill(0) as number[])]
        const board = makeBoard(values)
        const result = buildCandidateBoard(board)

        expect(result[0]![8]).toEqual(new Set([9]))
    })
})

// --- peer elimination: row + col + box ---

describe('buildCandidateBoard — peer elimination', () => {
    test('candidates exclude values from row, column, AND box peers', () => {
        // Place digit 1 in row 0 col 1 (same row as target)
        // Place digit 2 in row 1 col 0 (same col as target)
        // Place digit 3 in row 1 col 1 (same box as target, row 0 col 0)
        // Target cell: row 0, col 0 — should not have 1, 2, or 3
        const values = Array.from({ length: 9 }, () => Array(9).fill(0) as number[])
        values[0]![1] = 1  // same row
        values[1]![0] = 2  // same col
        values[1]![1] = 3  // same box
        const board = makeBoard(values)
        const result = buildCandidateBoard(board)

        const candidates = result[0]![0]!
        expect(candidates.has(1)).toBe(false)
        expect(candidates.has(2)).toBe(false)
        expect(candidates.has(3)).toBe(false)
        // 4-9 should still be candidates
        for (const d of [4, 5, 6, 7, 8, 9]) {
            expect(candidates.has(d)).toBe(true)
        }
    })
})

// --- pure function ---

describe('buildCandidateBoard — pure function', () => {
    test('does not mutate the input board', () => {
        const board = emptyBoard()
        const snapshot = board.map((row) => row.map((cell) => ({ ...cell })))
        buildCandidateBoard(board)

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                expect(board[r]![c]).toEqual(snapshot[r]![c])
            }
        }
    })
})

// --- Bug condition exploration: stale elimination hint re-detection ---

describe('buildCandidateBoard — bug condition: stale elimination hint', () => {
    // Board designed so cells (0,3) and (0,4) form a naked pair {4,5}
    // with eliminations in (0,5) and (0,6).
    // Row 0: [1,2,3, 0,0,0, 0,7,8] → empty cells get row-excluded {1,2,3,7,8}
    // Col 3: 9 at (3,3), 6 at (5,3) → (0,3) candidates = {4,5}
    // Col 4: 9 at (7,4), 6 at (8,4) → (0,4) candidates = {4,5}
    // (0,5) and (0,6) keep candidates {4,5,6,9} → naked pair eliminates 4,5 from them
    const nakedPairBoard = (): CellState[][] => {
        const values = Array.from({ length: 9 }, () => Array(9).fill(0) as number[])
        // Row 0 placements
        values[0] = [1, 2, 3, 0, 0, 0, 0, 7, 8]
        // Col 3: place 9 and 6 to constrain (0,3) to {4,5}
        values[3]![3] = 9
        values[5]![3] = 6
        // Col 4: place 9 and 6 to constrain (0,4) to {4,5}
        values[7]![4] = 9
        values[8]![4] = 6
        return makeBoard(values)
    }

    const makeEmptyNotesBoard = (): Set<number>[][] =>
        Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set<number>())
        )

    test('EXPECTED FAIL: after applying elimination, buildCandidateBoard(board, notesBoard) should exclude eliminated digits', () => {
        const board = nakedPairBoard()

        // Step 1: build candidates and find the naked pair
        const candidates = buildCandidateBoard(board)

        // Verify our board setup: (0,3) and (0,4) have exactly {4,5}
        expect(candidates[0]![3]).toEqual(new Set([4, 5]))
        expect(candidates[0]![4]).toEqual(new Set([4, 5]))
        // (0,5) and (0,6) have {4,5,6,9} — they contain the pair digits
        expect(candidates[0]![5]!.has(4)).toBe(true)
        expect(candidates[0]![5]!.has(5)).toBe(true)
        expect(candidates[0]![6]!.has(4)).toBe(true)
        expect(candidates[0]![6]!.has(5)).toBe(true)

        // Step 2: simulate applying the elimination — remove 4 and 5 from (0,5) and (0,6) in notesBoard
        const notesBoard = makeEmptyNotesBoard()
        // Populate notesBoard for affected cells with their candidates MINUS eliminated digits
        // (0,5) had {4,5,6,9}, after eliminating {4,5} → notes = {6,9}
        for (const d of [6, 9]) notesBoard[0]![5]!.add(d)
        // (0,6) had {4,5,6,9}, after eliminating {4,5} → notes = {6,9}
        for (const d of [6, 9]) notesBoard[0]![6]!.add(d)

        // Step 3: rebuild candidates incorporating notesBoard
        // On unfixed code, the second argument is ignored — candidates will be identical
        const candidatesAfter = buildCandidateBoard(board, notesBoard as never)

        // Step 4: assert eliminated digits are excluded from affected cells
        // This WILL FAIL on unfixed code because buildCandidateBoard ignores notesBoard
        expect(candidatesAfter[0]![5]!.has(4)).toBe(false)
        expect(candidatesAfter[0]![5]!.has(5)).toBe(false)
        expect(candidatesAfter[0]![6]!.has(4)).toBe(false)
        expect(candidatesAfter[0]![6]!.has(5)).toBe(false)

        // The non-eliminated digits should still be present
        expect(candidatesAfter[0]![5]!.has(6)).toBe(true)
        expect(candidatesAfter[0]![5]!.has(9)).toBe(true)
    })

    test('EXPECTED FAIL: same elimination hint should not be re-detected after elimination applied', () => {
        const board = nakedPairBoard()
        const candidates = buildCandidateBoard(board)

        // Verify the naked pair exists before elimination
        const hintBefore = detectNakedPair(board, candidates)
        expect(hintBefore).not.toBeNull()
        expect(hintBefore!.technique).toBe('naked-pair')
        expect(hintBefore!.eliminations).toBeDefined()
        expect(hintBefore!.eliminations!.length).toBeGreaterThan(0)

        // Populate notesBoard with full candidates for ALL empty cells (simulates auto-notes)
        const notesBoard = makeEmptyNotesBoard()
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                for (const d of candidates[r]![c]!) {
                    notesBoard[r]![c]!.add(d)
                }
            }
        }

        // Apply elimination: remove eliminated digits from notesBoard
        for (const elim of hintBefore!.eliminations ?? []) {
            for (const digit of elim.digits) {
                notesBoard[elim.row]![elim.col]!.delete(digit)
            }
        }

        // Rebuild candidates with notesBoard — eliminated digits should be gone
        const candidatesAfter = buildCandidateBoard(board, notesBoard as never)

        // Verify the eliminated digits are no longer candidates in the affected cells
        for (const elim of hintBefore!.eliminations ?? []) {
            for (const digit of elim.digits) {
                expect(candidatesAfter[elim.row]![elim.col]!.has(digit)).toBe(false)
            }
        }
    })
})

// ---------------------------------------------------------------------------
// Property 2: Preservation — Unchanged Candidate Computation Without Notes
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
// ---------------------------------------------------------------------------

import * as fc from 'fast-check'

/** Arbitrary: a single Sudoku cell value 0–9 (0 = empty) */
const cellValueArb = fc.integer({ min: 0, max: 9 })

/** Arbitrary: a 9×9 grid of cell values */
const boardValuesArb = fc.array(
    fc.array(cellValueArb, { minLength: 9, maxLength: 9 }),
    { minLength: 9, maxLength: 9 }
)

/** Arbitrary: a Set<number> containing a subset of digits 1–9 */
const notesCellArb = fc.subarray([1, 2, 3, 4, 5, 6, 7, 8, 9], { minLength: 0 }).map(
    (digits) => new Set(digits)
)

/** Arbitrary: a 9×9 grid of Set<number> (notesBoard) */
const notesBoardArb = fc.array(
    fc.array(notesCellArb, { minLength: 9, maxLength: 9 }),
    { minLength: 9, maxLength: 9 }
)

/** Build a 9×9 grid of empty Set<number> */
const makeEmptyNotesBoard = (): Set<number>[][] =>
    Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, () => new Set<number>())
    )

/** Compare two CandidateBoards for deep equality */
const candidateBoardsEqual = (
    a: ReadonlyArray<ReadonlyArray<ReadonlySet<number>>>,
    b: ReadonlyArray<ReadonlyArray<ReadonlySet<number>>>
): boolean => {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const setA = a[r]![c]!
            const setB = b[r]![c]!
            if (setA.size !== setB.size) return false
            for (const d of setA) {
                if (!setB.has(d)) return false
            }
        }
    }
    return true
}

/** Check if setA is a subset of setB */
const isSubset = (a: ReadonlySet<number>, b: ReadonlySet<number>): boolean => {
    for (const d of a) {
        if (!b.has(d)) return false
    }
    return true
}

describe('Property 2: Preservation — empty notesBoard produces identical results', () => {
    test('buildCandidateBoard(board) equals buildCandidateBoard(board, emptyNotesBoard) for any board', () => {
        fc.assert(
            fc.property(boardValuesArb, (values) => {
                const board = makeBoard(values)
                const emptyNotes = makeEmptyNotesBoard()

                const withoutNotes = buildCandidateBoard(board)
                const withEmptyNotes = buildCandidateBoard(board, emptyNotes as never)

                return candidateBoardsEqual(withoutNotes, withEmptyNotes)
            }),
            { numRuns: 100 }
        )
    })
})

describe('Property 2: Preservation — monotonicity (notes can only remove candidates)', () => {
    test('buildCandidateBoard(board, notesBoard) is always a subset of buildCandidateBoard(board) for any board and notesBoard', () => {
        fc.assert(
            fc.property(boardValuesArb, notesBoardArb, (values, notes) => {
                const board = makeBoard(values)

                const baseline = buildCandidateBoard(board)
                const withNotes = buildCandidateBoard(board, notes as never)

                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        if (!isSubset(withNotes[r]![c]!, baseline[r]![c]!)) {
                            return false
                        }
                    }
                }
                return true
            }),
            { numRuns: 100 }
        )
    })
})
