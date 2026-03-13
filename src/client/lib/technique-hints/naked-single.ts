import type { CellState, CandidateBoard, TechniqueHint } from '../types'

export const detectNakedSingle = (
    board: CellState[][],
    candidates: CandidateBoard,
    solution: number[]
): TechniqueHint | null => {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = board[r]?.[c]
            if (!cell || cell.value !== 0) continue

            const cellCandidates = candidates[r]?.[c]
            if (!cellCandidates || cellCandidates.size !== 1) continue

            const digit = [...cellCandidates][0]
            if (digit === undefined) continue

            const solutionDigit = solution[r * 9 + c]
            if (solutionDigit === undefined || digit !== solutionDigit) continue

            return {
                technique: 'naked-single',
                difficulty: 'easy',
                title: `Naked Single in R${r + 1}C${c + 1}`,
                description: `R${r + 1}C${c + 1} can only be ${digit} — all other digits are eliminated by its peers.`,
                primaryCells: [[r, c]],
                secondaryCells: [],
                action: 'placement',
                digit,
            }
        }
    }
    return null
}
