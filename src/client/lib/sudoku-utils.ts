import type { CellState } from './types'

/** Parse an 81-char string into a 9×9 CellState grid. Non-zero cells are marked as given. */
export const parseBoard = (str: string): CellState[][] =>
    Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => {
            const value = Number(str[r * 9 + c])
            return { value, isGiven: value !== 0, hasConflict: false }
        })
    )

/** Flatten a CellState grid to an 81-character string. */
export const boardToString = (board: CellState[][]): string =>
    board.map((row) => row.map((cell) => cell.value).join('')).join('')

/** Check if the cell at (row, col) conflicts with any peer in its row, column, or 3×3 box. */
export const hasConflict = (board: CellState[][], row: number, col: number): boolean => {
    const value = board[row]![col]!.value
    if (value === 0) return false

    for (let c = 0; c < 9; c++) {
        if (c !== col && board[row]![c]!.value === value) return true
    }
    for (let r = 0; r < 9; r++) {
        if (r !== row && board[r]![col]!.value === value) return true
    }
    const boxRow = Math.floor(row / 3) * 3
    const boxCol = Math.floor(col / 3) * 3
    for (let r = boxRow; r < boxRow + 3; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) {
            if (r !== row && c !== col && board[r]![c]!.value === value) return true
        }
    }
    return false
}

/** Return a new board with hasConflict recalculated for every cell. Does not mutate input. */
export const updateConflicts = (board: CellState[][]): CellState[][] =>
    board.map((row, r) =>
        row.map((cell, c) => ({ ...cell, hasConflict: hasConflict(board, r, c) }))
    )

/** True when every cell is filled (non-zero) and no cell has a conflict. */
export const isComplete = (board: CellState[][]): boolean =>
    board.every((row) => row.every((cell) => cell.value !== 0 && !cell.hasConflict))

/** Count how many times each digit 1–9 appears on the board. Does not mutate input. */
export const countDigitPlacements = (board: CellState[][]): ReadonlyMap<number, number> => {
    const counts = new Map<number, number>()
    for (let d = 1; d <= 9; d++) counts.set(d, 0)
    for (const row of board) {
        for (const cell of row) {
            if (cell.value >= 1 && cell.value <= 9) {
                counts.set(cell.value, (counts.get(cell.value) ?? 0) + 1)
            }
        }
    }
    return counts
}
