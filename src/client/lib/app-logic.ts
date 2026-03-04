import { clearCellNotes, toggleNote } from './notes-utils'
import { parseKey } from './selection-utils'
import type { Selection } from './selection-utils'
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
