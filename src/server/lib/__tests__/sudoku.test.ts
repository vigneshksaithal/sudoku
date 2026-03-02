import { describe, it, expect } from 'vitest'
import { boardToString, stringToBoard, shuffled, isValid, solve, countSolutions } from '../../lib/sudoku'

describe('boardToString', () => {
    it('converts an empty board (all zeros) to 81 zeros', () => {
        const emptyBoard: number[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => 0)
        )
        const result = boardToString(emptyBoard)
        expect(result).toBe('0'.repeat(81))
        expect(result).toHaveLength(81)
    })

    it('converts a full board to an 81-char string of digits', () => {
        const fullBoard: number[][] = [
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
        const result = boardToString(fullBoard)
        expect(result).toHaveLength(81)
        expect(result).toBe(
            '534678912672195348198342567859761423426853791713924856961537284287419635345286179'
        )
    })

    it('maps index i to row floor(i/9) and col i%9', () => {
        const board: number[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => 0)
        )
        // Place a known value at row 2, col 5 → index = 2*9 + 5 = 23
        board[2]![5] = 7
        const result = boardToString(board)
        expect(result[23]).toBe('7')

        // Place a known value at row 8, col 8 → index = 8*9 + 8 = 80
        board[8]![8] = 3
        const result2 = boardToString(board)
        expect(result2[80]).toBe('3')

        // Place a known value at row 0, col 0 → index = 0
        board[0]![0] = 1
        const result3 = boardToString(board)
        expect(result3[0]).toBe('1')
    })
})


describe('stringToBoard', () => {
    it('converts an 81-char string of zeros to a 9×9 grid of zeros', () => {
        const result = stringToBoard('0'.repeat(81))
        expect(result).toHaveLength(9)
        for (const row of result) {
            expect(row).toHaveLength(9)
            for (const cell of row) {
                expect(cell).toBe(0)
            }
        }
    })

    it('converts an 81-char string to a 9×9 grid with correct values', () => {
        const str =
            '534678912672195348198342567859761423426853791713924856961537284287419635345286179'
        const result = stringToBoard(str)
        expect(result).toHaveLength(9)
        expect(result[0]).toEqual([5, 3, 4, 6, 7, 8, 9, 1, 2])
        expect(result[4]).toEqual([4, 2, 6, 8, 5, 3, 7, 9, 1])
        expect(result[8]).toEqual([3, 4, 5, 2, 8, 6, 1, 7, 9])
    })

    it('round-trips with boardToString', () => {
        const original: number[][] = [
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
        const str = boardToString(original)
        const restored = stringToBoard(str)
        expect(restored).toEqual(original)
    })

    it('round-trips a board with zeros (partial puzzle)', () => {
        const partial: number[][] = [
            [5, 3, 0, 0, 7, 0, 0, 0, 0],
            [6, 0, 0, 1, 9, 5, 0, 0, 0],
            [0, 9, 8, 0, 0, 0, 0, 6, 0],
            [8, 0, 0, 0, 6, 0, 0, 0, 3],
            [4, 0, 0, 8, 0, 3, 0, 0, 1],
            [7, 0, 0, 0, 2, 0, 0, 0, 6],
            [0, 6, 0, 0, 0, 0, 2, 8, 0],
            [0, 0, 0, 4, 1, 9, 0, 0, 5],
            [0, 0, 0, 0, 8, 0, 0, 7, 9],
        ]
        const str = boardToString(partial)
        const restored = stringToBoard(str)
        expect(restored).toEqual(partial)
    })
})

describe('shuffled', () => {
    it('returns an array with the same elements', () => {
        const input = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        const result = shuffled(input)
        expect(result).toHaveLength(input.length)
        expect([...result].sort()).toEqual([...input].sort())
    })

    it('does not mutate the input array', () => {
        const input = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        const copy = [...input]
        shuffled(input)
        expect(input).toEqual(copy)
    })

    it('returns a new array instance', () => {
        const input = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        const result = shuffled(input)
        expect(result).not.toBe(input)
    })
})


// --- Known valid complete board for solver/validation tests ---
const VALID_BOARD: number[][] = [
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

/** Create a deep copy of a board */
const cloneBoard = (board: number[][]): number[][] =>
    board.map((row) => [...row])

describe('isValid', () => {
    it('returns true for a valid placement in an empty cell', () => {
        const board = cloneBoard(VALID_BOARD)
        // Remove cell at (0,0) which is 5, then check if placing 5 there is valid
        board[0]![0] = 0
        expect(isValid(board, 0, 0, 5)).toBe(true)
    })

    it('returns false for a row conflict', () => {
        const board = cloneBoard(VALID_BOARD)
        // Row 0 is [5,3,4,6,7,8,9,1,2]. Clear (0,0), try placing 3 (already in row at col 1)
        board[0]![0] = 0
        expect(isValid(board, 0, 0, 3)).toBe(false)
    })

    it('returns false for a column conflict', () => {
        const board = cloneBoard(VALID_BOARD)
        // Col 0 is [5,6,1,8,4,7,9,2,3]. Clear (0,0), try placing 6 (already in col at row 1)
        board[0]![0] = 0
        expect(isValid(board, 0, 0, 6)).toBe(false)
    })

    it('returns false for a box conflict', () => {
        const board = cloneBoard(VALID_BOARD)
        // Top-left 3×3 box: [5,3,4],[6,7,2],[1,9,8]. Clear (0,0), try placing 9 (at row 1 col 2... wait, 9 is at (1,0)? No.)
        // Actually box contains: 5,3,4,6,7,2,1,9,8. Clear (0,0), try placing 7 (already in box at (1,1))
        board[0]![0] = 0
        expect(isValid(board, 0, 0, 7)).toBe(false)
    })

    it('does not treat zero as a conflicting value', () => {
        // Board with multiple zeros — placing a digit should not conflict with zeros
        const board: number[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => 0)
        )
        expect(isValid(board, 0, 0, 5)).toBe(true)
    })

    it('returns true when num does not conflict in row, column, or box', () => {
        const board: number[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => 0)
        )
        // Place 1 at (0,0) and check if 2 is valid at (0,1) — no conflict
        board[0]![0] = 1
        expect(isValid(board, 0, 1, 2)).toBe(true)
    })
})

