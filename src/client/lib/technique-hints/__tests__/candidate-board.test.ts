import { describe, expect, test } from 'vitest'

import { buildCandidateBoard } from '../candidate-board'
import type { CellState } from '../../types'

const makeCell = (value: number): CellState => ({ value, isGiven: value !== 0, hasConflict: false })

const makeBoard = (values: number[][]): CellState[][] =>
    values.map((row) => row.map(makeCell))

const emptyBoard = (): CellState[][] =>
    makeBoard(Array.from({ length: 9 }, () => Array(9).fill(0) as number[]))

const ALL_DIGITS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])

// --- empty board ---

describe('buildCandidateBoard — empty board', () => {
    test('every cell has all 9 candidates', () => {
        const board = emptyBoard()
        const result = buildCandidateBoard(board)

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                expect(result[r]![c]).toEqual(ALL_DIGITS)
            }
        }
    })
})

// --- filled board ---

describe('buildCandidateBoard — filled board', () => {
    test('every cell has an empty candidate set', () => {
        // Use a valid solved board
        const values = [
            [5, 3, 4, 6, 7, 8, 9, 1, 2],
            [6, 7, 2, 1, 9, 5, 3, 4, 8],
            [1, 9, 8, 3, 4, 2, 5, 6, 7],
            [8, 5, 9, 7, 6, 1, 4, 2, 3],
            [4, 2, 6, 8, 5, 3, 7, 9, 1],
            [7, 1, 3, 9, 2, 4, 8, 5, 6],
            [9, 6, 1, 5, 3, 7, 2, 8, 4],
            [2, 8, 7, 4, 1, 9, 6, 3, 5],
            [3, 4, 5, 2, 8, 6, 1, 7, 9],
        ]
        const board = makeBoard(values)
        const result = buildCandidateBoard(board)

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                expect(result[r]![c]!.size).toBe(0)
            }
        }
    })
})

// --- partial board: row elimination ---

describe('buildCandidateBoard — partial board', () => {
    test('empty cell in a row with digits 1-8 has only {9} as candidate', () => {
        // Row 0: digits 1-8 placed, col 8 is empty
        const row0 = [1, 2, 3, 4, 5, 6, 7, 8, 0]
        const values = [row0, ...Array.from({ length: 8 }, () => Array(9).fill(0) as number[])]
        const board = makeBoard(values)
        const result = buildCandidateBoard(board)

        expect(result[0]![8]).toEqual(new Set([9]))
    })
})

// --- peer elimination: row + col + box ---

describe('buildCandidateBoard — peer elimination', () => {
    test('candidates exclude values from row, column, AND box peers', () => {
        // Place digit 1 in row 0 col 1 (same row as target)
        // Place digit 2 in row 1 col 0 (same col as target)
        // Place digit 3 in row 1 col 1 (same box as target, row 0 col 0)
        // Target cell: row 0, col 0 — should not have 1, 2, or 3
        const values = Array.from({ length: 9 }, () => Array(9).fill(0) as number[])
        values[0]![1] = 1  // same row
        values[1]![0] = 2  // same col
        values[1]![1] = 3  // same box
        const board = makeBoard(values)
        const result = buildCandidateBoard(board)

        const candidates = result[0]![0]!
        expect(candidates.has(1)).toBe(false)
        expect(candidates.has(2)).toBe(false)
        expect(candidates.has(3)).toBe(false)
        // 4-9 should still be candidates
        for (const d of [4, 5, 6, 7, 8, 9]) {
            expect(candidates.has(d)).toBe(true)
        }
    })
})

// --- pure function ---

describe('buildCandidateBoard — pure function', () => {
    test('does not mutate the input board', () => {
        const board = emptyBoard()
        const snapshot = board.map((row) => row.map((cell) => ({ ...cell })))
        buildCandidateBoard(board)

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                expect(board[r]![c]).toEqual(snapshot[r]![c])
            }
        }
    })
})
