import { SvelteSet } from 'svelte/reactivity'

import type { CellState, NotesBoard } from './types'

export type Snapshot = {
    board: CellState[][]
    notes: Set<number>[][]
    hintsUsed: number
}

export type UndoStack = Snapshot[]

export const MAX_UNDO = 100

export const pushSnapshot = (stack: UndoStack, snapshot: Snapshot): UndoStack => {
    const next = [...stack, snapshot]
    return next.length > MAX_UNDO ? next.slice(next.length - MAX_UNDO) : next
}

export const popSnapshot = (stack: UndoStack): [Snapshot | null, UndoStack] => {
    if (stack.length === 0) return [null, stack]
    const last = stack[stack.length - 1] ?? null
    return [last, stack.slice(0, stack.length - 1)]
}

export const clearStack = (): UndoStack => []

export const captureSnapshot = (
    board: CellState[][],
    notesBoard: NotesBoard,
    hintsUsed: number
): Snapshot => ({
    board: board.map((row) => row.map((cell) => ({ ...cell }))),
    notes: notesBoard.map((row) => row.map((cell) => new Set<number>(cell))),
    hintsUsed,
})

export const restoreNotesBoard = (notes: Set<number>[][]): NotesBoard =>
    notes.map((row) => row.map((cell) => new SvelteSet<number>(cell)))
