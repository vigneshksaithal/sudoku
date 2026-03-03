import * as fc from 'fast-check'
import { describe, it } from 'vitest'
import {
    boardToString,
    countSolutions,
    generateSolution,
    punchHoles,
} from '../sudoku'

const CELLS_TO_REMOVE = { easy: 35, medium: 45, hard: 54 } as const
const EXPECTED_GIVENS = { easy: 46, medium: 36, hard: 27 } as const

const extractBox = (board: number[][], startRow: number, startCol: number): number[] => {
    const cells: number[] = []
    for (let r = startRow; r < startRow + 3; r++) {
        for (let c = startCol; c < startCol + 3; c++) {
            cells.push(board[r]![c]!)
        }
    }
    return cells
}

const isValidGroup = (cells: number[]): boolean => {
    const sorted = [...cells].sort((a, b) => a - b)
    return sorted.every((v, i) => v === i + 1)
}

const isSolutionValid = (board: number[][]): boolean => {
    // Check all rows
    for (let r = 0; r < 9; r++) {
        if (!isValidGroup(board[r]!)) return false
    }
    // Check all columns
    for (let c = 0; c < 9; c++) {
        const col = board.map((row) => row[c]!)
        if (!isValidGroup(col)) return false
    }
    // Check all 3×3 boxes
    for (const br of [0, 3, 6]) {
        for (const bc of [0, 3, 6]) {
            if (!isValidGroup(extractBox(board, br, bc))) return false
        }
    }
    return true
}

describe('Property 1: Generated solutions are valid Sudoku boards', () => {
    // Feature: sudoku-game, Property 1: Generated solutions are valid Sudoku boards
    it('every row, column, and 3×3 box contains digits 1–9 exactly once', () => {
        fc.assert(
            fc.property(fc.constant(null), () => {
                const solution = generateSolution()
                return isSolutionValid(solution)
            }),
            { numRuns: 100 }
        )
    })
})

describe('Property 2: Three solutions per post are distinct', () => {
    // Feature: sudoku-game, Property 2: Three solutions per post are distinct
    it('no two of three generated solutions are identical', () => {
        fc.assert(
            fc.property(fc.constant(null), () => {
                const s1 = boardToString(generateSolution())
                const s2 = boardToString(generateSolution())
                const s3 = boardToString(generateSolution())
                return s1 !== s2 && s1 !== s3 && s2 !== s3
            }),
            { numRuns: 100 }
        )
    })
})

describe('Property 3: Puzzle given counts match difficulty specification', () => {
    // Feature: sudoku-game, Property 3: Puzzle given counts match difficulty specification
    it('easy puzzles have givens ≤ 46 and ≥ 17', () => {
        fc.assert(
            fc.property(fc.constant(null), () => {
                const solution = generateSolution()
                const puzzle = punchHoles(solution, CELLS_TO_REMOVE.easy)
                const givens = puzzle.flat().filter((v) => v !== 0).length
                return givens <= EXPECTED_GIVENS.easy && givens >= 17
            }),
            { numRuns: 100 }
        )
    })

    it('medium puzzles have givens ≤ 36 and ≥ 17', () => {
        fc.assert(
            fc.property(fc.constant(null), () => {
                const solution = generateSolution()
                const puzzle = punchHoles(solution, CELLS_TO_REMOVE.medium)
                const givens = puzzle.flat().filter((v) => v !== 0).length
                return givens <= EXPECTED_GIVENS.medium && givens >= 17
            }),
            { numRuns: 100 }
        )
    })

    it('hard puzzles have givens ≤ 27 and ≥ 17', () => {
        fc.assert(
            fc.property(fc.constant(null), () => {
                const solution = generateSolution()
                const puzzle = punchHoles(solution, CELLS_TO_REMOVE.hard)
                const givens = puzzle.flat().filter((v) => v !== 0).length
                return givens <= EXPECTED_GIVENS.hard && givens >= 17
            }),
            { numRuns: 100 }
        )
    })
})

describe('Property 4: Generated puzzles have exactly one solution', () => {
    // Feature: sudoku-game, Property 4: Generated puzzles have exactly one solution
    it('countSolutions returns 1 for any generated puzzle', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('easy' as const, 'medium' as const, 'hard' as const),
                (difficulty) => {
                    const solution = generateSolution()
                    const puzzle = punchHoles(solution, CELLS_TO_REMOVE[difficulty])
                    return countSolutions(puzzle) === 1
                }
            ),
            { numRuns: 100 }
        )
    })
})
