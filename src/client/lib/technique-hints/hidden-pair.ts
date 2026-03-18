import type { CellState, CandidateBoard, TechniqueHint } from '../types'
import { getRowCells, getColCells, getBoxCells } from './unit-cells'
import type { UnitCell } from './unit-cells'

const cellsWithDigit = (
    candidates: CandidateBoard,
    cells: UnitCell[],
    digit: number
): UnitCell[] =>
    cells.filter(([r, c]) => candidates[r]?.[c]?.has(digit) === true)

const buildEliminations = (
    candidates: CandidateBoard,
    cell1: UnitCell,
    cell2: UnitCell,
    d1: number,
    d2: number
): Array<{ row: number; col: number; digits: number[] }> => {
    const result: Array<{ row: number; col: number; digits: number[] }> = []
    for (const [r, c] of [cell1, cell2]) {
        const s = candidates[r]?.[c]
        if (!s) continue
        const extras = [...s].filter((x) => x !== d1 && x !== d2)
        if (extras.length > 0) result.push({ row: r, col: c, digits: extras })
    }
    return result
}

const checkUnit = (
    board: CellState[][],
    candidates: CandidateBoard,
    cells: UnitCell[]
): TechniqueHint | null => {
    const emptyCells = cells.filter(([r, c]) => board[r]?.[c]?.value === 0)

    for (let d1 = 1; d1 <= 9; d1++) {
        for (let d2 = d1 + 1; d2 <= 9; d2++) {
            const d1Cells = cellsWithDigit(candidates, emptyCells, d1)
            const d2Cells = cellsWithDigit(candidates, emptyCells, d2)

            if (d1Cells.length !== 2 || d2Cells.length !== 2) continue

            const [[r1, c1], [r2, c2]] = d1Cells as [UnitCell, UnitCell]
            const [[r3, c3], [r4, c4]] = d2Cells as [UnitCell, UnitCell]

            const sameTwo =
                r1 === r3 && c1 === c3 && r2 === r4 && c2 === c4

            if (!sameTwo) continue

            const eliminations = buildEliminations(candidates, [r1, c1], [r2, c2], d1, d2)
            if (eliminations.length === 0) continue

            return {
                technique: 'hidden-pair',
                difficulty: 'medium',
                title: 'Hidden Pair',
                description: `${d1} and ${d2} can only go in R${r1 + 1}C${c1 + 1} and R${r2 + 1}C${c2 + 1}. Remove other candidates from these cells.`,
                primaryCells: [[r1, c1], [r2, c2]],
                secondaryCells: [],
                action: 'elimination',
                digit: d1,
                eliminations,
            }
        }
    }
    return null
}

export const detectHiddenPair = (
    board: CellState[][],
    candidates: CandidateBoard
): TechniqueHint | null => {
    for (let r = 0; r < 9; r++) {
        const hint = checkUnit(board, candidates, getRowCells(r))
        if (hint !== null) return hint
    }
    for (let c = 0; c < 9; c++) {
        const hint = checkUnit(board, candidates, getColCells(c))
        if (hint !== null) return hint
    }
    for (let b = 0; b < 9; b++) {
        const hint = checkUnit(board, candidates, getBoxCells(b))
        if (hint !== null) return hint
    }
    return null
}
