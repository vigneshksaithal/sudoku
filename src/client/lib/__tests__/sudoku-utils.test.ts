import { describe, expect, test } from 'vitest'

import { boardToString, hasConflict, isComplete, parseBoard, updateConflicts } from '../sudoku-utils'
import type { CellState } from '../types'

// --- parseBoard ---

describe('parseBoard', () => {
    test('converts 81-char string to 9x9 CellState grid', () => {
        const str = '1'.repeat(81)
        const board = parseBoard(str)

        expect(board).toHaveLength(9)
        expect(board[0]).toHaveLength(9)
        expect(board[0]![0]).toEqual({ value: 1, isGiven: true, hasConflict: false })
    })

    test('marks zero cells as not given', () => {
        const str = '0'.repeat(81)
        const board = parseBoard(str)

        expect(board[0]![0]).toEqual({ value: 0, isGiven: false, hasConflict: false })
    })

    test('correctly maps indices: row = floor(i/9), col = i%9', () => {
        const str = '123456789'.repeat(9)
        const board = parseBoard(str)

        expect(board[0]![0]!.value).toBe(1)
        expect(board[0]![8]!.value).toBe(9)
        expect(board[1]![0]!.value).toBe(1)
    })

    test('mixed zeros and non-zeros set isGiven correctly', () => {
        const str = '100000000' + '0'.repeat(72)
        const board = parseBoard(str)

        expect(board[0]![0]!.isGiven).toBe(true)
        expect(board[0]![1]!.isGiven).toBe(false)
    })
})

// --- boardToString ---

describe('boardToString', () => {
    test('converts CellState grid to 81-char string', () => {
        const board: CellState[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => ({ value: 5, isGiven: true, hasConflict: false }))
        )
        expect(boardToString(board)).toBe('5'.repeat(81))
    })

    test('round-trips with parseBoard', () => {
        const original = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'
        const board = parseBoard(original)
        expect(boardToString(board)).toBe(original)
    })
})


// --- hasConflict ---

describe('hasConflict', () => {
    test('returns true for row duplicate', () => {
        const str = '110000000' + '0'.repeat(72)
        const board = parseBoard(str)
        expect(hasConflict(board, 0, 0)).toBe(true)
        expect(hasConflict(board, 0, 1)).toBe(true)
    })

    test('returns true for column duplicate', () => {
        const str = '100000000' + '100000000' + '0'.repeat(63)
        const board = parseBoard(str)
        expect(hasConflict(board, 0, 0)).toBe(true)
        expect(hasConflict(board, 1, 0)).toBe(true)
    })

    test('returns true for box duplicate', () => {
        const str = '100000000' + '010000000' + '0'.repeat(63)
        const board = parseBoard(str)
        expect(hasConflict(board, 0, 0)).toBe(true)
        expect(hasConflict(board, 1, 1)).toBe(true)
    })

    test('returns false when no duplicate', () => {
        const str = '120000000' + '0'.repeat(72)
        const board = parseBoard(str)
        expect(hasConflict(board, 0, 0)).toBe(false)
        expect(hasConflict(board, 0, 1)).toBe(false)
    })

    test('ignores zero cells', () => {
        const str = '0'.repeat(81)
        const board = parseBoard(str)
        expect(hasConflict(board, 0, 0)).toBe(false)
    })
})

// --- updateConflicts ---

describe('updateConflicts', () => {
    test('sets hasConflict for all conflicting cells', () => {
        const str = '110000000' + '0'.repeat(72)
        const board = parseBoard(str)
        const updated = updateConflicts(board)

        expect(updated[0]![0]!.hasConflict).toBe(true)
        expect(updated[0]![1]!.hasConflict).toBe(true)
        expect(updated[0]![2]!.hasConflict).toBe(false)
    })

    test('clears conflicts when none exist', () => {
        const str = '123456789' + '0'.repeat(72)
        const board = parseBoard(str)
        board[0]![0] = { ...board[0]![0]!, hasConflict: true }
        const updated = updateConflicts(board)

        expect(updated[0]![0]!.hasConflict).toBe(false)
    })

    test('does not mutate input board', () => {
        const str = '110000000' + '0'.repeat(72)
        const board = parseBoard(str)
        const original00 = board[0]![0]!.hasConflict
        updateConflicts(board)
        expect(board[0]![0]!.hasConflict).toBe(original00)
    })
})

// --- isComplete ---

describe('isComplete', () => {
    test('returns true when all cells filled and no conflicts', () => {
        const str = '534678912672195348198342567859761423426853791713924856961537284287419635345286179'
        const board = updateConflicts(parseBoard(str))
        expect(isComplete(board)).toBe(true)
    })

    test('returns false when board has zeros', () => {
        const str = '034678912672195348198342567859761423426853791713924856961537284287419635345286179'
        const board = updateConflicts(parseBoard(str))
        expect(isComplete(board)).toBe(false)
    })

    test('returns false when board has conflicts', () => {
        const str = '554678912672195348198342567859761423426853791713924856961537284287419635345286179'
        const board = updateConflicts(parseBoard(str))
        expect(isComplete(board)).toBe(false)
    })
})
