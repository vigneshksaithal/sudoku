import type { CellState, CandidateBoard, TechniqueHint } from '../types'

const cellName = (r: number, c: number): string => `R${r + 1}C${c + 1}`

/** First player-entered digit that does not match the solution, as a hint to clear it.
 *  Logical hints built on an incorrect board can mislead, so this takes priority. */
export const detectIncorrectEntry = (
    board: CellState[][],
    solution: number[]
): TechniqueHint | null => {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = board[r]?.[c]
            if (!cell || cell.isGiven || cell.value === 0) continue
            const solutionDigit = solution[r * 9 + c]
            if (solutionDigit === undefined || cell.value === solutionDigit) continue
            return {
                technique: 'incorrect-entry',
                difficulty: 'assist',
                title: `Check ${cellName(r, c)}`,
                description: `The ${cell.value} in ${cellName(r, c)} does not match the solution. Clear it before looking for the next step.`,
                primaryCells: [[r, c]],
                secondaryCells: [],
                action: 'clear',
                digit: cell.value,
            }
        }
    }
    return null
}

/** First empty cell whose candidates (player notes, if any) no longer include its
 *  solution digit. Hints are only sound while every cell keeps its correct digit. */
export const detectIncorrectNote = (
    board: CellState[][],
    candidates: CandidateBoard,
    solution: number[]
): TechniqueHint | null => {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r]?.[c]?.value !== 0) continue
            const cellCandidates = candidates[r]?.[c]
            const solutionDigit = solution[r * 9 + c]
            if (!cellCandidates || cellCandidates.size === 0 || solutionDigit === undefined) continue
            if (cellCandidates.has(solutionDigit)) continue
            return {
                technique: 'incorrect-note',
                difficulty: 'assist',
                title: `Check notes in ${cellName(r, c)}`,
                description: `The notes in ${cellName(r, c)} are missing a digit that belongs there. Apply to restore every possible digit in that cell.`,
                primaryCells: [[r, c]],
                secondaryCells: [],
                action: 'restore-notes',
                digit: 0,
            }
        }
    }
    return null
}

/** Offer to reveal one correct digit when no explainable technique is available.
 *  Picks the empty cell with the fewest candidates (first by position on ties). */
export const buildRevealHint = (
    board: CellState[][],
    candidates: CandidateBoard,
    solution: number[]
): TechniqueHint | null => {
    let best: [number, number] | null = null
    let bestCount = Number.POSITIVE_INFINITY
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r]?.[c]?.value !== 0) continue
            const count = candidates[r]?.[c]?.size ?? 9
            if (count < bestCount) {
                best = [r, c]
                bestCount = count
            }
        }
    }
    if (best === null) return null
    const [r, c] = best
    const digit = solution[r * 9 + c]
    if (digit === undefined || digit < 1 || digit > 9) return null
    return {
        technique: 'reveal',
        difficulty: 'assist',
        title: `Reveal ${cellName(r, c)}`,
        description: `No step using the techniques this game explains is available right now. Apply to reveal the correct digit for ${cellName(r, c)}.`,
        primaryCells: [[r, c]],
        secondaryCells: [],
        action: 'placement',
        digit,
    }
}
