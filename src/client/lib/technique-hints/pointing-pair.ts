import type { CellState, CandidateBoard, TechniqueHint } from '../types'

type UnitCell = readonly [number, number]

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

const candidateCellsInBox = (
    board: CellState[][],
    candidates: CandidateBoard,
    boxCells: UnitCell[],
    digit: number
): UnitCell[] =>
    boxCells.filter(([r, c]) => board[r]?.[c]?.value === 0 && candidates[r]?.[c]?.has(digit) === true)

const buildEliminations = (
    candidates: CandidateBoard,
    cells: UnitCell[],
    digit: number
): Array<{ row: number; col: number; digits: number[] }> =>
    cells
        .filter(([r, c]) => candidates[r]?.[c]?.has(digit) === true)
        .map(([r, c]) => ({ row: r, col: c, digits: [digit] }))

const checkRowAlignment = (
    candidates: CandidateBoard,
    aligned: UnitCell[],
    boxCol: number,
    digit: number,
    b: number
): TechniqueHint | null => {
    const row = aligned[0]![0]
    const outsideCells: UnitCell[] = Array.from({ length: 9 }, (_, c) => [row, c] as const).filter(
        (c) => c[1] < boxCol || c[1] >= boxCol + 3
    )
    const eliminations = buildEliminations(candidates, outsideCells, digit)
    if (eliminations.length === 0) return null

    return {
        technique: 'pointing-pair',
        difficulty: 'hard',
        title: 'Pointing Pair',
        description: `${digit} in box ${b + 1} is confined to row ${row + 1}. Remove it from other cells in that row.`,
        primaryCells: aligned,
        secondaryCells: [],
        action: 'elimination',
        digit,
        eliminations,
    }
}

const checkColAlignment = (
    candidates: CandidateBoard,
    aligned: UnitCell[],
    boxRow: number,
    digit: number,
    b: number
): TechniqueHint | null => {
    const col = aligned[0]![1]
    const outsideCells: UnitCell[] = Array.from({ length: 9 }, (_, r) => [r, col] as const).filter(
        (c) => c[0] < boxRow || c[0] >= boxRow + 3
    )
    const eliminations = buildEliminations(candidates, outsideCells, digit)
    if (eliminations.length === 0) return null

    return {
        technique: 'pointing-pair',
        difficulty: 'hard',
        title: 'Pointing Pair',
        description: `${digit} in box ${b + 1} is confined to col ${col + 1}. Remove it from other cells in that col.`,
        primaryCells: aligned,
        secondaryCells: [],
        action: 'elimination',
        digit,
        eliminations,
    }
}

const checkBox = (
    board: CellState[][],
    candidates: CandidateBoard,
    b: number
): TechniqueHint | null => {
    const boxRow = Math.floor(b / 3) * 3
    const boxCol = (b % 3) * 3
    const boxCells = getBoxCells(b)

    for (let digit = 1; digit <= 9; digit++) {
        const aligned = candidateCellsInBox(board, candidates, boxCells, digit)
        if (aligned.length < 2) continue

        const allSameRow = aligned.every(([r]) => r === aligned[0]![0])
        if (allSameRow) {
            const hint = checkRowAlignment(candidates, aligned, boxCol, digit, b)
            if (hint !== null) return hint
        }

        const allSameCol = aligned.every(([, c]) => c === aligned[0]![1])
        if (allSameCol) {
            const hint = checkColAlignment(candidates, aligned, boxRow, digit, b)
            if (hint !== null) return hint
        }
    }
    return null
}

export const detectPointingPair = (
    board: CellState[][],
    candidates: CandidateBoard
): TechniqueHint | null => {
    for (let b = 0; b < 9; b++) {
        const hint = checkBox(board, candidates, b)
        if (hint !== null) return hint
    }
    return null
}
