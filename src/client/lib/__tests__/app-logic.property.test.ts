import * as fc from 'fast-check'
import { SvelteSet } from 'svelte/reactivity'
import { describe, it } from 'vitest'
import { applyAutoCandidates, applyAutoNotes, applyMultiErase } from '../app-logic'
import { captureSnapshot, restoreNotesBoard } from '../undo-stack'
import { cellKey, computeRectSelection, parseKey } from '../selection-utils'
import type { Selection } from '../selection-utils'
import type { CellState, NotesBoard } from '../types'

// Arbitrary for valid grid coordinates [0,8]
const validCoord = fc.integer({ min: 0, max: 8 })

// Arbitrary for a digit 1–9
const validDigit = fc.integer({ min: 1, max: 9 })

// Arbitrary for a CellState
const cellState = fc.record({
    value: fc.integer({ min: 0, max: 9 }),
    isGiven: fc.boolean(),
    hasConflict: fc.boolean(),
}).map((c): CellState => ({
    // given cells must have a non-zero value
    value: c.isGiven ? fc.sample(fc.integer({ min: 1, max: 9 }), 1)[0]! : c.value,
    isGiven: c.isGiven,
    hasConflict: c.hasConflict,
}))

// Build a 9x9 board
const boardArb: fc.Arbitrary<CellState[][]> = fc.array(
    fc.array(cellState, { minLength: 9, maxLength: 9 }),
    { minLength: 9, maxLength: 9 },
)

// Build a 9x9 NotesBoard with random notes
const notesBoardArb: fc.Arbitrary<NotesBoard> = fc.array(
    fc.array(
        fc.array(validDigit, { minLength: 0, maxLength: 9 }).map(
            (digits) => new SvelteSet(digits),
        ),
        { minLength: 9, maxLength: 9 },
    ),
    { minLength: 9, maxLength: 9 },
)

// Clone a NotesBoard so we can compare before/after
const cloneNotesBoard = (nb: NotesBoard): NotesBoard =>
    nb.map((row) => row.map((cell) => new SvelteSet(cell)))

// Build a multi-selection (size >= 2) from two distinct coordinate pairs using computeRectSelection
const multiSelectionArb: fc.Arbitrary<Selection> = fc
    .tuple(
        fc.tuple(validCoord, validCoord),
        fc.tuple(validCoord, validCoord),
    )
    .map(([coord1, coord2]) => computeRectSelection(coord1, coord2))
    .filter((sel) => sel.cells.size >= 2)

