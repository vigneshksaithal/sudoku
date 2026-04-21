import { redis, reddit, realtime, settings } from '@devvit/web/server'

import type {
    CompletionResult,
    CompletionSubmission,
    DailyGoalsState,
    FeaturedRaceMeta,
    LeaderboardEntry,
    PlayerProfile,
    RecentCompletionEvent,
} from '../../shared/community'
import {
    createEmptyBestTimes,
    DEFAULT_DAILY_GOALS,
    formatScoreComment,
} from '../../shared/community'
import { DIFFICULTIES } from './sudoku'
import type { Difficulty } from '../../shared/community'
import { advanceFeaturedStreak, calculateAdjustedTime, updateDailyGoalsState } from './community-engagement'

type RaceRecord = {
    title: string
    createdAt: number
    featuredDifficulty: Difficulty
    featuredPuzzle: string
    featuredSolution: string
    scoreThreadId: string | null
    solverCount: number
    puzzles: Record<Difficulty, string>
    solutions: Record<Difficulty, string>
}

type BootstrapState = {
    postId: string
    subredditName: string
    channel: string
    featuredRace: FeaturedRaceMeta
    practicePuzzles: Record<Difficulty, string>
    practiceSolutions: Record<Difficulty, string>
    playerProfile: PlayerProfile
    leaderboard: {
        entries: LeaderboardEntry[]
        currentUserRank: number | null
    }
    recentCompletions: RecentCompletionEvent[]
}

type PreviewState = {
    channel: string
    featuredRace: FeaturedRaceMeta
    topPlayers: LeaderboardEntry[]
    recentCompletions: RecentCompletionEvent[]
    playerProfile: Pick<PlayerProfile, 'currentStreak' | 'freezeCount'>
}

type CompletionOutcome = {
    valid: boolean
    completion?: CompletionResult
}

type RecordCompletionArgs = {
    postId: string
    subredditName: string
    userId: string
    username: string
    submission: CompletionSubmission
}

type CommentScoreArgs = {
    postId: string
    difficulty: Difficulty
    mode: 'featured' | 'practice'
    elapsedSeconds: number
    adjustedTime: number
    hintsUsed: number
    validationFailures: number
    rank: number | null
    note?: string
}

type WeeklyStandingsEntry = {
    userId: string
    username: string
    currentStreak: number
    weeklyBestImprovement: number
    leagueScore: number
}

type RoundupResult = {
    created: boolean
}

const SCORE_THREAD_TEXT = [
    'Drop your Sudoku race results here.',
    'Use the in-game Comment My Score action to post your time as yourself.',
].join('\n')

const DEFAULT_FEATURED_DIFFICULTY: Difficulty = 'intermediate'
const MAX_FEED_EVENTS = 8
const WEEKLY_SCORE_MULTIPLIER = 1_000_000

export const getRaceKey = (postId: string): string => `post:${postId}:race`
export const getScoreThreadKey = (postId: string): string => `post:${postId}:score-thread`
export const getDailyLeaderboardKey = (postId: string): string => `leaderboard:${postId}:daily`
export const getWeeklyLeaderboardKey = (subredditName: string): string => `leaderboard:${subredditName}:weekly`
export const getWeeklyImprovementKey = (subredditName: string): string => `leaderboard:${subredditName}:improvement`
export const getProfileKey = (userId: string): string => `user:${userId}:sudoku:profile`
export const getHistoryKey = (userId: string, dayKey: string): string => `user:${userId}:sudoku:history:${dayKey}`
export const getCompletionKey = (postId: string, userId: string): string => `post:${postId}:completion:${userId}`
export const getMetricsKey = (postId: string, dayKey: string): string => `metrics:${postId}:${dayKey}`
export const getRecentCompletionsKey = (postId: string, dayKey: string): string => `${getMetricsKey(postId, dayKey)}:recent`
export const getSchedulerMarkerKey = (subredditName: string, kind: 'daily-post' | 'weekly-roundup', scope: string): string =>
    `stats:sudoku:${subredditName}:${kind}:${scope}`

export const getRaceChannel = (postId: string): string =>
    `sudoku_${postId.replace(/[^A-Za-z0-9]/g, '_')}`

export const getDayKey = (date: Date): string => date.toISOString().slice(0, 10)

