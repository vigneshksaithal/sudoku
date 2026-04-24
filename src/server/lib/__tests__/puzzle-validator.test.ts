import { describe, it, expect } from 'vitest'
import {
    validatePuzzleFormat,
    validatePuzzleConstraints,
    validatePuzzleUniqueness,
    classifyAndSolve,
    validatePuzzle,
} from '../puzzle-validator'
import { getDifficulty, createSolverState, solve, stringToBoard } from '../sudoku'

// ─── Known test puzzles ───────────────────────────────────────────────────────

// Valid puzzle with unique solution (28 clues, intermediate difficulty)
const VALID_PUZZLE = '003020600900305001001806400008102900700000008006708200002609500800203009005010300'

// Valid simple puzzle (many clues)
const SIMPLE_PUZZLE = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'

// Puzzle with no solution: passes constraint check but is unsolvable
// Row 0 has 1-8, col 8 has 1-8 (rows 1-8), and 9 is placed in box 2 at (1,6),
// making cell (0,8) impossible (needs 9 but 9 is blocked in its row, col, and box)
const UNSOLVABLE_PUZZLE = '123456780000000901000000002000000003000000004000000005000000006000000007000000008'

// Puzzle with multiple solutions: VALID_PUZZLE with cell 6 (digit 6) removed — 31 givens, 2 solutions
const MULTI_SOLUTION_PUZZLE = '003020000900305001001806400008102900700000008006708200002609500800203009005010300'

// ─── validatePuzzleFormat ─────────────────────────────────────────────────────

describe('validatePuzzleFormat', () => {
    it('accepts a valid 81-char digit string with ≥17 givens', () => {
        const result = validatePuzzleFormat(VALID_PUZZLE)
        expect(result.valid).toBe(true)
        if (result.valid) {
            expect(result.board).toHaveLength(81)
            expect(result.board.every((d) => d >= 0 && d <= 9)).toBe(true)
        }
    })

    it('rejects a string shorter than 81 characters', () => {
        const result = validatePuzzleFormat('12345')
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.error).toMatch(/81/)
        }
    })

    it('rejects a string longer than 81 characters', () => {
        const result = validatePuzzleFormat(VALID_PUZZLE + '0')
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.error).toMatch(/81/)
        }
    })

    it('rejects a string containing non-digit characters', () => {
        const withLetter = VALID_PUZZLE.slice(0, 80) + 'x'
        const result = validatePuzzleFormat(withLetter)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.error).toMatch(/digit/)
        }
    })

    it('rejects a string with spaces', () => {
        const withSpace = VALID_PUZZLE.slice(0, 80) + ' '
        const result = validatePuzzleFormat(withSpace)
        expect(result.valid).toBe(false)
    })

    it('rejects a puzzle with fewer than 17 non-zero digits', () => {
        // 16 givens — one fewer than minimum
        const fewGivens = '0'.repeat(65) + '123456789012345' + '0'
        expect(fewGivens.length).toBe(81)
        const result = validatePuzzleFormat(fewGivens)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.error).toMatch(/17/)
        }
    })

    it('accepts a puzzle with exactly 17 non-zero digits', () => {
        // Build a string with exactly 17 non-zero digits
        const exactly17 = '1'.repeat(17) + '0'.repeat(64)
        expect(exactly17.length).toBe(81)
        const result = validatePuzzleFormat(exactly17)
        // Format check passes (constraint/uniqueness may fail, but format is valid)
        expect(result.valid).toBe(true)
    })

    it('returns board as number array when valid', () => {
        const result = validatePuzzleFormat(VALID_PUZZLE)
        expect(result.valid).toBe(true)
        if (result.valid) {
            expect(result.board[0]).toBe(0)
            expect(result.board[2]).toBe(3)
        }
    })

    it('rejects empty string', () => {
        const result = validatePuzzleFormat('')
        expect(result.valid).toBe(false)
    })
})

// ─── validatePuzzleConstraints ────────────────────────────────────────────────

describe('validatePuzzleConstraints', () => {
    it('accepts a board with no constraint violations', () => {
        const board = stringToBoard(VALID_PUZZLE)
        const result = validatePuzzleConstraints(board)
        expect(result.valid).toBe(true)
    })

    it('rejects a board with duplicate digit in a row', () => {
        // Place two 1s in row 0
        const board = new Array(81).fill(0) as number[]
        board[0] = 1
        board[1] = 1
        const result = validatePuzzleConstraints(board)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.error).toMatch(/row/)
            expect(result.error).toMatch(/1/)
        }
    })

    it('rejects a board with duplicate digit in a column', () => {
        // Place two 5s in column 0 (cells 0 and 9)
        const board = new Array(81).fill(0) as number[]
        board[0] = 5
        board[9] = 5
        const result = validatePuzzleConstraints(board)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.error).toMatch(/column/)
            expect(result.error).toMatch(/5/)
        }
    })

    it('rejects a board with duplicate digit in a 3x3 box', () => {
        // Place two 3s in box 0 (cells 0 and 10 — row 0 col 0, row 1 col 1)
        const board = new Array(81).fill(0) as number[]
        board[0] = 3
        board[10] = 3
        const result = validatePuzzleConstraints(board)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.error).toMatch(/box/)
            expect(result.error).toMatch(/3/)
        }
    })

    it('accepts a board of all zeros (no givens)', () => {
        const board = new Array(81).fill(0) as number[]
        const result = validatePuzzleConstraints(board)
        expect(result.valid).toBe(true)
    })

    it('accepts a fully solved valid board', () => {
        const solved = '483921657967345821251876493548132976729564138136798245372689514814253769695417382'
        const board = stringToBoard(solved)
        const result = validatePuzzleConstraints(board)
        expect(result.valid).toBe(true)
    })
})

