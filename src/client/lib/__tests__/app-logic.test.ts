import { describe, it, expect } from 'vitest'
import { SvelteSet } from 'svelte/reactivity'
import { applyAutoCandidates, hasAutoCandidates, clearAutoCandidates } from '../app-logic'
import type { CellState, NotesBoard } from '../types'

// Helper: create a 9×9 board of empty cells
const createEmptyBoard = (): CellState[][] =>
    Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, (): CellState => ({
            value: 0,
            isGiven: false,
            hasConflict: false,
        })),
    )

// Helper: create a 9×9 NotesBoard of empty SvelteSets
const createEmptyNotesBoard = (): NotesBoard =>
    Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, () => new SvelteSet<number>()),
    )

// A valid completed Sudoku grid (all isGiven: true)
const SOLVED_GRID: number[][] = [
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

const createSolvedBoard = (): CellState[][] =>
    SOLVED_GRID.map((row) =>
        row.map((value): CellState => ({
            value,
            isGiven: true,
            hasConflict: false,
        })),
    )

describe('applyAutoCandidates', () => {
    /**
     * Fully solved board produces no notes changes.
     * Validates: Requirement 6.1
     */
    it('fully solved board produces no notes changes', () => {
        const board = createSolvedBoard()
        const notesBoard = createEmptyNotesBoard()

        // Pre-populate some notes on a few cells to verify they stay untouched
        notesBoard[0]![0]!.add(1)
        notesBoard[0]![0]!.add(2)
        notesBoard[4]![4]!.add(7)

        applyAutoCandidates(board, notesBoard)

        // Notes should be completely unchanged
        expect(notesBoard[0]![0]!.has(1)).toBe(true)
        expect(notesBoard[0]![0]!.has(2)).toBe(true)
        expect(notesBoard[0]![0]!.size).toBe(2)
        expect(notesBoard[4]![4]!.has(7)).toBe(true)
        expect(notesBoard[4]![4]!.size).toBe(1)

        // A cell with no pre-existing notes should still be empty
        expect(notesBoard[8]![8]!.size).toBe(0)
    })

    /**
     * Board with conflicting values computes candidates based on current state.
     * Validates: Requirement 6.2
     */
    it('board with conflicting values computes candidates based on current state', () => {
        const board = createEmptyBoard()
        const notesBoard = createEmptyNotesBoard()

        // Place two 5s in row 0 (a conflict)
        board[0]![0]!.value = 5
        board[0]![3]!.value = 5

        applyAutoCandidates(board, notesBoard)

        // Empty cells in row 0 should exclude 5 (it appears in their row)
        // Cell (0,1) is empty — 5 should NOT be a candidate
        expect(notesBoard[0]![1]!.has(5)).toBe(false)

        // Filled cells should be untouched
        expect(notesBoard[0]![0]!.size).toBe(0)
        expect(notesBoard[0]![3]!.size).toBe(0)

        // A cell in a different row/col/box with no constraints should still have 5
        // Cell (5,5) shares no row/col/box with row 0 cells that have 5
        expect(notesBoard[5]![5]!.has(5)).toBe(true)
    })

    /**
     * Completely empty board sets all cells to {1..9}.
     * Validates: Requirement 6.3
     */
    it('completely empty board sets all cells to {1..9}', () => {
        const board = createEmptyBoard()
        const notesBoard = createEmptyNotesBoard()

        applyAutoCandidates(board, notesBoard)

        const fullSet = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const notes = notesBoard[r]![c]!
                expect(notes.size).toBe(9)
                for (const d of fullSet) {
                    expect(notes.has(d)).toBe(true)
                }
            }
        }
    })

    /**
     * Existing notes on empty cells are replaced, not merged.
     * Validates: Requirement 1.3
     */
    it('existing notes on empty cells are replaced, not merged', () => {
        const board = createEmptyBoard()
        const notesBoard = createEmptyNotesBoard()

        // Place a value so that candidates for (0,0) won't include all 9 digits
        board[0]![1]!.value = 1

        // Pre-populate (0,0) with notes that include 1 (which should be excluded after auto)
        notesBoard[0]![0]!.add(1)
        notesBoard[0]![0]!.add(2)

        applyAutoCandidates(board, notesBoard)

        // 1 is in row 0 via cell (0,1), so it must NOT be a candidate for (0,0)
        expect(notesBoard[0]![0]!.has(1)).toBe(false)

        // 2 through 9 should be candidates (only 1 is constrained)
        for (let d = 2; d <= 9; d++) {
            expect(notesBoard[0]![0]!.has(d)).toBe(true)
        }

        // Size should be exactly 8, not 9 (old note for 1 was replaced, not merged)
        expect(notesBoard[0]![0]!.size).toBe(8)
    })
})

describe('hasAutoCandidates', () => {
    it('returns false when notes are empty', () => {
        const board = createEmptyBoard()
        const notesBoard = createEmptyNotesBoard()

        expect(hasAutoCandidates(board, notesBoard)).toBe(false)
    })

    it('returns true when notes exactly match computed candidates', () => {
        const board = createEmptyBoard()
        const notesBoard = createEmptyNotesBoard()

        board[0]![0]!.value = 5

        applyAutoCandidates(board, notesBoard)

        expect(hasAutoCandidates(board, notesBoard)).toBe(true)
    })

    it('returns false when notes partially differ from candidates', () => {
        const board = createEmptyBoard()
        const notesBoard = createEmptyNotesBoard()

        board[0]![0]!.value = 5

        applyAutoCandidates(board, notesBoard)

        // Manually remove one candidate from a cell
        notesBoard[0]![1]!.delete(1)

        expect(hasAutoCandidates(board, notesBoard)).toBe(false)
    })

    it('returns true on fully solved board (no empty cells to check)', () => {
        const board = createSolvedBoard()
        const notesBoard = createEmptyNotesBoard()

        expect(hasAutoCandidates(board, notesBoard)).toBe(true)
    })
})

describe('clearAutoCandidates', () => {
    it('clears notes on all empty non-given cells', () => {
        const board = createEmptyBoard()
        const notesBoard = createEmptyNotesBoard()

        board[0]![0]!.value = 5

        applyAutoCandidates(board, notesBoard)
        clearAutoCandidates(board, notesBoard)

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = board[r]![c]!
                if (cell.value === 0 && !cell.isGiven) {
                    expect(notesBoard[r]![c]!.size).toBe(0)
                }
            }
        }
    })

    it('leaves notes on given and filled cells unchanged', () => {
        const board = createSolvedBoard()
        const notesBoard = createEmptyNotesBoard()

        notesBoard[0]![0]!.add(3)

        clearAutoCandidates(board, notesBoard)

        expect(notesBoard[0]![0]!.has(3)).toBe(true)
        expect(notesBoard[0]![0]!.size).toBe(1)
    })
})
