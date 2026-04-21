import type { Difficulty } from './types'
import type { PlayMode, RecentCompletionEvent } from '../../shared/community'

type IncomingCompletion = Pick<RecentCompletionEvent, 'username' | 'adjustedTime' | 'difficulty'>

const MAX_RECENT_COMPLETIONS = 5

export const getDisplayDifficulty = (
    mode: PlayMode,
    practiceDifficulty: Difficulty,
    featuredDifficulty: Difficulty,
): Difficulty => mode === 'featured' ? featuredDifficulty : practiceDifficulty

export const getRankMovement = (
    previousRank: number | null,
    currentRank: number | null,
): number | null => {
    if (previousRank === null || currentRank === null) return null
    return previousRank - currentRank
}

export const mergeRecentCompletions = (
    current: RecentCompletionEvent[],
    incoming: IncomingCompletion,
    completedAtIso = new Date().toISOString(),
): RecentCompletionEvent[] => [
    {
        ...incoming,
        completedAtIso,
    },
    ...current,
].slice(0, MAX_RECENT_COMPLETIONS)