export const getWeekKey = (date: Date): string => {
    const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
    const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000)
    const week = Math.floor(dayOfYear / 7) + 1
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

const createDefaultProfile = (): PlayerProfile => ({
    username: null,
    currentStreak: 0,
    longestStreak: 0,
    freezeCount: 0,
    totalFeaturedCompletions: 0,
    totalCompletions: 0,
    hintFreeCompletions: 0,
    bestTimes: createEmptyBestTimes(),
    dailyGoals: { ...DEFAULT_DAILY_GOALS },
    badges: [],
})

const parseNumber = (raw: string | undefined, fallback: number): number => {
    if (raw === undefined) return fallback
    const parsed = Number.parseInt(raw, 10)
    return Number.isNaN(parsed) ? fallback : parsed
}

const parseMaybeNumber = (raw: string | undefined): number | null => {
    if (raw === undefined) return null
    const parsed = Number.parseInt(raw, 10)
    return Number.isNaN(parsed) ? null : parsed
}

const getStoredBestTimes = (raw: Record<string, string>): Record<Difficulty, number | null> => ({
    simple: parseMaybeNumber(raw['bestTime:simple']),
    easy: parseMaybeNumber(raw['bestTime:easy']),
    intermediate: parseMaybeNumber(raw['bestTime:intermediate']),
    expert: parseMaybeNumber(raw['bestTime:expert']),
})

const buildBadges = (profile: Omit<PlayerProfile, 'badges'>): string[] => {
    const badges: string[] = []
    if (profile.currentStreak >= 3) badges.push('On Fire')
    if (profile.hintFreeCompletions >= 3) badges.push('Clean Solver')
    if (profile.totalFeaturedCompletions >= 7) badges.push('Daily Regular')
    return badges
}

const parseDailyGoals = (raw: Record<string, string>): DailyGoalsState => ({
    featuredRace: raw['featuredRace'] === '1',
    hintFreeAny: raw['hintFreeAny'] === '1',
    beatPersonalBest: raw['beatPersonalBest'] === '1',
})

const getDifficultyFields = (raw: Record<string, string>, suffix: 'puzzle' | 'solution'): Record<Difficulty, string> => ({
    simple: raw[`simple:${suffix}`] ?? '',
    easy: raw[`easy:${suffix}`] ?? '',
    intermediate: raw[`intermediate:${suffix}`] ?? '',
    expert: raw[`expert:${suffix}`] ?? '',
})

const parseRaceRecord = (raw: Record<string, string>): RaceRecord => ({
    title: raw['title'] ?? 'Sudoku Daily Race',
    createdAt: parseNumber(raw['createdAt'], Date.now()),
    featuredDifficulty: parseDifficulty(raw['featured:difficulty']),
    featuredPuzzle: raw['featured:puzzle'] ?? '',
    featuredSolution: raw['featured:solution'] ?? '',
    scoreThreadId: raw['scoreThreadId'] ?? null,
    solverCount: parseNumber(raw['solverCount'], 0),
    puzzles: getDifficultyFields(raw, 'puzzle'),
    solutions: getDifficultyFields(raw, 'solution'),
})

const parseDifficulty = (raw: string | undefined): Difficulty =>
    DIFFICULTIES.includes(raw as Difficulty) ? raw as Difficulty : DEFAULT_FEATURED_DIFFICULTY

const getNow = (iso?: string): Date => iso ? new Date(iso) : new Date()

const isTruthy = (value: unknown): boolean => value === true || value === 'true' || value === 1 || value === '1'

const getSettingsValue = async (key: string): Promise<unknown> => settings.get(key)

export const getConfiguredFeaturedDifficulty = async (): Promise<Difficulty> =>
    parseDifficulty(await getSettingsValue('featuredDifficulty') as string | undefined)

export const getConfiguredDailyHourUtc = async (): Promise<number> => {
    const value = await getSettingsValue('dailyPostHourUtc')
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10)
        return Number.isNaN(parsed) ? 8 : parsed
    }
    return 8
}

export const getConfiguredWeeklyRoundupDay = async (): Promise<string> => {
    const value = await getSettingsValue('weeklyRoundupDay')
    return typeof value === 'string' ? value : 'mon'
}

export const getConfiguredWinnerFlairEnabled = async (): Promise<boolean> =>
    isTruthy(await getSettingsValue('winnerFlairEnabled'))

