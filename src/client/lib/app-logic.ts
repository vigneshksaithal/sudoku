import { clearCellNotes, cleanupNotes, toggleNote } from './notes-utils'
import { parseKey } from './selection-utils'
import type { Selection } from './selection-utils'
import { buildCandidateBoard } from './technique-hints/candidate-board'
import type { CellState, NotesBoard } from './types'

/**
 * Apply auto-notes: toggle `digit` on every empty non-given cell in `selection`.
 * Mutates `notesBoard` in place (same contract as toggleNote/clearCellNotes).
 * Returns the set of [row, col] pairs that were actually toggled.
 */
export const applyAutoNotes = (
    board: CellState[][],
    notesBoard: NotesBoard,
    selection: Selection,
    digit: number,
): ReadonlyArray<readonly [number, number]> => {
    const toggled: Array<readonly [number, number]> = []
    for (const key of selection.cells) {
        const [r, c] = parseKey(key)
        const cell = board[r]?.[c]
        if (!cell || cell.isGiven || cell.value !== 0) continue
        toggleNote(notesBoard, r, c, digit)
        toggled.push([r, c] as const)
    }
    return toggled
}

/**
 * Apply multi-erase: clear all notes from every empty non-given cell in `selection`.
 * Mutates `notesBoard` in place.
 * Returns the set of [row, col] pairs that were actually cleared.
 */
export const applyMultiErase = (
    board: CellState[][],
    notesBoard: NotesBoard,
    selection: Selection,
): ReadonlyArray<readonly [number, number]> => {
    const cleared: Array<readonly [number, number]> = []
    for (const key of selection.cells) {
        const [r, c] = parseKey(key)
        const cell = board[r]?.[c]
        if (!cell || cell.isGiven) continue
        clearCellNotes(notesBoard, r, c)
        cleared.push([r, c] as const)
    }
    return cleared
}

/**
 * Compute valid candidates for every empty non-given cell and write them
 * into `notesBoard`, replacing any existing notes. Given cells and filled
 * cells are left untouched. Mutates `notesBoard` in place.
 */
export const applyAutoCandidates = (
    board: CellState[][],
    notesBoard: NotesBoard,
): void => {
    const candidates = buildCandidateBoard(board)

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = board[r]?.[c]
            if (!cell || cell.isGiven || cell.value !== 0) continue

            const cellNotes = notesBoard[r]?.[c]
            if (!cellNotes) continue

            cellNotes.clear()
            for (const digit of candidates[r]![c]!) {
                cellNotes.add(digit)
            }
        }
    }
}


/**
 * Check whether every empty non-given cell's notes exactly match the
 * constraint-based candidates. Returns true when auto-candidates are
 * "active" (i.e. a second press should clear them).
 */
export const hasAutoCandidates = (
    board: CellState[][],
    notesBoard: NotesBoard,
): boolean => {
    const candidates = buildCandidateBoard(board)

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = board[r]?.[c]
            if (!cell || cell.isGiven || cell.value !== 0) continue

            const cellNotes = notesBoard[r]?.[c]
            const expected = candidates[r]![c]!
            if (!cellNotes || cellNotes.size !== expected.size) return false
            for (const d of expected) {
                if (!cellNotes.has(d)) return false
            }
        }
    }
    // No empty cells means nothing to toggle off — treat as "active"
    return true
}

/**
 * Clear notes on every empty non-given cell. Given cells and filled
 * cells are left untouched. Mutates `notesBoard` in place.
 */
export const clearAutoCandidates = (
    board: CellState[][],
    notesBoard: NotesBoard,
): void => {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = board[r]?.[c]
            if (!cell || cell.isGiven || cell.value !== 0) continue
            notesBoard[r]?.[c]?.clear()
        }
    }
}

/**
 * Place `digit` into every eligible cell in `selection`.
 * Eligible = not a given cell. Overwrites existing values.
 * Clears notes and cleans up peer notes for each placed cell.
 * Mutates `board` and `notesBoard` in place.
 * Returns the list of [row, col] pairs that received the digit.
 */
export const batchPlaceDigit = (
    board: CellState[][],
    notesBoard: NotesBoard,
    selection: Selection,
    digit: number,
): ReadonlyArray<readonly [number, number]> => {
    const placed: Array<readonly [number, number]> = []
    for (const key of selection.cells) {
        const [r, c] = parseKey(key)
        const cell = board[r]?.[c]
        if (!cell || cell.isGiven) continue
        cell.value = digit
        clearCellNotes(notesBoard, r, c)
        cleanupNotes(notesBoard, r, c, digit)
        placed.push([r, c] as const)
    }
    return placed
}

/**
 * Returns `true` if `digit` does not match the solution at `cellIndex`.
 * Pure function — no side effects.
 */
export const isMistake = (
    solution: readonly number[],
    cellIndex: number,
    digit: number,
): boolean => digit !== solution[cellIndex]

/**
 * Place `digit` into `board[row][col]` in digit-first mode.
 * Clears the cell's notes and removes the digit from all peer notes.
 * Returns `true` if placement occurred, `false` if skipped.
 */
export const placeLockedDigit = (
    board: CellState[][],
    notesBoard: NotesBoard,
    row: number,
    col: number,
    digit: number,
): boolean => {
    if (row < 0 || row > 8 || col < 0 || col > 8) return false
    const cell = board[row]?.[col]
    if (!cell || cell.isGiven) return false

    cell.value = digit
    clearCellNotes(notesBoard, row, col)
    cleanupNotes(notesBoard, row, col, digit)
    return true
}
