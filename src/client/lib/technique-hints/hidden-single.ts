import type { CellState, CandidateBoard, TechniqueHint } from '../types'
import { getRowCells, getColCells, getBoxCells } from './unit-cells'
import type { UnitCell } from './unit-cells'

const checkUnit = (
    board: CellState[][],
    candidates: CandidateBoard,
    solution: number[],
    cells: UnitCell[],
    unitName: string
): TechniqueHint | null => {
    for (let digit = 1; digit <= 9; digit++) {
        const matches = cells.filter(([r, c]) => {
            const cell = board[r]?.[c]
            return cell !== undefined && cell.value === 0 && (candidates[r]?.[c]?.has(digit) ?? false)
        })
        if (matches.length !== 1) continue

        const [r, c] = matches[0]!
        const solutionDigit = solution[r * 9 + c]
        if (solutionDigit === undefined || solutionDigit !== digit) continue

        return {
            technique: 'hidden-single',
            difficulty: 'easy',
            title: `Hidden Single in R${r + 1}C${c + 1}`,
            description: `${digit} can only go in R${r + 1}C${c + 1} within this ${unitName}.`,
            primaryCells: [[r, c]],
            secondaryCells: [],
            action: 'placement',
            digit,
        }
    }
    return null
}

export const detectHiddenSingle = (
    board: CellState[][],
    candidates: CandidateBoard,
    solution: number[]
): TechniqueHint | null => {
    for (let r = 0; r < 9; r++) {
        const hint = checkUnit(board, candidates, solution, getRowCells(r), 'row')
        if (hint !== null) return hint
    }
    for (let c = 0; c < 9; c++) {
        const hint = checkUnit(board, candidates, solution, getColCells(c), 'column')
        if (hint !== null) return hint
    }
    for (let b = 0; b < 9; b++) {
        const hint = checkUnit(board, candidates, solution, getBoxCells(b), 'box')
        if (hint !== null) return hint
    }
    return null
}