export const getProfile = async (userId: string | undefined, dayKey: string): Promise<PlayerProfile> => {
    if (!userId) return createDefaultProfile()

    const [profileRaw, goalsRaw] = await Promise.all([
        redis.hGetAll(getProfileKey(userId)),
        redis.hGetAll(getHistoryKey(userId, dayKey)),
    ])

    const baseProfile = {
        username: profileRaw['username'] ?? null,
        currentStreak: parseNumber(profileRaw['currentStreak'], 0),
        longestStreak: parseNumber(profileRaw['longestStreak'], 0),
        freezeCount: parseNumber(profileRaw['freezeCount'], 0),
        totalFeaturedCompletions: parseNumber(profileRaw['totalFeaturedCompletions'], 0),
        totalCompletions: parseNumber(profileRaw['totalCompletions'], 0),
        hintFreeCompletions: parseNumber(profileRaw['hintFreeCompletions'], 0),
        bestTimes: getStoredBestTimes(profileRaw),
        dailyGoals: parseDailyGoals(goalsRaw),
    }

    return {
        ...baseProfile,
        badges: buildBadges(baseProfile),
    }
}

export const getRaceRecord = async (postId: string): Promise<RaceRecord> => {
    const raw = await redis.hGetAll(getRaceKey(postId))
    if (Object.keys(raw).length === 0) {
        const legacy = await redis.hGetAll(`puzzle:${postId}`)
        if (Object.keys(legacy).length === 0) {
            throw new Error('Race not found')
        }
        return parseRaceRecord(legacy)
    }
    return parseRaceRecord(raw)
}

const getCompletionSummary = async (postId: string, userId: string): Promise<LeaderboardEntry | null> => {
    const raw = await redis.hGetAll(getCompletionKey(postId, userId))
    if (Object.keys(raw).length === 0) return null

    const rank = await redis.zRank(getDailyLeaderboardKey(postId), userId)

    return {
        userId,
        username: raw['username'] ?? 'anonymous',
        adjustedTime: parseNumber(raw['adjustedTime'], 0),
        elapsedSeconds: parseNumber(raw['elapsedSeconds'], 0),
        difficulty: parseDifficulty(raw['difficulty']),
        rank: rank === undefined ? 0 : rank + 1,
    }
}

export const getLeaderboardState = async (postId: string, userId: string | undefined): Promise<{
    entries: LeaderboardEntry[]
    currentUserRank: number | null
    recentCompletions: RecentCompletionEvent[]
}> => {
    const dayKey = getDayKey(new Date())
    const leaderboard = await redis.zRange(getDailyLeaderboardKey(postId), 0, 9, { by: 'rank' })
    const entries = (await Promise.all(
        leaderboard.map((entry) => getCompletionSummary(postId, entry.member))
    )).filter((entry): entry is LeaderboardEntry => entry !== null)
    const currentUserRank = userId ? await redis.zRank(getDailyLeaderboardKey(postId), userId) : undefined
    const recent = await redis.zRange(getRecentCompletionsKey(postId, dayKey), 0, 4, {
        by: 'rank',
        reverse: true,
    })

    return {
        entries,
        currentUserRank: currentUserRank === undefined ? null : currentUserRank + 1,
        recentCompletions: recent.map((entry) => JSON.parse(entry.member) as RecentCompletionEvent),
    }
}

export const getBootstrapState = async (postId: string, subredditName: string, userId: string | undefined): Promise<BootstrapState> => {
    const dayKey = getDayKey(new Date())
    const race = await getRaceRecord(postId)
    const [profile, leaderboardState] = await Promise.all([
        getProfile(userId, dayKey),
        getLeaderboardState(postId, userId),
    ])

    return {
        postId,
        subredditName,
        channel: getRaceChannel(postId),
        featuredRace: {
            title: race.title,
            difficulty: race.featuredDifficulty,
            puzzle: race.featuredPuzzle,
            solverCount: race.solverCount,
            createdAt: race.createdAt,
        },
        practicePuzzles: race.puzzles,
        practiceSolutions: race.solutions,
        playerProfile: profile,
        leaderboard: {
            entries: leaderboardState.entries,
            currentUserRank: leaderboardState.currentUserRank,
        },
        recentCompletions: leaderboardState.recentCompletions,
    }
}

