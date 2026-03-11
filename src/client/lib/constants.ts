import type { Difficulty } from './types'

export const DIFFICULTY_STORAGE_KEY = 'sudoku-difficulty' as const

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
