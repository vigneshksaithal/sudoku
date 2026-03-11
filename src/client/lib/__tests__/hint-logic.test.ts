import { describe, it, expect } from 'vitest'
import { isHintApplicable, getBestHintCell } from '../hint-logic'
import type { CellState } from '../types'

const makeBoard = (overrides: Partial<CellState>[][] = []): CellState[][] =>
    Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => ({
            value: 0,
            isGiven: false,
            hasConflict: false,
            ...overrides[r]?.[c],
        }))
    )

describe('isHintApplicable', () => {
    it('returns false for a given cell (isGiven: true)', () => {
        const overrides: Partial<CellState>[][] = []
        overrides[0] = []
        overrides[0]![0] = { isGiven: true, value: 0 }
        const board = makeBoard(overrides)
        expect(isHintApplicable(board, 0, 0, 5)).toBe(false)
    })

    it('returns false for a filled cell (value !== 0)', () => {
        const overrides: Partial<CellState>[][] = []
        overrides[3] = []
        overrides[3]![4] = { value: 7, isGiven: false }
        const board = makeBoard(overrides)
        expect(isHintApplicable(board, 3, 4, 7)).toBe(false)
    })

    it('returns true for an empty non-given cell with valid solution value 1–9', () => {
        const board = makeBoard()
        for (let v = 1; v <= 9; v++) {
            expect(isHintApplicable(board, 0, 0, v)).toBe(true)
        }
    })

    it('returns false for a cell that is both given and filled', () => {
        const overrides: Partial<CellState>[][] = []
        overrides[5] = []
        overrides[5]![5] = { isGiven: true, value: 3 }
        const board = makeBoard(overrides)
        expect(isHintApplicable(board, 5, 5, 3)).toBe(false)
    })
})

describe('getBestHintCell', () => {
    // Solution: solution[row * 9 + col] = (row * 9 + col) % 9 + 1
    const makeSolution = (): number[] =>
        Array.from({ length: 81 }, (_, i) => (i % 9) + 1)

    it('returns null when all cells are filled (no empty non-given cells)', () => {
        const overrides: Partial<CellState>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => ({ value: 5, isGiven: false }))
        )
        const board = makeBoard(overrides)
        expect(getBestHintCell(board, makeSolution())).toBeNull()
    })

    it('returns the only empty non-given cell when exactly one exists', () => {
        // Fill all cells except (4, 7)
        const overrides: Partial<CellState>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => ({ value: 5, isGiven: false }))
        )
        overrides[4]![7] = { value: 0, isGiven: false }
        const board = makeBoard(overrides)
        const solution = makeSolution()
        const result = getBestHintCell(board, solution)
        expect(result).not.toBeNull()
        expect(result!.row).toBe(4)
        expect(result!.col).toBe(7)
    })

    it('returned value matches solution[row * 9 + col]', () => {
        const overrides: Partial<CellState>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => ({ value: 5, isGiven: false }))
        )
        overrides[2]![3] = { value: 0, isGiven: false }
        const board = makeBoard(overrides)
        const solution = makeSolution()
        const result = getBestHintCell(board, solution)
        expect(result).not.toBeNull()
        expect(result!.value).toBe(solution[result!.row * 9 + result!.col])
    })

    it('returned cell satisfies value === 0 && isGiven === false', () => {
        const overrides: Partial<CellState>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => ({ value: 5, isGiven: false }))
        )
        overrides[1]![1] = { value: 0, isGiven: false }
        const board = makeBoard(overrides)
        const result = getBestHintCell(board, makeSolution())
        expect(result).not.toBeNull()
        expect(board[result!.row]![result!.col]!.value).toBe(0)
        expect(board[result!.row]![result!.col]!.isGiven).toBe(false)
    })

    it('returns the cell with fewest valid candidates when multiple empty cells exist', () => {
        // Build a board where row 0 has digits 1-8 placed in cols 1-8 (given),
        // leaving (0,0) with only 1 candidate (digit 9).
        // Row 1 is empty (9 candidates each).
        const overrides: Partial<CellState>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => ({ value: 0, isGiven: false }))
        )
        // Fill row 0 cols 1-8 with digits 1-8 as given cells
        for (let c = 1; c <= 8; c++) {
            overrides[0]![c] = { value: c, isGiven: true }
        }
        // (0,0) is empty — only digit 9 is valid (1-8 are taken by peers in row 0)
        // (1,0) is empty — many candidates available
        const board = makeBoard(overrides)
        const solution = Array(81).fill(9) as number[]
        const result = getBestHintCell(board, solution)
        expect(result).not.toBeNull()
        expect(result!.row).toBe(0)
        expect(result!.col).toBe(0)
    })

    it('tie-breaking: returns lowest cell index when two cells share minimum candidate count', () => {
        // Two empty cells at (0,0) and (0,1), both with the same number of candidates.
        // All other cells filled. Expect (0,0) to be returned (lower index).
        const overrides: Partial<CellState>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => ({ value: 5, isGiven: false }))
        )
        overrides[0]![0] = { value: 0, isGiven: false }
        overrides[0]![1] = { value: 0, isGiven: false }
        const board = makeBoard(overrides)
        const solution = makeSolution()
        const result = getBestHintCell(board, solution)
        expect(result).not.toBeNull()
        // (0,0) has index 0, (0,1) has index 1 — tie broken by lowest index
        expect(result!.row).toBe(0)
        expect(result!.col).toBe(0)
    })
})
