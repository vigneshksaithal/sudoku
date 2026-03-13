import type { CellState, CandidateBoard, TechniqueHint } from '../types'

type UnitCell = readonly [number, number]

const getRowCells = (r: number): UnitCell[] =>
    Array.from({ length: 9 }, (_, c) => [r, c] as const)

const getColCells = (c: number): UnitCell[] =>
    Array.from({ length: 9 }, (_, r) => [r, c] as const)

const getBoxCells = (b: number): UnitCell[] => {
    const boxRow = Math.floor(b / 3) * 3
    const boxCol = (b % 3) * 3
    const cells: UnitCell[] = []
    for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
            cells.push([boxRow + dr, boxCol + dc] as const)
        }
    }
    return cells
}

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