describe('app-logic property tests', () => {
    /**
     * Feature: multi-cell-selection, Property 6
     * Auto-notes targets only empty non-given cells
     * Validates: Requirements 5.1, 5.2
     */
    it('Property 6: Auto-notes targets only empty non-given cells', () => {
        fc.assert(
            fc.property(boardArb, notesBoardArb, multiSelectionArb, validDigit, (board, notesBoard, selection, digit) => {
                const before = cloneNotesBoard(notesBoard)

                applyAutoNotes(board, notesBoard, selection, digit)

                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        const cell = board[r]?.[c]
                        const inSelection = selection.cells.has(cellKey(r, c))
                        const isEligible = cell !== undefined && !cell.isGiven && cell.value === 0

                        const beforeNotes = before[r]?.[c]!
                        const afterNotes = notesBoard[r]?.[c]!

                        if (inSelection && isEligible) {
                            // Eligible cells in selection: note should be toggled
                            const wasPresent = beforeNotes.has(digit)
                            const isPresent = afterNotes.has(digit)
                            if (wasPresent === isPresent) return false
                        } else {
                            // All other cells: notes must be unchanged
                            if (beforeNotes.size !== afterNotes.size) return false
                            for (const d of beforeNotes) {
                                if (!afterNotes.has(d)) return false
                            }
                        }
                    }
                }
                return true
            }),
            { numRuns: 100 },
        )
    })

    /**
     * Feature: multi-cell-selection, Property 7
     * Multi-erase clears notes only on empty non-given cells in selection
     * Validates: Requirements 6.1, 6.2
     */
    it('Property 7: Multi-erase clears notes only on empty non-given cells in selection', () => {
        fc.assert(
            fc.property(boardArb, notesBoardArb, multiSelectionArb, (board, notesBoard, selection) => {
                const before = cloneNotesBoard(notesBoard)

                applyMultiErase(board, notesBoard, selection)

                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        const cell = board[r]?.[c]
                        const inSelection = selection.cells.has(cellKey(r, c))
                        const isEligible = cell !== undefined && !cell.isGiven

                        const afterNotes = notesBoard[r]?.[c]!
                        const beforeNotes = before[r]?.[c]!

                        if (inSelection && isEligible) {
                            // Eligible cells in selection: notes must be cleared
                            if (afterNotes.size !== 0) return false
                        } else {
                            // All other cells: notes must be unchanged
                            if (beforeNotes.size !== afterNotes.size) return false
                            for (const d of beforeNotes) {
                                if (!afterNotes.has(d)) return false
                            }
                        }
                    }
                }
                return true
            }),
            { numRuns: 100 },
        )
    })

    /**
     * Feature: auto-candidate-notes, Property 2
     * Non-empty cells unchanged: after applyAutoCandidates, notes for given
     * cells and filled cells are identical to their pre-operation state.
     * Validates: Requirements 2.1, 2.2
     */
    it('Property 2: Non-empty cells unchanged', () => {
        fc.assert(
            fc.property(boardArb, notesBoardArb, (board, notesBoard) => {
                const before = cloneNotesBoard(notesBoard)

                applyAutoCandidates(board, notesBoard)

                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        const cell = board[r]?.[c]
                        if (!cell) continue

                        // Only check given cells and filled cells
                        if (!cell.isGiven && cell.value === 0) continue

                        const beforeNotes = before[r]?.[c]!
                        const afterNotes = notesBoard[r]?.[c]!

                        // Notes must be identical
                        if (beforeNotes.size !== afterNotes.size) return false
                        for (const d of beforeNotes) {
                            if (!afterNotes.has(d)) return false
                        }
                    }
                }
                return true
            }),
            { numRuns: 100 },
        )
    })

    /**
     * Feature: auto-candidate-notes, Property 3
     * Board immutability: after applyAutoCandidates, every cell's value,
     * isGiven, and hasConflict fields are identical to before the operation.
     * Validates: Requirements 1.4
     */
    it('Property 3: Board immutability', () => {
        fc.assert(
            fc.property(boardArb, notesBoardArb, (board, notesBoard) => {
                // Deep-clone the board before the operation
                const before = board.map((row) => row.map((cell) => ({ ...cell })))

                applyAutoCandidates(board, notesBoard)

                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        const original = before[r]![c]!
                        const current = board[r]![c]!
                        if (current.value !== original.value) return false
                        if (current.isGiven !== original.isGiven) return false
                        if (current.hasConflict !== original.hasConflict) return false
                    }
                }
                return true
            }),
            { numRuns: 100 },
        )
    })

    /**
     * Feature: auto-candidate-notes, Property 5
     * Idempotency: applying applyAutoCandidates twice without board changes
     * produces the same notes state as applying once.
     * Validates: Requirements 5.1
     */
    it('Property 5: Idempotency', () => {
        fc.assert(
            fc.property(boardArb, notesBoardArb, (board, notesBoard) => {
                applyAutoCandidates(board, notesBoard)

                const afterFirst = cloneNotesBoard(notesBoard)

                applyAutoCandidates(board, notesBoard)

                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        const first = afterFirst[r]![c]!
                        const second = notesBoard[r]![c]!

                        if (first.size !== second.size) return false
                        for (const d of first) {
                            if (!second.has(d)) return false
                        }
                    }
                }
                return true
            }),
            { numRuns: 100 },
        )
    })

    /**
     * Feature: auto-candidate-notes, Property 4
     * Undo round-trip: capturing a snapshot, applying applyAutoCandidates,
     * then restoring the snapshot produces notes identical to the original.
     * **Validates: Requirements 3.2**
     */
    it('Property 4: Undo round-trip', () => {
        fc.assert(
            fc.property(boardArb, notesBoardArb, (board, notesBoard) => {
                const original = cloneNotesBoard(notesBoard)

                const snapshot = captureSnapshot(board, notesBoard, 0)

                applyAutoCandidates(board, notesBoard)

                const restored = restoreNotesBoard(snapshot.notes)

                // Verify restored matches original
                if (restored.length !== original.length) return false
                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        const orig = original[r]![c]!
                        const rest = restored[r]![c]!
                        if (orig.size !== rest.size) return false
                        for (const d of orig) {
                            if (!rest.has(d)) return false
                        }
                    }
                }
                return true
            }),
            { numRuns: 100 },
        )
    })

    /**
     * Feature: auto-candidate-notes, Property 1
     * Candidate correctness: after applyAutoCandidates, each empty non-given
     * cell's notes contain exactly the digits 1–9 not present in its row,
     * column, or 3×3 box.
     * Validates: Requirements 1.1, 1.2, 1.3
     */
    it('Property 1: Candidate correctness', () => {
        fc.assert(
            fc.property(boardArb, notesBoardArb, (board, notesBoard) => {
                applyAutoCandidates(board, notesBoard)

                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        const cell = board[r]?.[c]
                        if (!cell || cell.isGiven || cell.value !== 0) continue

                        // Independently compute expected candidates
                        const used = new Set<number>()

                        // Row peers
                        for (let col = 0; col < 9; col++) {
                            const v = board[r]![col]!.value
                            if (v !== 0) used.add(v)
                        }
                        // Column peers
                        for (let row = 0; row < 9; row++) {
                            const v = board[row]![c]!.value
                            if (v !== 0) used.add(v)
                        }
                        // Box peers
                        const boxRow = Math.floor(r / 3) * 3
                        const boxCol = Math.floor(c / 3) * 3
                        for (let dr = 0; dr < 3; dr++) {
                            for (let dc = 0; dc < 3; dc++) {
                                const v = board[boxRow + dr]![boxCol + dc]!.value
                                if (v !== 0) used.add(v)
                            }
                        }

                        const expected = new Set<number>()
                        for (let d = 1; d <= 9; d++) {
                            if (!used.has(d)) expected.add(d)
                        }

                        const actual = notesBoard[r]![c]!

                        // Verify exact match
                        if (actual.size !== expected.size) return false
                        for (const d of expected) {
                            if (!actual.has(d)) return false
                        }
                    }
                }
                return true
            }),
            { numRuns: 100 },
        )
    })
})