describe('solve', () => {
    it('solves a known solvable partial board and fills all cells', () => {
        // Classic "world's hardest sudoku" partial board
        const board: number[][] = [
            [5, 3, 0, 0, 7, 0, 0, 0, 0],
            [6, 0, 0, 1, 9, 5, 0, 0, 0],
            [0, 9, 8, 0, 0, 0, 0, 6, 0],
            [8, 0, 0, 0, 6, 0, 0, 0, 3],
            [4, 0, 0, 8, 0, 3, 0, 0, 1],
            [7, 0, 0, 0, 2, 0, 0, 0, 6],
            [0, 6, 0, 0, 0, 0, 2, 8, 0],
            [0, 0, 0, 4, 1, 9, 0, 0, 5],
            [0, 0, 0, 0, 8, 0, 0, 7, 9],
        ]
        const result = solve(board)
        expect(result).toBe(true)

        // Verify board is fully filled (no zeros)
        for (const row of board) {
            for (const cell of row) {
                expect(cell).toBeGreaterThanOrEqual(1)
                expect(cell).toBeLessThanOrEqual(9)
            }
        }
    })

    it('returns false for an unsolvable board', () => {
        // Nearly complete board with a contradiction — fast to determine unsolvable
        const board: number[][] = [
            [5, 3, 4, 6, 7, 8, 9, 1, 2],
            [6, 7, 2, 1, 9, 5, 3, 4, 8],
            [1, 9, 8, 3, 4, 2, 5, 6, 7],
            [8, 5, 9, 7, 6, 1, 4, 2, 3],
            [4, 2, 6, 8, 5, 3, 7, 9, 1],
            [7, 1, 3, 9, 2, 4, 8, 5, 6],
            [9, 6, 1, 5, 3, 7, 2, 8, 4],
            [2, 8, 7, 4, 1, 9, 6, 0, 0],
            [3, 4, 5, 2, 8, 6, 1, 0, 0],
        ]
        // Corrupt: place 9 at (7,7) — but 9 is already in col 7 at row 4
        board[7]![7] = 9
        expect(solve(board)).toBe(false)
    })

    it('produces a valid solution where rows, columns, and boxes are correct', () => {
        const board: number[][] = [
            [5, 3, 0, 0, 7, 0, 0, 0, 0],
            [6, 0, 0, 1, 9, 5, 0, 0, 0],
            [0, 9, 8, 0, 0, 0, 0, 6, 0],
            [8, 0, 0, 0, 6, 0, 0, 0, 3],
            [4, 0, 0, 8, 0, 3, 0, 0, 1],
            [7, 0, 0, 0, 2, 0, 0, 0, 6],
            [0, 6, 0, 0, 0, 0, 2, 8, 0],
            [0, 0, 0, 4, 1, 9, 0, 0, 5],
            [0, 0, 0, 0, 8, 0, 0, 7, 9],
        ]
        solve(board)

        // Check every row has digits 1-9
        for (const row of board) {
            expect([...row].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
        }

        // Check every column has digits 1-9
        for (let c = 0; c < 9; c++) {
            const col = board.map((row) => row[c]!)
            expect([...col].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
        }
    })
})

describe('countSolutions', () => {
    it('returns 1 for a board with exactly one solution', () => {
        const board = cloneBoard(VALID_BOARD)
        board[8]![8] = 0 // remove last cell (was 9) — only one valid digit
        expect(countSolutions(board)).toBe(1)
    })

    it('returns 2 (capped) for a board with multiple solutions', () => {
        // Deadly pattern: 4 cells forming a rectangle where values can be swapped
        // (5,4)/(5,5) = 4,9 and (6,4)/(6,5) = 9,4 — both arrangements valid
        const board: number[][] = [
            [9, 2, 6, 5, 7, 1, 4, 8, 3],
            [3, 5, 1, 4, 8, 6, 2, 7, 9],
            [8, 7, 4, 9, 2, 3, 5, 1, 6],
            [5, 8, 2, 3, 6, 7, 1, 9, 4],
            [1, 4, 9, 2, 5, 8, 3, 6, 7],
            [7, 6, 3, 1, 0, 0, 8, 2, 5],
            [2, 3, 8, 7, 0, 0, 6, 5, 1],
            [6, 1, 7, 8, 3, 5, 9, 4, 2],
            [4, 9, 5, 6, 1, 2, 7, 3, 8],
        ]
        expect(countSolutions(board)).toBe(2)
    })

    it('returns 0 for an unsolvable board', () => {
        // Nearly complete board with a contradiction in column 7
        const board: number[][] = [
            [5, 3, 4, 6, 7, 8, 9, 1, 2],
            [6, 7, 2, 1, 9, 5, 3, 4, 8],
            [1, 9, 8, 3, 4, 2, 5, 6, 7],
            [8, 5, 9, 7, 6, 1, 4, 2, 3],
            [4, 2, 6, 8, 5, 3, 7, 9, 1],
            [7, 1, 3, 9, 2, 4, 8, 5, 6],
            [9, 6, 1, 5, 3, 7, 2, 8, 4],
            [2, 8, 7, 4, 1, 9, 6, 5, 0], // (7,7)=5 conflicts with col 7 (5 at row 5)
            [3, 4, 5, 2, 8, 6, 1, 0, 0],
        ]
        expect(countSolutions(board)).toBe(0)
    })
})


// --- Task 1.5: Tests for generation and hole-punching ---

import { fillDiagonalBoxes, generateSolution, punchHoles } from '../../lib/sudoku'
import type { Board } from '../../lib/sudoku'

/** Extract a 3×3 box starting at (startRow, startCol) */
const extractBox = (board: Board, startRow: number, startCol: number): number[] => {
    const cells: number[] = []
    for (let r = startRow; r < startRow + 3; r++) {
        for (let c = startCol; c < startCol + 3; c++) {
            cells.push(board[r]![c]!)
        }
    }
    return cells
}

describe('fillDiagonalBoxes', () => {
    it('fills the three diagonal 3×3 boxes with digits 1–9', () => {
        const board: Board = Array.from({ length: 9 }, () => Array(9).fill(0) as number[])
        fillDiagonalBoxes(board)

        for (const offset of [0, 3, 6]) {
            const box = extractBox(board, offset, offset)
            expect([...box].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
        }
    })

    it('leaves non-diagonal cells as zero', () => {
        const board: Board = Array.from({ length: 9 }, () => Array(9).fill(0) as number[])
        fillDiagonalBoxes(board)

        // Check cells outside the three diagonal boxes remain 0
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const boxRow = Math.floor(r / 3) * 3
                const boxCol = Math.floor(c / 3) * 3
                const isDiagonal = boxRow === boxCol
                if (!isDiagonal) {
                    expect(board[r]![c]).toBe(0)
                }
            }
        }
    })
})

describe('generateSolution', () => {
    it('returns a complete valid 9×9 board', () => {
        const board = generateSolution()
        expect(board).toHaveLength(9)

        // Every row has digits 1–9
        for (const row of board) {
            expect(row).toHaveLength(9)
            expect([...row].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
        }

        // Every column has digits 1–9
        for (let c = 0; c < 9; c++) {
            const col = board.map((row) => row[c]!)
            expect([...col].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
        }

        // Every 3×3 box has digits 1–9
        for (let br = 0; br < 9; br += 3) {
            for (let bc = 0; bc < 9; bc += 3) {
                const box = extractBox(board, br, bc)
                expect([...box].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
            }
        }
    })

    it('produces different boards on successive calls', () => {
        const a = generateSolution()
        const b = generateSolution()
        // Extremely unlikely to be identical with random shuffling
        const aStr = a.map((r) => r.join('')).join('')
        const bStr = b.map((r) => r.join('')).join('')
        expect(aStr).not.toBe(bStr)
    })
})

describe('punchHoles', () => {
    it('returns a board with the correct number of zeros', () => {
        const solution = generateSolution()
        const puzzle = punchHoles(solution, 35)
        const zeros = puzzle.flat().filter((v) => v === 0).length
        // May be fewer than target if uniqueness constraint prevents removal
        expect(zeros).toBeGreaterThanOrEqual(17)
        expect(zeros).toBeLessThanOrEqual(35)
    })

    it('preserves non-zero cells from the original solution', () => {
        const solution = generateSolution()
        const puzzle = punchHoles(solution, 35)
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (puzzle[r]![c] !== 0) {
                    expect(puzzle[r]![c]).toBe(solution[r]![c])
                }
            }
        }
    })

    it('does not mutate the input solution', () => {
        const solution = generateSolution()
        const solutionCopy = solution.map((r) => [...r])
        punchHoles(solution, 35)
        expect(solution).toEqual(solutionCopy)
    })

    it('produces a puzzle with exactly one solution', () => {
        const solution = generateSolution()
        const puzzle = punchHoles(solution, 35)
        expect(countSolutions(puzzle)).toBe(1)
    })
})
