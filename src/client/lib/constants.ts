import type { Difficulty } from './types'

export const DIFFICULTY_STORAGE_KEY = 'sudoku-difficulty' as const
export const PAD_ALIGNMENT_STORAGE_KEY = 'sudoku-pad-alignment' as const

export const VALID_DIFFICULTIES: readonly Difficulty[] = [
    'simple',
    'easy',
    'intermediate',
    'expert',
] as const

export const parseDifficulty = (raw: string | null): Difficulty => {
    if (VALID_DIFFICULTIES.includes(raw as Difficulty)) {
        return raw as Difficulty
    }
    return 'simple'
}

export const getNextDifficulty = (difficulty: Difficulty): Difficulty => {
    const index = VALID_DIFFICULTIES.indexOf(difficulty)
    const nextIndex = index === -1 || index === VALID_DIFFICULTIES.length - 1
        ? 0
        : index + 1

    return VALID_DIFFICULTIES[nextIndex] ?? 'simple'
}