export const getPreviewState = async (postId: string, userId: string | undefined): Promise<PreviewState> => {
    const dayKey = getDayKey(new Date())
    const race = await getRaceRecord(postId)
    const [profile, leaderboardState] = await Promise.all([
        getProfile(userId, dayKey),
        getLeaderboardState(postId, userId),
    ])

    return {
        channel: getRaceChannel(postId),
        featuredRace: {
            title: race.title,
            difficulty: race.featuredDifficulty,
            puzzle: race.featuredPuzzle,
            solverCount: race.solverCount,
            createdAt: race.createdAt,
        },
        topPlayers: leaderboardState.entries.slice(0, 3),
        recentCompletions: leaderboardState.recentCompletions,
        playerProfile: {
            currentStreak: profile.currentStreak,
            freezeCount: profile.freezeCount,
        },
    }
}

const trimRecentCompletions = async (key: string): Promise<void> => {
    const count = await redis.zCard(key)
    if (count > MAX_FEED_EVENTS) {
        await redis.zRemRangeByRank(key, 0, count - MAX_FEED_EVENTS - 1)
    }
}

const persistProfile = async (userId: string, profile: PlayerProfile & {
    lastFeaturedDay?: string
    weeklyCompletions?: number
    weeklyAdjustedTotal?: number
    weeklyBestImprovement?: number
}): Promise<void> => {
    await redis.hSet(getProfileKey(userId), {
        username: profile.username ?? '',
        currentStreak: String(profile.currentStreak),
        longestStreak: String(profile.longestStreak),
        freezeCount: String(profile.freezeCount),
        totalFeaturedCompletions: String(profile.totalFeaturedCompletions),
        totalCompletions: String(profile.totalCompletions),
        hintFreeCompletions: String(profile.hintFreeCompletions),
        'bestTime:simple': profile.bestTimes.simple === null ? '' : String(profile.bestTimes.simple),
        'bestTime:easy': profile.bestTimes.easy === null ? '' : String(profile.bestTimes.easy),
        'bestTime:intermediate': profile.bestTimes.intermediate === null ? '' : String(profile.bestTimes.intermediate),
        'bestTime:expert': profile.bestTimes.expert === null ? '' : String(profile.bestTimes.expert),
        lastFeaturedDay: profile.lastFeaturedDay ?? '',
        weeklyCompletions: String(profile.weeklyCompletions ?? 0),
        weeklyAdjustedTotal: String(profile.weeklyAdjustedTotal ?? 0),
        weeklyBestImprovement: String(profile.weeklyBestImprovement ?? 0),
    })
}

const updateHistory = async (userId: string, dayKey: string, goals: DailyGoalsState): Promise<void> => {
    await redis.hSet(getHistoryKey(userId, dayKey), {
        featuredRace: goals.featuredRace ? '1' : '0',
        hintFreeAny: goals.hintFreeAny ? '1' : '0',
        beatPersonalBest: goals.beatPersonalBest ? '1' : '0',
    })
}

const getStoredInt = async (key: string, field: string): Promise<number> =>
    parseNumber(await redis.hGet(key, field), 0)

const updateWeeklyStandings = async ({
    subredditName,
    userId,
    adjustedTime,
    personalBestImprovement,
}: {
    subredditName: string
    userId: string
    adjustedTime: number
    personalBestImprovement: number
}): Promise<void> => {
    const profileKey = getProfileKey(userId)
    const currentWeeklyCompletions = await getStoredInt(profileKey, 'weeklyCompletions')
    const currentWeeklyAdjustedTotal = await getStoredInt(profileKey, 'weeklyAdjustedTotal')
    const currentWeeklyBestImprovement = await getStoredInt(profileKey, 'weeklyBestImprovement')

    const nextWeeklyCompletions = currentWeeklyCompletions + 1
    const nextWeeklyAdjustedTotal = currentWeeklyAdjustedTotal + adjustedTime
    const nextWeeklyBestImprovement = Math.max(currentWeeklyBestImprovement, personalBestImprovement)
    const weeklyLeagueScore = (nextWeeklyCompletions * WEEKLY_SCORE_MULTIPLIER) - nextWeeklyAdjustedTotal

    await redis.hSet(profileKey, {
        weeklyCompletions: String(nextWeeklyCompletions),
        weeklyAdjustedTotal: String(nextWeeklyAdjustedTotal),
        weeklyBestImprovement: String(nextWeeklyBestImprovement),
    })
    await redis.zAdd(getWeeklyLeaderboardKey(subredditName), {
        member: userId,
        score: weeklyLeagueScore,
    })
    if (personalBestImprovement > 0) {
        await redis.zAdd(getWeeklyImprovementKey(subredditName), {
            member: userId,
            score: personalBestImprovement,
        })
    }
}

