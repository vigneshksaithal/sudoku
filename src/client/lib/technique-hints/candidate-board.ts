import type { CellState, CandidateBoard, NotesBoard } from '../types'

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

const collectPeerValues = (board: CellState[][], r: number, c: number): Set<number> => {
    const used = new Set<number>()
    // row peers
    for (let col = 0; col < 9; col++) {
        const v = board[r]![col]!.value
        if (v !== 0) used.add(v)
    }
    // col peers
    for (let row = 0; row < 9; row++) {
        const v = board[row]![c]!.value
        if (v !== 0) used.add(v)
    }
    // box peers
    const boxRow = Math.floor(r / 3) * 3
    const boxCol = Math.floor(c / 3) * 3
    for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
            const v = board[boxRow + dr]![boxCol + dc]!.value
            if (v !== 0) used.add(v)
        }
    }
    return used
}

export const buildCandidateBoard = (board: CellState[][], notesBoard?: NotesBoard): CandidateBoard =>
    board.map((row, r) =>
        row.map((cell, c) => {
            if (cell.value !== 0) return new Set<number>()
            const used = collectPeerValues(board, r, c)
            const computed = new Set(DIGITS.filter((d) => !used.has(d)))
            const notes = notesBoard?.[r]?.[c]
            if (notes && notes.size > 0) {
                return new Set([...computed].filter((d) => notes.has(d)))
            }
            return computed
        })
    )
