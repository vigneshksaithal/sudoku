import * as fc from 'fast-check'
import { SvelteSet } from 'svelte/reactivity'
import { describe, it } from 'vitest'
import { applyAutoNotes, applyMultiErase } from '../app-logic'
import { cellKey, extendSelection, parseKey } from '../selection-utils'
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

// Build a multi-selection (size >= 2) from a list of at least 2 distinct cells
const multiSelectionArb: fc.Arbitrary<Selection> = fc
    .array(fc.tuple(validCoord, validCoord), { minLength: 2, maxLength: 15 })
    .map((cells) =>
        cells.reduce<Selection>(
            (sel, [r, c]) => extendSelection(sel, r, c),
            { cells: new Set(), focusCell: null },
        ),
    )
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
})
