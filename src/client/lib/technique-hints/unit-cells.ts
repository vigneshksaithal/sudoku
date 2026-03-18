import type { CandidateBoard } from '../types'

export type UnitCell = readonly [number, number]

export const getRowCells = (r: number): UnitCell[] =>
    Array.from({ length: 9 }, (_, c) => [r, c] as const)

export const getColCells = (c: number): UnitCell[] =>
    Array.from({ length: 9 }, (_, r) => [r, c] as const)

export const getBoxCells = (b: number): UnitCell[] => {
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

export const buildEliminations = (
    candidates: CandidateBoard,
    cells: UnitCell[],
    digit: number
): Array<{ row: number; col: number; digits: number[] }> =>
    cells
        .filter(([r, c]) => candidates[r]?.[c]?.has(digit) === true)
        .map(([r, c]) => ({ row: r, col: c, digits: [digit] }))