export const recordCompletion = async ({
    postId,
    subredditName,
    userId,
    username,
    submission,
}: RecordCompletionArgs): Promise<CompletionOutcome> => {
    const completedAt = getNow(submission.completedAtIso)
    const dayKey = getDayKey(completedAt)
    const race = await getRaceRecord(postId)
    const expectedSolution = submission.mode === 'featured'
        ? race.featuredSolution
        : race.solutions[submission.difficulty]

    if (submission.board !== expectedSolution) {
        return { valid: false }
    }

    const profile = await getProfile(userId, dayKey)
    const profileRaw = await redis.hGetAll(getProfileKey(userId))
    const historyRaw = await redis.hGetAll(getHistoryKey(userId, dayKey))
    const adjustedTime = calculateAdjustedTime(submission)
    const previousRank = submission.mode === 'featured'
        ? await redis.zRank(getDailyLeaderboardKey(postId), userId)
        : undefined
    const previousBest = profile.bestTimes[submission.difficulty]
    const improvedPersonalBest = previousBest === null || adjustedTime < previousBest
    const personalBestImprovement = previousBest === null ? 0 : Math.max(0, previousBest - adjustedTime)
    const todayGoals = updateDailyGoalsState({
        currentGoals: profile.dailyGoals,
        mode: submission.mode,
        hintsUsed: submission.hintsUsed,
        beatPersonalBest: improvedPersonalBest,
    })
    const alreadyCompletedFeaturedToday = historyRaw['featuredRace'] === '1'
    const hintFreeCompletions = profile.hintFreeCompletions + (submission.hintsUsed === 0 ? 1 : 0)

    const streakOutcome = submission.mode === 'featured' && !alreadyCompletedFeaturedToday
        ? advanceFeaturedStreak({
            currentStreak: profile.currentStreak,
            longestStreak: profile.longestStreak,
            freezeCount: profile.freezeCount,
            lastFeaturedDay: profileRaw['lastFeaturedDay'] ?? null,
            completedDay: dayKey,
        })
        : {
            currentStreak: profile.currentStreak,
            longestStreak: profile.longestStreak,
            freezeCount: profile.freezeCount,
            usedFreeze: false,
        }

    const nextBestTimes = {
        ...profile.bestTimes,
        [submission.difficulty]: improvedPersonalBest ? adjustedTime : profile.bestTimes[submission.difficulty],
    }

    const nextProfileBase = {
        username,
        currentStreak: streakOutcome.currentStreak,
        longestStreak: streakOutcome.longestStreak,
        freezeCount: streakOutcome.freezeCount,
        totalFeaturedCompletions: profile.totalFeaturedCompletions + (submission.mode === 'featured' && !alreadyCompletedFeaturedToday ? 1 : 0),
        totalCompletions: profile.totalCompletions + 1,
        hintFreeCompletions,
        bestTimes: nextBestTimes,
        dailyGoals: todayGoals,
    }

    const nextProfile: PlayerProfile & {
        lastFeaturedDay?: string
        weeklyCompletions?: number
        weeklyAdjustedTotal?: number
        weeklyBestImprovement?: number
    } = {
        ...nextProfileBase,
        badges: buildBadges(nextProfileBase),
        lastFeaturedDay: submission.mode === 'featured' && !alreadyCompletedFeaturedToday
            ? dayKey
            : profileRaw['lastFeaturedDay'] ?? '',
    }

    await persistProfile(userId, nextProfile)
    await updateHistory(userId, dayKey, todayGoals)

    if (submission.mode === 'featured') {
        const completionKey = getCompletionKey(postId, userId)
        const completionExists = await redis.exists(completionKey)

        await redis.hSet(completionKey, {
            username,
            adjustedTime: String(adjustedTime),
            elapsedSeconds: String(submission.elapsedSeconds),
            difficulty: submission.difficulty,
            completedAtIso: completedAt.toISOString(),
        })
        await redis.zAdd(getDailyLeaderboardKey(postId), {
            member: userId,
            score: adjustedTime,
        })
        if (completionExists === 0) {
            await redis.hIncrBy(getRaceKey(postId), 'solverCount', 1)
        }
        const solverCount = parseNumber(
            await redis.hGet(getRaceKey(postId), 'solverCount'),
            0,
        )

        const recentEvent: RecentCompletionEvent = {
            username,
            adjustedTime,
            difficulty: submission.difficulty,
            completedAtIso: completedAt.toISOString(),
        }
        const recentKey = getRecentCompletionsKey(postId, dayKey)
        await redis.zAdd(recentKey, {
            member: JSON.stringify(recentEvent),
            score: completedAt.getTime(),
        })
        await trimRecentCompletions(recentKey)

        await updateWeeklyStandings({
            subredditName,
            userId,
            adjustedTime,
            personalBestImprovement,
        })

        const updatedRank = await redis.zRank(getDailyLeaderboardKey(postId), userId)
        await realtime.send(getRaceChannel(postId), {
            type: 'completion',
            username,
            adjustedTime,
            rank: updatedRank === undefined ? null : updatedRank + 1,
            solverCount,
        })

        const latestLeaderboard = await getLeaderboardState(postId, userId)

        return {
            valid: true,
            completion: {
                adjustedTime,
                currentStreak: nextProfile.currentStreak,
                longestStreak: nextProfile.longestStreak,
                freezeCount: nextProfile.freezeCount,
                rank: updatedRank === undefined ? 0 : updatedRank + 1,
                previousRank: previousRank === undefined ? null : previousRank + 1,
                personalBest: nextBestTimes[submission.difficulty],
                improvedPersonalBest,
                dailyGoals: todayGoals,
                commentPreview: formatScoreComment({
                    difficulty: submission.difficulty,
                    mode: submission.mode,
                    elapsedSeconds: submission.elapsedSeconds,
                    adjustedTime,
                    hintsUsed: submission.hintsUsed,
                    validationFailures: submission.validationFailures,
                    rank: updatedRank === undefined ? null : updatedRank + 1,
                }),
                leaderboardEntries: latestLeaderboard.entries,
                recentCompletions: latestLeaderboard.recentCompletions,
                badges: nextProfile.badges,
            },
        }
    }

    return {
        valid: true,
        completion: {
            adjustedTime,
            currentStreak: nextProfile.currentStreak,
            longestStreak: nextProfile.longestStreak,
            freezeCount: nextProfile.freezeCount,
            rank: 0,
            previousRank: null,
            personalBest: nextBestTimes[submission.difficulty],
            improvedPersonalBest,
            dailyGoals: todayGoals,
            commentPreview: formatScoreComment({
                difficulty: submission.difficulty,
                mode: submission.mode,
                elapsedSeconds: submission.elapsedSeconds,
                adjustedTime,
                hintsUsed: submission.hintsUsed,
                validationFailures: submission.validationFailures,
                rank: null,
            }),
        },
    }
}

