import { SvelteSet } from 'svelte/reactivity'
import { describe, expect, it } from 'vitest'
import { applyHintEliminations, restoreCellCandidates } from '../../app-logic'
import { updateConflicts } from '../../sudoku-utils'
import type { CellState, NotesBoard, TechniqueHint } from '../../types'
import { buildCandidateBoard } from '../candidate-board'
import { findTechniqueHint } from '../technique-engine'
import { ADVANCED_FIXTURES, EXPERT_FIXTURES } from '../../../../shared/test-fixtures/generated-puzzles'

// Locked-candidates puzzle from the server generator (Hard level)
const HARD = {
    puzzle: '000906500300004090020000006804002000000040000000700103700000020060300007005609000',
    solution: '148936572376254891529817436834162759917543268652798143793481625461325987285679314',
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
    } else if (hint.action === 'restore-notes') {
        restoreCellCandidates(board, notes, row, col)
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

const ADVANCED_HINTS = ['x-wing', 'skyscraper', 'two-string-kite', 'xy-wing', 'w-wing']
const SERVER_TO_CLIENT: Record<string, string> = {
    xWing: 'x-wing', skyscraper: 'skyscraper', twoStringKite: 'two-string-kite', xyWing: 'xy-wing', wWing: 'w-wing',
}

describe('hint-only play', () => {
    it('solves a locked-candidates puzzle without repeating an elimination hint', () => {
        const { board, techniques } = playWithHintsOnly(HARD.puzzle, HARD.solution)
        expect(board.flat().map((c) => c.value).join('')).toBe(HARD.solution)
        expect(techniques.some((t) => ['naked-pair', 'hidden-pair', 'pointing-pair', 'box-line-reduction'].includes(t))).toBe(true)
        expect(techniques).not.toContain('reveal')
    })

    it.each(ADVANCED_FIXTURES.map((f, i) => [i, f] as const))(
        'explains every step of Advanced fixture %i without a reveal',
        (_, fixture) => {
            const { board, techniques } = playWithHintsOnly(fixture.puzzle, fixture.solution)
            expect(board.flat().map((c) => c.value).join('')).toBe(fixture.solution)
            expect(techniques).not.toContain('reveal')
            expect(techniques.some((t) => ADVANCED_HINTS.includes(t))).toBe(true)
            // The client explains at least one of the techniques the server graded with
            const graded = fixture.techniques.map((t) => SERVER_TO_CLIENT[t])
            expect(techniques.some((t) => graded.includes(t))).toBe(true)
        },
    )

    it.each(EXPERT_FIXTURES.map((f, i) => [i, f] as const))(
        'always responds on Expert fixture %i, falling back to reveals',
        (_, fixture) => {
            const { board, techniques } = playWithHintsOnly(fixture.puzzle, fixture.solution)
            expect(board.flat().map((c) => c.value).join('')).toBe(fixture.solution)
            expect(techniques).toContain('reveal')
        },
    )

    it('clears an incorrect entry before offering further hints', () => {
        const solution = Array.from(HARD.solution, Number)
        const board = toBoard(HARD.puzzle)
        const wrong = solution[0] === 9 ? 8 : 9
        board[0]![0] = { value: wrong, isGiven: false, hasConflict: false }
        const hint = findTechniqueHint(updateConflicts(board), buildCandidateBoard(board), solution)
        expect(hint).toMatchObject({ technique: 'incorrect-entry', action: 'clear', primaryCells: [[0, 0]] })
    })

    it('restores notes that have lost the correct digit before giving technique hints', () => {
        const solution = Array.from(HARD.solution, Number)
        const board = toBoard(HARD.puzzle)
        const notes = emptyNotes()
        const target = board.flat().findIndex((c) => c.value === 0)
        const [r, c] = [Math.floor(target / 9), target % 9]
        const candidates = buildCandidateBoard(board)[r]![c]!
        for (const d of candidates) if (d !== solution[target]) notes[r]![c]!.add(d)
        const hint = findTechniqueHint(board, buildCandidateBoard(board, notes), solution)
        expect(hint).toMatchObject({ technique: 'incorrect-note', action: 'restore-notes', primaryCells: [[r, c]] })
    })
})
