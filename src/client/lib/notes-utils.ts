import { SvelteSet } from 'svelte/reactivity'
import type { NotesBoard } from './types'

export type CellCoord = readonly [row: number, col: number]

export const getPeers = (row: number, col: number): CellCoord[] => {
    const peers: CellCoord[] = []

    // Row peers
    for (let c = 0; c < 9; c++) {
        if (c !== col) peers.push([row, c])
    }

    // Column peers
    for (let r = 0; r < 9; r++) {
        if (r !== row) peers.push([r, col])
    }

    // Box peers (excluding already-added row/col peers)
    const boxRow = Math.floor(row / 3) * 3
    const boxCol = Math.floor(col / 3) * 3
    for (let r = boxRow; r < boxRow + 3; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) {
            if (r !== row && c !== col) peers.push([r, c])
        }
    }

    return peers
}

export const createEmptyNotesBoard = (): NotesBoard =>
    Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, () => new SvelteSet<number>())
    )

export const toggleNote = (notesBoard: NotesBoard, row: number, col: number, digit: number): void => {
    const notes = notesBoard[row]![col]!
    if (notes.has(digit)) {
        notes.delete(digit)
    } else {
        notes.add(digit)
    }
}

export const clearCellNotes = (notesBoard: NotesBoard, row: number, col: number): void => {
    notesBoard[row]![col]!.clear()
}

export const cleanupNotes = (notesBoard: NotesBoard, row: number, col: number, digit: number): void => {
    const peers = getPeers(row, col)
    for (const [r, c] of peers) {
        notesBoard[r]![c]!.delete(digit)
    }
}
