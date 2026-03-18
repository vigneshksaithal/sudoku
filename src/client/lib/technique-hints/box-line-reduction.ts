import type { CellState, CandidateBoard, TechniqueHint } from '../types'
import { getBoxCells, buildEliminations } from './unit-cells'
import type { UnitCell } from './unit-cells'

const getBoxIndex = (r: number, c: number): number =>
    Math.floor(r / 3) * 3 + Math.floor(c / 3)

const candidateCellsInLine = (
    board: CellState[][],
    candidates: CandidateBoard,
    lineCells: UnitCell[],
    digit: number
): UnitCell[] =>
    lineCells.filter(([r, c]) => board[r]?.[c]?.value === 0 && candidates[r]?.[c]?.has(digit) === true)

const checkRow = (
    board: CellState[][],
    candidates: CandidateBoard,
    row: number,
    digit: number
): TechniqueHint | null => {
    const rowCells: UnitCell[] = Array.from({ length: 9 }, (_, c) => [row, c] as const)
    const aligned = candidateCellsInLine(board, candidates, rowCells, digit)
    if (aligned.length < 1) return null

    // All candidates in this row must lie in the same box
    const boxIdx = getBoxIndex(aligned[0]![0], aligned[0]![1])
    if (!aligned.every(([r, c]) => getBoxIndex(r, c) === boxIdx)) return null

    // Find other cells in that box outside this row that have the digit
    const boxCells = getBoxCells(boxIdx)
    const outsideCells = boxCells.filter(([r]) => r !== row)
    const eliminations = buildEliminations(candidates, outsideCells, digit)
    if (eliminations.length === 0) return null

    const boxNum = boxIdx + 1
    return {
        technique: 'box-line-reduction',
        difficulty: 'hard',
        title: 'Box/Line Reduction',
        description: `${digit} in row ${row + 1} is confined to box ${boxNum}. Remove it from other cells in that box.`,
        primaryCells: aligned,
        secondaryCells: [],
        action: 'elimination',
        digit,
        eliminations,
    }
}

const checkCol = (
    board: CellState[][],
    candidates: CandidateBoard,
    col: number,
    digit: number
): TechniqueHint | null => {
    const colCells: UnitCell[] = Array.from({ length: 9 }, (_, r) => [r, col] as const)
    const aligned = candidateCellsInLine(board, candidates, colCells, digit)
    if (aligned.length < 1) return null

    // All candidates in this col must lie in the same box
    const boxIdx = getBoxIndex(aligned[0]![0], aligned[0]![1])
    if (!aligned.every(([r, c]) => getBoxIndex(r, c) === boxIdx)) return null

    // Find other cells in that box outside this col that have the digit
    const boxCells = getBoxCells(boxIdx)
    const outsideCells = boxCells.filter(([, c]) => c !== col)
    const eliminations = buildEliminations(candidates, outsideCells, digit)
    if (eliminations.length === 0) return null

    const boxNum = boxIdx + 1
    return {
        technique: 'box-line-reduction',
        difficulty: 'hard',
        title: 'Box/Line Reduction',
        description: `${digit} in col ${col + 1} is confined to box ${boxNum}. Remove it from other cells in that box.`,
        primaryCells: aligned,
        secondaryCells: [],
        action: 'elimination',
        digit,
        eliminations,
    }
}

export const detectBoxLineReduction = (
    board: CellState[][],
    candidates: CandidateBoard
): TechniqueHint | null => {
    for (let row = 0; row < 9; row++) {
        for (let digit = 1; digit <= 9; digit++) {
            const hint = checkRow(board, candidates, row, digit)
            if (hint !== null) return hint
        }
    }
    for (let col = 0; col < 9; col++) {
        for (let digit = 1; digit <= 9; digit++) {
            const hint = checkCol(board, candidates, col, digit)
            if (hint !== null) return hint
        }
    }
    return null
}
