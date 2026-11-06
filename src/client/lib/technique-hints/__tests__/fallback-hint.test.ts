import { describe, expect, it } from 'vitest'
import type { CandidateBoard, CellState } from '../../types'
import { buildRevealHint, detectIncorrectEntry } from '../fallback-hint'

const SOLUTION = Array.from(
    '148936572376254891529817436834162759917543268652798143793481625461325987285679314',
    Number,
)

const solvedBoard = (): CellState[][] =>
    Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => ({ value: SOLUTION[r * 9 + c]!, isGiven: false, hasConflict: false })),
    )

const candidatesWith = (entries: Array<[number, number, number[]]>): CandidateBoard => {
    const board = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set<number>()))
    for (const [r, c, digits] of entries) board[r]![c] = new Set(digits)
    return board
}

describe('detectIncorrectEntry', () => {
    it('returns null when every entry matches the solution', () => {
        expect(detectIncorrectEntry(solvedBoard(), SOLUTION)).toBeNull()
    })

    it('ignores empty cells', () => {
        const board = solvedBoard()
        board[0]![0] = { value: 0, isGiven: false, hasConflict: false }
        expect(detectIncorrectEntry(board, SOLUTION)).toBeNull()
    })

    it('ignores givens even if they disagree with the supplied solution', () => {
        const board = solvedBoard()
        board[0]![0] = { value: 9, isGiven: true, hasConflict: false }
        expect(detectIncorrectEntry(board, SOLUTION)).toBeNull()
    })

    it('reports the first incorrect player entry as a clear action', () => {
        const board = solvedBoard()
        board[2]![3] = { value: 1, isGiven: false, hasConflict: false }
        board[6]![6] = { value: 1, isGiven: false, hasConflict: false }
        const hint = detectIncorrectEntry(board, SOLUTION)
        expect(hint).toMatchObject({
            technique: 'incorrect-entry',
            difficulty: 'assist',
            action: 'clear',
            digit: 1,
            primaryCells: [[2, 3]],
        })
        expect(hint!.title).toBe('Check R3C4')
    })
})

describe('buildRevealHint', () => {
    it('returns null when no cell is empty', () => {
        expect(buildRevealHint(solvedBoard(), candidatesWith([]), SOLUTION)).toBeNull()
    })

    it('reveals the solution digit in the empty cell with the fewest candidates', () => {
        const board = solvedBoard()
        board[0]![0] = { value: 0, isGiven: false, hasConflict: false }
        board[5]![5] = { value: 0, isGiven: false, hasConflict: false }
        const candidates = candidatesWith([
            [0, 0, [1, 2, 3]],
            [5, 5, [3, 8]],
        ])
        const hint = buildRevealHint(board, candidates, SOLUTION)
        expect(hint).toMatchObject({
            technique: 'reveal',
            difficulty: 'assist',
            action: 'placement',
            digit: SOLUTION[5 * 9 + 5],
            primaryCells: [[5, 5]],
        })
    })

    it('breaks ties by board position', () => {
        const board = solvedBoard()
        board[7]![1] = { value: 0, isGiven: false, hasConflict: false }
        board[1]![7] = { value: 0, isGiven: false, hasConflict: false }
        const candidates = candidatesWith([
            [7, 1, [2, 6]],
            [1, 7, [3, 9]],
        ])
        expect(buildRevealHint(board, candidates, SOLUTION)!.primaryCells).toEqual([[1, 7]])
    })
})
