import type { DailyGoalsState, PlayMode } from '../../shared/community'

type StreakAdvanceInput = {
    currentStreak: number
    longestStreak: number
    freezeCount: number
    lastFeaturedDay: string | null
    completedDay: string
}

type StreakAdvanceResult = {
    currentStreak: number
    longestStreak: number
    freezeCount: number
    usedFreeze: boolean
}

type AdjustedTimeInput = {
    elapsedSeconds: number
    hintsUsed: number
    validationFailures: number
}

type DailyGoalsInput = {
    currentGoals: DailyGoalsState
    mode: PlayMode
    hintsUsed: number
    beatPersonalBest: boolean
}

const getDayNumber = (dayKey: string): number =>
    Math.floor(Date.parse(`${dayKey}T00:00:00.000Z`) / 86_400_000)

export const calculateAdjustedTime = ({
    elapsedSeconds,
    hintsUsed,
    validationFailures,
}: AdjustedTimeInput): number =>
    elapsedSeconds + (30 * hintsUsed) + (45 * validationFailures)

export const advanceFeaturedStreak = ({
    currentStreak,
    longestStreak,
    freezeCount,
    lastFeaturedDay,
    completedDay,
}: StreakAdvanceInput): StreakAdvanceResult => {
    if (lastFeaturedDay === null) {
        return {
            currentStreak: 1,
            longestStreak: Math.max(longestStreak, 1),
            freezeCount,
            usedFreeze: false,
        }
    }

    const gapDays = getDayNumber(completedDay) - getDayNumber(lastFeaturedDay)
    const usedFreeze = gapDays === 2 && freezeCount > 0

    const nextStreak = gapDays <= 1
        ? currentStreak + 1
        : usedFreeze
            ? currentStreak + 1
            : 1

    const milestoneAward = nextStreak > 0 && nextStreak % 7 === 0 ? 1 : 0
    const nextFreezeCount = usedFreeze
        ? Math.min(2, freezeCount - 1 + milestoneAward)
        : Math.min(2, freezeCount + milestoneAward)

    return {
        currentStreak: nextStreak,
        longestStreak: Math.max(longestStreak, nextStreak),
        freezeCount: nextFreezeCount,
        usedFreeze,
    }
}

export const updateDailyGoalsState = ({
    currentGoals,
    mode,
    hintsUsed,
    beatPersonalBest,
}: DailyGoalsInput): DailyGoalsState => ({
    featuredRace: currentGoals.featuredRace || mode === 'featured',
    hintFreeAny: currentGoals.hintFreeAny || hintsUsed === 0,
    beatPersonalBest: currentGoals.beatPersonalBest || beatPersonalBest,
})
