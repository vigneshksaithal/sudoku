import { SvelteSet } from 'svelte/reactivity'
import { describe, expect, it } from 'vitest'
import { applyHintEliminations } from '../../app-logic'
import { updateConflicts } from '../../sudoku-utils'
import type { CellState, NotesBoard, TechniqueHint } from '../../types'
import { buildCandidateBoard } from '../candidate-board'
import { findTechniqueHint } from '../technique-engine'

// Puzzles produced by the server generator. The first needs locked candidates
// (an elimination hint) and the second currently needs a guess in the server solver.
const PUZZLES = {
    intermediate: {
        puzzle: '000906500300004090020000006804002000000040000000700103700000020060300007005609000',
        solution: '148936572376254891529817436834162759917543268652798143793481625461325987285679314',
    },
    expert: {
        puzzle: '007020050000800900050004007040000108380010062701000040500900080002007000090080600',
        solution: '917623854423875916658194327249756138385419762761238549576941283832567491194382675',
    },
}

const toBoard = (puzzle: string): CellState[][] =>
    Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => {
            const value = Number(puzzle[r * 9 + c])
            return { value, isGiven: value !== 0, hasConflict: false }
        }),
    )

const emptyNotes = (): NotesBoard =>
    Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new SvelteSet<number>()))

/** Mirrors App.svelte's hint apply for placement/elimination/clear actions. */
const applyHint = (board: CellState[][], notes: NotesBoard, hint: TechniqueHint): CellState[][] => {
    const [row, col] = hint.primaryCells[0]!
    if (hint.action === 'placement') {
        board[row]![col] = { ...board[row]![col]!, value: hint.digit }
        notes[row]![col]!.clear()
        for (let i = 0; i < 9; i++) {
            notes[row]![i]!.delete(hint.digit)
            notes[i]![col]!.delete(hint.digit)
        }
        const br = Math.floor(row / 3) * 3
        const bc = Math.floor(col / 3) * 3
        for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) notes[r]![c]!.delete(hint.digit)
    } else if (hint.action === 'clear') {
        board[row]![col] = { ...board[row]![col]!, value: 0 }
    } else {
        applyHintEliminations(board, notes, hint.eliminations ?? [])
    }
    return updateConflicts(board)
}

const hintKey = (hint: TechniqueHint): string =>
    JSON.stringify([hint.technique, hint.action, hint.digit, hint.primaryCells, hint.eliminations ?? []])

/** Tap Hint and Apply repeatedly without the player ever taking notes. */
const playWithHintsOnly = (puzzle: string, solutionStr: string) => {
    const solution = Array.from(solutionStr, Number)
    let board = toBoard(puzzle)
    const notes = emptyNotes()
    const used: string[] = []
    for (let step = 0; step < 400; step++) {
        const hint = findTechniqueHint(board, buildCandidateBoard(board, notes), solution)
        if (hint === null) break
        const key = hintKey(hint)
        expect(used.at(-1), `hint repeated at step ${step}: ${hint.title}`).not.toBe(key)
        used.push(key)
        board = applyHint(board, notes, hint)
        // Every applied hint must keep the board consistent with the solution
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const v = board[r]![c]!.value
                if (v !== 0) expect(v).toBe(solution[r * 9 + c])
                else if (notes[r]![c]!.size > 0) expect(notes[r]![c]!.has(solution[r * 9 + c]!)).toBe(true)
            }
        }
    }
    return { board, techniques: used.map((k) => JSON.parse(k)[0] as string) }
}

describe('hint-only play', () => {
    it('solves a locked-candidates puzzle without repeating an elimination hint', () => {
        const { board, techniques } = playWithHintsOnly(PUZZLES.intermediate.puzzle, PUZZLES.intermediate.solution)
        expect(board.flat().map((c) => c.value).join('')).toBe(PUZZLES.intermediate.solution)
        expect(techniques.some((t) => ['naked-pair', 'hidden-pair', 'pointing-pair', 'box-line-reduction'].includes(t))).toBe(true)
        expect(techniques).not.toContain('reveal')
    })

    it('always responds on a puzzle beyond the explained techniques, falling back to reveals', () => {
        const { board, techniques } = playWithHintsOnly(PUZZLES.expert.puzzle, PUZZLES.expert.solution)
        expect(board.flat().map((c) => c.value).join('')).toBe(PUZZLES.expert.solution)
        expect(techniques).toContain('reveal')
    })

    it('clears an incorrect entry before offering further hints', () => {
        const solution = Array.from(PUZZLES.intermediate.solution, Number)
        const board = toBoard(PUZZLES.intermediate.puzzle)
        const wrong = solution[0] === 9 ? 8 : 9
        board[0]![0] = { value: wrong, isGiven: false, hasConflict: false }
        const hint = findTechniqueHint(updateConflicts(board), buildCandidateBoard(board), solution)
        expect(hint).toMatchObject({ technique: 'incorrect-entry', action: 'clear', primaryCells: [[0, 0]] })
    })
})
