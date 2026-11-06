import {
    boxOf,
    cellName,
    colOf,
    findAdvancedStep,
    rowOf,
} from '../../../shared/advanced-techniques'
import type { AdvancedStep, AdvancedTechnique } from '../../../shared/advanced-techniques'
import type { CandidateBoard, CellState, TechniqueHint } from '../types'

const TITLES: Record<AdvancedTechnique, string> = {
    'x-wing': 'X-Wing',
    skyscraper: 'Skyscraper',
    'two-string-kite': '2-String Kite',
    'xy-wing': 'XY-Wing',
    'w-wing': 'W-Wing',
}

const toCell = (index: number): [number, number] => [rowOf(index), colOf(index)]

const toMasks = (board: CellState[][], candidates: CandidateBoard): number[] =>
    Array.from({ length: 81 }, (_, index) => {
        const [r, c] = toCell(index)
        if (board[r]?.[c]?.value !== 0) return 0
        let mask = 0
        for (const d of candidates[r]?.[c] ?? []) if (d >= 1 && d <= 9) mask |= 1 << (d - 1)
        return mask
    })

const houseName = (a: number, b: number): string => {
    if (rowOf(a) === rowOf(b)) return `row ${rowOf(a) + 1}`
    if (colOf(a) === colOf(b)) return `column ${colOf(a) + 1}`
    return `box ${boxOf(a) + 1}`
}

const describe = (step: AdvancedStep): string => {
    const d = step.digit
    const detail = step.detail
    switch (detail.kind) {
        case 'x-wing': {
            const [l1, l2] = detail.lines.map((n) => n + 1)
            const [x1, x2] = detail.crossLines.map((n) => n + 1)
            const [line, cross] = detail.orientation === 'row' ? ['rows', 'columns'] : ['columns', 'rows']
            return `In ${line} ${l1} and ${l2}, ${d} can only go in ${cross} ${x1} and ${x2}. Either way, those two ${line} take the ${d} in both ${cross}, so remove ${d} from the rest of ${cross} ${x1} and ${x2}.`
        }
        case 'skyscraper': {
            const [b1, b2] = detail.base
            const [e1, e2] = detail.ends
            const line = detail.orientation === 'row' ? 'rows' : 'columns'
            const l1 = (detail.orientation === 'row' ? rowOf(b1) : colOf(b1)) + 1
            const l2 = (detail.orientation === 'row' ? rowOf(b2) : colOf(b2)) + 1
            return `In ${line} ${l1} and ${l2}, ${d} has only two places each. ${cellName(b1)} and ${cellName(b2)} line up, so at most one of them is ${d}. That means ${cellName(e1)} or ${cellName(e2)} must be ${d}: remove ${d} from cells that see both.`
        }
        case 'two-string-kite': {
            const [rowEnd, rowBoxEnd] = detail.rowLink
            const [colBoxEnd, colEnd] = detail.colLink
            return `Row ${rowOf(rowEnd) + 1} has only two places for ${d} (${cellName(rowEnd)}, ${cellName(rowBoxEnd)}), and column ${colOf(colEnd) + 1} has only two (${cellName(colBoxEnd)}, ${cellName(colEnd)}). ${cellName(rowBoxEnd)} and ${cellName(colBoxEnd)} share box ${detail.box + 1}, so at most one is ${d}. That means ${cellName(rowEnd)} or ${cellName(colEnd)} must be ${d}: remove ${d} from cells that see both.`
        }
        case 'xy-wing': {
            const [w1, w2] = detail.pincers
            return `${cellName(detail.pivot)} is {${detail.x},${detail.y}}. It sees ${cellName(w1)} {${detail.x},${detail.z}} and ${cellName(w2)} {${detail.y},${detail.z}}. Whichever digit ${cellName(detail.pivot)} takes, one of those two cells must be ${detail.z}, so remove ${detail.z} from cells that see both.`
        }
        case 'w-wing': {
            const [a, b] = detail.cells
            const [u, v] = detail.link
            const x = detail.linkDigit
            return `${cellName(a)} and ${cellName(b)} are both {${Math.min(x, d)},${Math.max(x, d)}}. In ${houseName(u, v)}, ${x} can only go in ${cellName(u)} or ${cellName(v)}, which see them. They can't both be ${x}, so at least one of them is ${d}: remove ${d} from cells that see both.`
        }
    }
}

/** X-Wing, Skyscraper, 2-String Kite, XY-Wing and W-Wing, via the finder the server grades with. */
export const detectAdvancedTechnique = (
    board: CellState[][],
    candidates: CandidateBoard
): TechniqueHint | null => {
    const step = findAdvancedStep(toMasks(board, candidates))
    if (step === null) return null
    return {
        technique: step.technique,
        difficulty: 'hard',
        title: TITLES[step.technique],
        description: describe(step),
        primaryCells: step.pattern.map(toCell),
        secondaryCells: step.eliminations.map(toCell),
        action: 'elimination',
        digit: step.digit,
        eliminations: step.eliminations.map((index) => {
            const [row, col] = toCell(index)
            return { row, col, digits: [step.digit] }
        }),
    }
}
