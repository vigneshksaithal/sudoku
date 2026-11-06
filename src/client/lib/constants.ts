import type { Difficulty } from './types'

export const DIFFICULTY_STORAGE_KEY = 'sudoku-difficulty' as const

/** Difficulties offered on daily posts, easiest first. */
export const VALID_DIFFICULTIES: readonly Difficulty[] = [
    'simple',
    'easy',
    'intermediate',
    'advanced',
] as const

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
    simple: 'Simple',
    easy: 'Easy',
    intermediate: 'Hard',
    advanced: 'Advanced',
    expert: 'Expert',
}

export const difficultyLabel = (difficulty: string): string =>
    Object.hasOwn(DIFFICULTY_LABELS, difficulty) ? DIFFICULTY_LABELS[difficulty as Difficulty] : difficulty

export const parseDifficulty = (raw: string | null): Difficulty => {
    if (raw === 'expert') return 'advanced'
    if (VALID_DIFFICULTIES.includes(raw as Difficulty)) {
        return raw as Difficulty
    }
    return 'simple'
}

/** Difficulty tabs for a daily post. Posts made before Advanced replaced Expert
 *  have an 'expert' puzzle in the last slot. */
export const difficultiesForPuzzles = (puzzles: Partial<Record<string, string>> | null): readonly Difficulty[] => {
    if (puzzles && puzzles['advanced'] === undefined && puzzles['expert'] !== undefined) {
        return ['simple', 'easy', 'intermediate', 'expert']
    }
    return VALID_DIFFICULTIES
}

/** Map a preferred difficulty onto those available, treating Advanced and Expert as the same slot. */
export const resolveDifficulty = (preferred: Difficulty, available: readonly Difficulty[]): Difficulty => {
    if (available.includes(preferred)) return preferred
    if (preferred === 'advanced' && available.includes('expert')) return 'expert'
    if (preferred === 'expert' && available.includes('advanced')) return 'advanced'
    return available[0] ?? 'simple'
}

export const getNextDifficulty = (
    difficulty: Difficulty,
    available: readonly Difficulty[] = VALID_DIFFICULTIES,
): Difficulty => {
    const index = available.indexOf(difficulty)
    const nextIndex = index === -1 || index === available.length - 1
        ? 0
        : index + 1

    return available[nextIndex] ?? 'simple'
}