export const ensureScoreThread = async (postId: string): Promise<string> => {
    const existing = await redis.get(getScoreThreadKey(postId))
    if (existing) return existing

    const comment = await reddit.submitComment({
        id: postId as `t3_${string}`,
        text: SCORE_THREAD_TEXT,
        runAs: 'APP',
    })
    await comment.distinguish(true)

    await redis.set(getScoreThreadKey(postId), comment.id)
    await redis.hSet(getRaceKey(postId), {
        scoreThreadId: comment.id,
    })

    return comment.id
}

export const commentScore = async ({
    postId,
    difficulty,
    mode,
    elapsedSeconds,
    adjustedTime,
    hintsUsed,
    validationFailures,
    rank,
    note,
}: CommentScoreArgs): Promise<{ commentId: string; target: 'score-thread' | 'post' }> => {
    const scoreThreadId = await ensureScoreThread(postId)
    const target = note?.trim() ? 'post' : 'score-thread'
    const comment = await reddit.submitComment({
        id: (target === 'score-thread' ? scoreThreadId : postId) as `t1_${string}` | `t3_${string}`,
        text: formatScoreComment({
            difficulty,
            mode,
            elapsedSeconds,
            adjustedTime,
            hintsUsed,
            validationFailures,
            rank,
            ...(note === undefined ? {} : { note }),
        }),
        runAs: 'USER',
    })

    return {
        commentId: comment.id,
        target,
    }
}