// ─── validatePuzzleUniqueness ─────────────────────────────────────────────────

describe('validatePuzzleUniqueness', () => {
    it('accepts a puzzle with exactly one solution', () => {
        const board = stringToBoard(VALID_PUZZLE)
        const result = validatePuzzleUniqueness(board)
        expect(result.valid).toBe(true)
    })

    it('rejects a puzzle with no solution', () => {
        // A board where the last cell is forced to be 1 but 1 already appears in its row/col/box
        // We construct this by using countSolutions directly on a known unsolvable board
        const board = stringToBoard(UNSOLVABLE_PUZZLE)
        const result = validatePuzzleUniqueness(board)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.error).toMatch(/no solution/)
        }
    })

    it('rejects a puzzle with multiple solutions', () => {
        const board = stringToBoard(MULTI_SOLUTION_PUZZLE)
        const result = validatePuzzleUniqueness(board)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.error).toMatch(/multiple solutions/)
        }
    })

    it('rejects an empty board (many solutions)', () => {
        const board = new Array(81).fill(0) as number[]
        const result = validatePuzzleUniqueness(board)
        expect(result.valid).toBe(false)
    })
})

// ─── classifyAndSolve ─────────────────────────────────────────────────────────

describe('classifyAndSolve', () => {
    it('returns a difficulty and a fully solved board', () => {
        const board = stringToBoard(VALID_PUZZLE)
        const result = classifyAndSolve(board)
        expect(result.solution).toHaveLength(81)
        expect(result.solution.every((d) => d >= 1 && d <= 9)).toBe(true)
        expect(['simple', 'easy', 'intermediate', 'expert']).toContain(result.difficulty)
    })

    it('difficulty matches getDifficulty output for the same puzzle', () => {
        const board = stringToBoard(VALID_PUZZLE)
        const result = classifyAndSolve(board)

        // Independently compute difficulty
        const state = createSolverState(board, true)
        solve(state)
        const expectedDifficulty = getDifficulty(state.solveLog)

        expect(result.difficulty).toBe(expectedDifficulty)
    })

    it('classifies simple puzzle correctly', () => {
        const board = stringToBoard(SIMPLE_PUZZLE)
        const result = classifyAndSolve(board)
        expect(result.difficulty).toBe('simple')
        expect(result.solution.every((d) => d >= 1 && d <= 9)).toBe(true)
    })

    it('solution preserves given digits from the original board', () => {
        const board = stringToBoard(VALID_PUZZLE)
        const result = classifyAndSolve(board)
        for (let i = 0; i < 81; i++) {
            if (board[i] !== 0) {
                expect(result.solution[i]).toBe(board[i])
            }
        }
    })
})

// ─── validatePuzzle (full pipeline) ──────────────────────────────────────────

describe('validatePuzzle', () => {
    it('returns valid result with difficulty, solution, and clueCount for a valid puzzle', () => {
        const result = validatePuzzle(VALID_PUZZLE)
        expect(result.valid).toBe(true)
        if (result.valid) {
            expect(['simple', 'easy', 'intermediate', 'expert']).toContain(result.difficulty)
            expect(result.solution).toHaveLength(81)
            expect(result.clueCount).toBeGreaterThanOrEqual(17)
        }
    })

    it('clueCount matches the number of non-zero digits in the input', () => {
        const result = validatePuzzle(VALID_PUZZLE)
        expect(result.valid).toBe(true)
        if (result.valid) {
            const expected = VALID_PUZZLE.split('').filter((c) => c !== '0').length
            expect(result.clueCount).toBe(expected)
        }
    })

    it('fails with format error for wrong-length input', () => {
        const result = validatePuzzle('12345')
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.error).toMatch(/81/)
        }
    })

    it('fails with format error for non-digit characters', () => {
        const result = validatePuzzle(VALID_PUZZLE.slice(0, 80) + 'x')
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.error).toMatch(/digit/)
        }
    })

    it('fails with constraint error for duplicate in row', () => {
        // Two 9s in row 0 of VALID_PUZZLE: replace position 0 with 9 (position 8 already has 0, position 2 has 3)
        // Build a puzzle with a row duplicate
        const withDuplicate = '993020600900305001001806400008102900700000008006708200002609500800203009005010300'
        const result = validatePuzzle(withDuplicate)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.error).toMatch(/row|column|box/)
        }
    })

    it('fails with uniqueness error for unsolvable puzzle', () => {
        const result = validatePuzzle(UNSOLVABLE_PUZZLE)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.error).toMatch(/no solution/)
        }
    })

    it('fails with uniqueness error for multi-solution puzzle', () => {
        const result = validatePuzzle(MULTI_SOLUTION_PUZZLE)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.error).toMatch(/solution/)
        }
    })

    it('pipeline short-circuits: format error prevents constraint check', () => {
        // Wrong length — should fail at format stage
        const result = validatePuzzle('000')
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.error).toMatch(/81/)
        }
    })
})
