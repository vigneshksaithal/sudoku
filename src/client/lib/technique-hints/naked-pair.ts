import type { CellState, CandidateBoard, TechniqueHint } from '../types'
import { getRowCells, getColCells, getBoxCells } from './unit-cells'
import type { UnitCell } from './unit-cells'

const setsEqual = (a: ReadonlySet<number>, b: ReadonlySet<number>): boolean => {
    if (a.size !== b.size) return false
    const sortedA = [...a].sort((x, y) => x - y)
    const sortedB = [...b].sort((x, y) => x - y)
    return sortedA.every((v, i) => v === sortedB[i])
}

const checkUnit = (
    board: CellState[][],
    candidates: CandidateBoard,
    cells: UnitCell[]
): TechniqueHint | null => {
    const pairCells = cells.filter(([r, c]) => {
        const cell = board[r]?.[c]
        return cell !== undefined && cell.value === 0 && (candidates[r]?.[c]?.size === 2)
    })

    for (let i = 0; i < pairCells.length; i++) {
        for (let j = i + 1; j < pairCells.length; j++) {
            const [r1, c1] = pairCells[i]!
            const [r2, c2] = pairCells[j]!
            const set1 = candidates[r1]?.[c1]
            const set2 = candidates[r2]?.[c2]
            if (!set1 || !set2 || !setsEqual(set1, set2)) continue

            const [d1, d2] = [...set1].sort((a, b) => a - b) as [number, number]
            const primaryKey1 = `${r1},${c1}`
            const primaryKey2 = `${r2},${c2}`

            const affected = cells.filter(([r, c]) => {
                if (`${r},${c}` === primaryKey1 || `${r},${c}` === primaryKey2) return false
                const s = candidates[r]?.[c]
                return s !== undefined && (s.has(d1) || s.has(d2))
            })

            if (affected.length === 0) continue

            const eliminations = affected.map(([r, c]) => {
                const s = candidates[r]![c]!
                const digits = [d1, d2].filter((d) => s.has(d))
                return { row: r, col: c, digits }
            })

            return {
                technique: 'naked-pair',
                difficulty: 'medium',
                title: 'Naked Pair',
                description: `Cells R${r1 + 1}C${c1 + 1} and R${r2 + 1}C${c2 + 1} form a naked pair {${d1},${d2}}. Remove these digits from other cells in the unit.`,
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

export const detectNakedPair = (
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
