import type { CellState, CandidateBoard, TechniqueHint } from '../types'
import { detectNakedSingle } from './naked-single'
import { detectHiddenSingle } from './hidden-single'
import { detectNakedPair } from './naked-pair'
import { detectHiddenPair } from './hidden-pair'
import { detectPointingPair } from './pointing-pair'
import { detectBoxLineReduction } from './box-line-reduction'
import { detectAdvancedTechnique } from './advanced'
import { buildRevealHint, detectIncorrectEntry, detectIncorrectNote } from './fallback-hint'

const isBoardComplete = (board: CellState[][]): boolean =>
    board.every((row) => row.every((cell) => cell.value !== 0))

export const findTechniqueHint = (
    board: CellState[][],
    candidates: CandidateBoard,
    solution: number[]
): TechniqueHint | null => {
    const incorrect = detectIncorrectEntry(board, solution)
    if (incorrect !== null) return incorrect
    if (isBoardComplete(board)) return null

    return (
        detectIncorrectNote(board, candidates, solution) ??
        detectNakedSingle(board, candidates, solution) ??
        detectHiddenSingle(board, candidates, solution) ??
        detectNakedPair(board, candidates) ??
        detectHiddenPair(board, candidates) ??
        detectPointingPair(board, candidates) ??
        detectBoxLineReduction(board, candidates) ??
        detectAdvancedTechnique(board, candidates) ??
        buildRevealHint(board, candidates, solution)
    )
}