const getStandingsEntries = async (subredditName: string): Promise<WeeklyStandingsEntry[]> => {
    const weeklyStandings = await redis.zRange(getWeeklyLeaderboardKey(subredditName), 0, 9, {
        by: 'rank',
        reverse: true,
    })

    return Promise.all(weeklyStandings.map(async (entry) => {
        const profile = await redis.hGetAll(getProfileKey(entry.member))
        return {
            userId: entry.member,
            username: profile['username'] ?? 'anonymous',
            currentStreak: parseNumber(profile['currentStreak'], 0),
            weeklyBestImprovement: parseNumber(profile['weeklyBestImprovement'], 0),
            leagueScore: entry.score,
        }
    }))
}

const resetWeeklyProfiles = async (entries: WeeklyStandingsEntry[]): Promise<void> => {
    await Promise.all(entries.map((entry) =>
        redis.hSet(getProfileKey(entry.userId), {
            weeklyCompletions: '0',
            weeklyAdjustedTotal: '0',
            weeklyBestImprovement: '0',
        })
    ))
}

export const createWeeklyRoundup = async (subredditName: string): Promise<RoundupResult> => {
    const standings = await getStandingsEntries(subredditName)
    if (standings.length === 0) {
        return { created: false }
    }

    const champion = standings[0]!
    const streakLeader = standings.reduce((best, current) =>
        current.currentStreak > best.currentStreak ? current : best
    )
    const improvementEntries = await redis.zRange(getWeeklyImprovementKey(subredditName), 0, 0, {
        by: 'rank',
        reverse: true,
    })
    const improvementLeaderId = improvementEntries[0]?.member
    const improvementLeaderProfile = improvementLeaderId
        ? await redis.hGetAll(getProfileKey(improvementLeaderId))
        : {}
    const improvementLeaderName = improvementLeaderProfile['username'] ?? 'nobody'
    const improvementLeaderScore = improvementEntries[0]?.score ?? 0

    const summaryLines = [
        `Weekly champion: u/${champion.username}`,
        `Longest active streak: u/${streakLeader.username} (${streakLeader.currentStreak})`,
        `Most improved: u/${improvementLeaderName} (+${improvementLeaderScore}s)`,
        '',
        'Top weekly league:',
        ...standings.slice(0, 5).map((entry, index) => `${index + 1}. u/${entry.username}`),
    ]

    await reddit.submitPost({
        subredditName,
        title: `Sudoku Weekly Roundup • ${getDayKey(new Date())}`,
        text: summaryLines.join('\n'),
    })

    if (await getConfiguredWinnerFlairEnabled()) {
        await reddit.setUserFlair({
            subredditName,
            username: champion.username,
            text: 'Sudoku Weekly Winner',
            backgroundColor: '#dbeafe',
            textColor: 'dark',
        })
    }

    await resetWeeklyProfiles(standings)
    await redis.del(getWeeklyLeaderboardKey(subredditName), getWeeklyImprovementKey(subredditName))

    return { created: true }
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
}

export const shouldRunDailyPost = async (subredditName: string, now: Date): Promise<boolean> => {
    const hour = await getConfiguredDailyHourUtc()
    if (now.getUTCHours() !== hour) return false

    const markerKey = getSchedulerMarkerKey(subredditName, 'daily-post', getDayKey(now))
    const alreadyRan = await redis.exists(markerKey)
    if (alreadyRan > 0) return false

    await redis.set(markerKey, '1')
    await redis.expire(markerKey, 86_400)
    return true
}

export const shouldRunWeeklyRoundup = async (subredditName: string, now: Date): Promise<boolean> => {
    const roundupDay = await getConfiguredWeeklyRoundupDay()
    const hour = await getConfiguredDailyHourUtc()
    if (now.getUTCDay() !== (WEEKDAY_TO_INDEX[roundupDay] ?? 1) || now.getUTCHours() !== hour) {
        return false
    }

    const markerKey = getSchedulerMarkerKey(subredditName, 'weekly-roundup', getWeekKey(now))
    const alreadyRan = await redis.exists(markerKey)
    if (alreadyRan > 0) return false

    await redis.set(markerKey, '1')
    await redis.expire(markerKey, 604_800)
    return true
}
