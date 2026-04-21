export type Difficulty = 'simple' | 'easy' | 'intermediate' | 'expert'

export type PlayMode = 'featured' | 'practice'

export type DailyGoalsState = {
    featuredRace: boolean
    hintFreeAny: boolean
    beatPersonalBest: boolean
}

export type FeaturedRaceMeta = {
    title: string
    difficulty: Difficulty
    puzzle: string
    solverCount: number
    createdAt: number
}

export type PlayerProfile = {
    username: string | null
    currentStreak: number
    longestStreak: number
    freezeCount: number
    totalFeaturedCompletions: number
    totalCompletions: number
    hintFreeCompletions: number
    bestTimes: Record<Difficulty, number | null>
    dailyGoals: DailyGoalsState
    badges: string[]
}

export type CompletionSubmission = {
    board: string
    difficulty: Difficulty
    elapsedSeconds: number
    hintsUsed: number
    validationFailures: number
    mode: PlayMode
    completedAtIso?: string
}

export type LeaderboardEntry = {
    userId: string
    username: string
    adjustedTime: number
    elapsedSeconds: number
    difficulty: Difficulty
    rank: number
}

export type RecentCompletionEvent = {
    username: string
    adjustedTime: number
    difficulty: Difficulty
    completedAtIso: string
}

export type CompletionResult = {
    adjustedTime: number
    currentStreak: number
    longestStreak: number
    freezeCount: number
    rank: number
    previousRank: number | null
    personalBest: number | null
    improvedPersonalBest: boolean
    dailyGoals: DailyGoalsState
    commentPreview: string
    leaderboardEntries?: LeaderboardEntry[]
    recentCompletions?: RecentCompletionEvent[]
    badges?: string[]
}

export const DEFAULT_DAILY_GOALS: DailyGoalsState = {
    featuredRace: false,
    hintFreeAny: false,
    beatPersonalBest: false,
}

export const createEmptyBestTimes = (): Record<Difficulty, number | null> => ({
    simple: null,
    easy: null,
    intermediate: null,
    expert: null,
})

export const formatElapsedTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

type ScoreCommentArgs = {
    difficulty: Difficulty
    mode: PlayMode
    elapsedSeconds: number
    adjustedTime: number
    hintsUsed: number
    validationFailures: number
    rank: number | null
    note?: string
}

export const formatScoreComment = ({
    difficulty,
    mode,
    elapsedSeconds,
    adjustedTime,
    hintsUsed,
    validationFailures,
    rank,
    note,
}: ScoreCommentArgs): string => {
    const lines = [
        note?.trim() ?? '',
        mode === 'featured'
            ? `I solved today's ${difficulty} Sudoku race in ${formatElapsedTime(elapsedSeconds)}.`
            : `I solved a ${difficulty} Sudoku practice board in ${formatElapsedTime(elapsedSeconds)}.`,
        `Adjusted time: ${formatElapsedTime(adjustedTime)} (${hintsUsed} hints, ${validationFailures} validation misses).`,
        rank === null ? '' : `Current race rank: #${rank}.`,
        '#Sudoku',
    ].filter((line) => line.length > 0)

    return lines.join('\n')
}
