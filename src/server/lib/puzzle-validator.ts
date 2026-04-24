import type { Difficulty } from './sudoku'
import { countSolutions, createSolverState, solve, getDifficulty } from './sudoku'

// ─── Result Types ─────────────────────────────────────────────────────────────

export type FormatValidationResult =
    | { valid: true; board: number[] }
    | { valid: false; error: string }

export type ConstraintValidationResult =
    | { valid: true }
    | { valid: false; error: string }

export type UniquenessValidationResult =
    | { valid: true }
    | { valid: false; error: string }

export type ClassificationResult = {
    difficulty: Difficulty
    solution: number[]
}

export type ValidationResult =
    | { valid: true; difficulty: Difficulty; solution: number[]; clueCount: number }
    | { valid: false; error: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const BOARD_LENGTH = 81
const MIN_GIVENS = 17
const PUZZLE_PATTERN = /^[0-9]{81}$/

// ─── Format Validation ────────────────────────────────────────────────────────

/** Validate puzzle string format: length, characters, minimum givens */
export const validatePuzzleFormat = (input: string): FormatValidationResult => {
    if (input.length !== BOARD_LENGTH) {
        return { valid: false, error: `Puzzle must be exactly ${BOARD_LENGTH} characters long (got ${input.length})` }
    }

    if (!PUZZLE_PATTERN.test(input)) {
        return { valid: false, error: 'Puzzle must contain only digits 0-9' }
    }

    const clueCount = countNonZeroDigits(input)
    if (clueCount < MIN_GIVENS) {
        return { valid: false, error: `Puzzle must have at least ${MIN_GIVENS} given digits (got ${clueCount})` }
    }

    const board = Array.from(input, (ch) => Number(ch))
    return { valid: true, board }
}

const countNonZeroDigits = (input: string): number => {
    let count = 0
    for (const ch of input) {
        if (ch !== '0') count++
    }
    return count
}

// ─── Constraint Validation ────────────────────────────────────────────────────

/** Check for constraint violations in rows, columns, and boxes */
export const validatePuzzleConstraints = (board: number[]): ConstraintValidationResult => {
    const rowResult = checkRows(board)
    if (!rowResult.valid) return rowResult

    const colResult = checkColumns(board)
    if (!colResult.valid) return colResult

    return checkBoxes(board)
}

const checkHouse = (digits: number[], houseLabel: string): ConstraintValidationResult => {
    const seen = new Set<number>()
    for (const digit of digits) {
        if (digit === 0) continue
        if (seen.has(digit)) {
            return { valid: false, error: `Duplicate digit ${digit} in ${houseLabel}` }
        }
        seen.add(digit)
    }
    return { valid: true }
}

const checkRows = (board: number[]): ConstraintValidationResult => {
    for (let row = 0; row < 9; row++) {
        const digits = board.slice(row * 9, row * 9 + 9)
        const result = checkHouse(digits, `row ${row + 1}`)
        if (!result.valid) return result
    }
    return { valid: true }
}

const checkColumns = (board: number[]): ConstraintValidationResult => {
    for (let col = 0; col < 9; col++) {
        const digits = Array.from({ length: 9 }, (_, row) => board[row * 9 + col] ?? 0)
        const result = checkHouse(digits, `column ${col + 1}`)
        if (!result.valid) return result
    }
    return { valid: true }
}

const checkBoxes = (board: number[]): ConstraintValidationResult => {
    for (let box = 0; box < 9; box++) {
        const boxRow = Math.floor(box / 3) * 3
        const boxCol = (box % 3) * 3
        const digits: number[] = []
        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                digits.push(board[r * 9 + c] ?? 0)
            }
        }
        const result = checkHouse(digits, `box ${box + 1}`)
        if (!result.valid) return result
    }
    return { valid: true }
}

// ─── Uniqueness Validation ────────────────────────────────────────────────────

/** Verify puzzle has exactly one solution using countSolutions */
export const validatePuzzleUniqueness = (board: number[]): UniquenessValidationResult => {
    const count = countSolutions(board, 2)
    if (count === 0) {
        return { valid: false, error: 'Puzzle has no solution' }
    }
    if (count > 1) {
        return { valid: false, error: 'Puzzle has multiple solutions' }
    }
    return { valid: true }
}

// ─── Classification ───────────────────────────────────────────────────────────

/** Solve with history recording and classify difficulty */
export const classifyAndSolve = (board: number[]): ClassificationResult => {
    const state = createSolverState(board, true)
    solve(state)
    const difficulty = getDifficulty(state.solveLog)
    return { difficulty, solution: state.solution }
}

// ─── Full Validation Pipeline ─────────────────────────────────────────────────

/** Full validation pipeline: format → constraints → uniqueness → classify */
export const validatePuzzle = (input: string): ValidationResult => {
    const formatResult = validatePuzzleFormat(input)
    if (!formatResult.valid) return { valid: false, error: formatResult.error }

    const constraintResult = validatePuzzleConstraints(formatResult.board)
    if (!constraintResult.valid) return { valid: false, error: constraintResult.error }

    const uniquenessResult = validatePuzzleUniqueness(formatResult.board)
    if (!uniquenessResult.valid) return { valid: false, error: uniquenessResult.error }

    const { difficulty, solution } = classifyAndSolve(formatResult.board)
    const clueCount = formatResult.board.filter((d) => d !== 0).length

    return { valid: true, difficulty, solution, clueCount }
}
