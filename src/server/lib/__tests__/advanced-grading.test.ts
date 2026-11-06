import { describe, expect, it } from 'vitest'
import { ADVANCED_FIXTURES, EXPERT_FIXTURES } from '../../../shared/test-fixtures/generated-puzzles'
import {
    classifyPuzzle,
    countSolutions,
    createSolverState,
    generatePuzzleWithDifficulty,
    getDifficulty,
    getSolveStats,
    solve,
    solveLogically,
    stringToBoard,
} from '../sudoku'

describe('Advanced grading', () => {
    it.each(ADVANCED_FIXTURES.map((f, i) => [i, f] as const))('fixture %i is Advanced and solves correctly by logic alone', (_, fixture) => {
        const puzzle = stringToBoard(fixture.puzzle)
        expect(classifyPuzzle(puzzle)).toBe('advanced')
        const state = createSolverState(puzzle, true)
        expect(solveLogically(state)).toBe(true)
        expect(state.solution.join('')).toBe(fixture.solution)
        const stats = getSolveStats(state.solveLog) as Record<string, number>
        for (const technique of fixture.techniques) expect(stats[technique]).toBeGreaterThan(0)
        expect(stats['guess']).toBe(0)
    })

    it.each(EXPERT_FIXTURES.map((f, i) => [i, f] as const))('fixture %i still needs a guess and is Expert', (_, fixture) => {
        const puzzle = stringToBoard(fixture.puzzle)
        expect(classifyPuzzle(puzzle)).toBe('expert')
        const state = createSolverState(puzzle, true)
        expect(solve(state)).toBe(true)
        expect(state.solution.join('')).toBe(fixture.solution)
    })

    it('classifyPuzzle matches a full solve with guessing', () => {
        for (const fixture of [...ADVANCED_FIXTURES, ...EXPERT_FIXTURES]) {
            const puzzle = stringToBoard(fixture.puzzle)
            const state = createSolverState(puzzle, true)
            solve(state)
            expect(classifyPuzzle(puzzle)).toBe(getDifficulty(state.solveLog))
        }
    })

    it('generates a unique Advanced puzzle', () => {
        const result = generatePuzzleWithDifficulty('advanced')
        expect(result).not.toBeNull()
        expect(countSolutions(result!.puzzle)).toBe(1)
        expect(classifyPuzzle(result!.puzzle)).toBe('advanced')
    }, 60000)
})
