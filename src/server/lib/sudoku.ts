/** 9×9 grid where 0 represents an empty cell */
export type Board = number[][]

/** Flatten a 9×9 board to an 81-character string. Index i → row floor(i/9), col i%9. */
export const boardToString = (board: Board): string =>
    board.map((row) => row.join('')).join('')

/** Parse an 81-character string into a 9×9 board grid. */
export const stringToBoard = (str: string): Board =>
    Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => Number(str[r * 9 + c]))
    )

/** Return a new array with the same elements in a random order (Fisher-Yates). Does not mutate input. */
export const shuffled = (arr: number[]): number[] => {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
    }
    return copy
}

/** Check if placing num at (row, col) is valid — no conflicts in row, column, or 3×3 box. Zero cells are ignored. */
export const isValid = (board: Board, row: number, col: number, num: number): boolean => {
    // Check row
    for (let c = 0; c < 9; c++) {
        if (board[row]![c] === num) return false
    }

    // Check column
    for (let r = 0; r < 9; r++) {
        if (board[r]![col] === num) return false
    }

    // Check 3×3 box
    const boxRow = Math.floor(row / 3) * 3
    const boxCol = Math.floor(col / 3) * 3
    for (let r = boxRow; r < boxRow + 3; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) {
            if (board[r]![c] === num) return false
        }
    }

    return true
}

/** Backtracking solver — mutates board in place. Returns true if solved, false if unsolvable. */
export const solve = (board: Board): boolean => {
    // Collect empty cells upfront to avoid scanning the board on every recursive call
    const emptyCells: [number, number][] = []
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r]![c] === 0) emptyCells.push([r, c])
        }
    }

    const fill = (idx: number): boolean => {
        if (idx === emptyCells.length) return true
        const [r, c] = emptyCells[idx]!
        for (let num = 1; num <= 9; num++) {
            if (!isValid(board, r!, c!, num)) continue
            board[r!]![c!] = num
            if (fill(idx + 1)) return true
            board[r!]![c!] = 0
        }
        return false
    }

    return fill(0)
}

/** Counting solver — stops at limit (default 2). Deep-copies the board so it doesn't mutate the input. */
export const countSolutions = (board: Board, limit: number = 2): number => {
    const copy = board.map((row) => [...row])
    const emptyCells: [number, number][] = []
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (copy[r]![c] === 0) emptyCells.push([r, c])
        }
    }

    const state = { found: 0 }

    const search = (idx: number): void => {
        if (idx === emptyCells.length) {
            state.found++
            return
        }
        const [r, c] = emptyCells[idx]!
        for (let num = 1; num <= 9; num++) {
            if (state.found >= limit) return
            if (!isValid(copy, r!, c!, num)) continue
            copy[r!]![c!] = num
            search(idx + 1)
            copy[r!]![c!] = 0
        }
    }

    search(0)
    return state.found
}


const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

/** Create an empty 9×9 board filled with zeros. */
const emptyBoard = (): Board =>
    Array.from({ length: 9 }, () => Array(9).fill(0) as number[])

/** Fill the three diagonal 3×3 boxes with shuffled digits 1–9. Mutates board. */
export const fillDiagonalBoxes = (board: Board): void => {
    for (const offset of [0, 3, 6]) {
        const digits = shuffled([...DIGITS])
        let i = 0
        for (let r = offset; r < offset + 3; r++) {
            for (let c = offset; c < offset + 3; c++) {
                board[r]![c] = digits[i++]!
            }
        }
    }
}

/** Generate a complete valid 9×9 Sudoku solution. */
export const generateSolution = (): Board => {
    const board = emptyBoard()
    fillDiagonalBoxes(board)
    solve(board)
    return board
}

/** Remove cellsToRemove cells from a solution, preserving unique solvability. Does not mutate input. */
export const punchHoles = (solution: Board, cellsToRemove: number): Board => {
    const board = solution.map((row) => [...row])
    const positions = shuffled(Array.from({ length: 81 }, (_, i) => i))
    let removed = 0

    for (const pos of positions) {
        if (removed >= cellsToRemove) break
        const r = Math.floor(pos / 9)
        const c = pos % 9
        const saved = board[r]![c]!
        board[r]![c] = 0

        if (countSolutions(board) !== 1) {
            board[r]![c] = saved
        } else {
            removed++
        }
    }

    return board
}
