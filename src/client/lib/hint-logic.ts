import type { CellState } from './types'
import type { HintCell } from './types'

export const isHintApplicable = (
    board: CellState[][],
    row: number,
    col: number,
    _solutionValue: number
): boolean => board[row]![col]!.value === 0 && !board[row]![col]!.isGiven

export const countValidCandidates = (board: CellState[][], row: number, col: number): number => {
    const boxRow = Math.floor(row / 3) * 3
    const boxCol = Math.floor(col / 3) * 3

    const usedInRow = new Set(board[row]!.map((c) => c.value))
    const usedInCol = new Set(board.map((r) => r[col]!.value))
    const usedInBox = new Set(
        Array.from({ length: 3 }, (_, dr) =>
            Array.from({ length: 3 }, (_, dc) => board[boxRow + dr]![boxCol + dc]!.value)
        ).flat()
    )

    let count = 0
    for (let digit = 1; digit <= 9; digit++) {
        if (!usedInRow.has(digit) && !usedInCol.has(digit) && !usedInBox.has(digit)) {
            count++
        }
    }
    return count
}

export const getBestHintCell = (board: CellState[][], solution: number[]): HintCell | null => {
    let bestCell: HintCell | null = null
    let minCandidates = 10

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = board[row]![col]!
            if (cell.value !== 0 || cell.isGiven) continue

            const solutionValue = solution[row * 9 + col]
            if (!solutionValue) continue

            const candidateCount = countValidCandidates(board, row, col)
            if (candidateCount < minCandidates) {
                minCandidates = candidateCount
                bestCell = { row, col, value: solutionValue }
            }
        }
    }

    return bestCell
}
