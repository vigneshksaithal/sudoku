import { describe, expect, it } from 'vitest'
import type { CandidateBoard, CellState } from '../../types'
import { detectAdvancedTechnique } from '../advanced'

const emptyBoard = (): CellState[][] =>
    Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => ({ value: 0, isGiven: false, hasConflict: false })))

const candidatesFrom = (entries: Array<[number, number, number[]]>): CandidateBoard => {
    const board = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set<number>()))
    for (const [r, c, digits] of entries) board[r]![c] = new Set(digits)
    return board
}

describe('detectAdvancedTechnique', () => {
    it('returns null when no advanced pattern exists', () => {
        expect(detectAdvancedTechnique(emptyBoard(), candidatesFrom([]))).toBeNull()
    })

    it('builds an X-Wing hint with the pattern highlighted and the targets as eliminations', () => {
        const candidates = candidatesFrom([
            [0, 2, [1]], [0, 6, [1]],
            [4, 2, [1]], [4, 6, [1]],
            [7, 2, [1, 5]],
        ])
        const hint = detectAdvancedTechnique(emptyBoard(), candidates)
        expect(hint).toMatchObject({
            technique: 'x-wing',
            difficulty: 'hard',
            title: 'X-Wing',
            action: 'elimination',
            digit: 1,
            secondaryCells: [[7, 2]],
            eliminations: [{ row: 7, col: 2, digits: [1] }],
        })
        expect(hint!.primaryCells).toHaveLength(4)
        expect(hint!.description).toContain('rows 1 and 5')
        expect(hint!.description).toContain('columns 3 and 7')
    })

    it('names the cells in an XY-Wing explanation', () => {
        const candidates = candidatesFrom([
            [0, 0, [1, 2]],
            [0, 5, [1, 3]],
            [5, 0, [2, 3]],
            [5, 5, [3, 4]],
        ])
        const hint = detectAdvancedTechnique(emptyBoard(), candidates)
        expect(hint!.technique).toBe('xy-wing')
        expect(hint!.description).toContain('R1C1 is {1,2}')
        expect(hint!.description).toContain('remove 3')
        expect(hint!.eliminations).toEqual([{ row: 5, col: 5, digits: [3] }])
    })

    it('ignores candidates of filled cells', () => {
        const board = emptyBoard()
        board[7]![2] = { value: 5, isGiven: true, hasConflict: false }
        const candidates = candidatesFrom([
            [0, 2, [1]], [0, 6, [1]],
            [4, 2, [1]], [4, 6, [1]],
            [7, 2, [1, 5]],
        ])
        expect(detectAdvancedTechnique(board, candidates)).toBeNull()
    })
})
