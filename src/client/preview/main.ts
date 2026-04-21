import { connectRealtime, requestExpandedMode } from '@devvit/web/client'

import { DIFFICULTY_STORAGE_KEY } from '../lib/constants'
import type { Difficulty } from '../lib/types'
import type { LeaderboardEntry, RecentCompletionEvent } from '../../shared/community'
import '../app.css'

type PreviewState = {
    channel: string
    featuredRace: {
        title: string
        difficulty: Difficulty
        solverCount: number
        createdAt: number
    }
    topPlayers: LeaderboardEntry[]
    recentCompletions: RecentCompletionEvent[]
    playerProfile: {
        currentStreak: number
        freezeCount: number
    }
}

type PreviewResponse = {
    status: 'success'
    data: PreviewState
} | {
    status: 'error'
    message: string
}

type CompletionMessage = {
    type: 'completion'
    username: string
    adjustedTime: number
    rank: number | null
    solverCount?: number
}

type PreviewElements = {
    solverCount: HTMLElement
    recentFeed: HTMLElement
}

const MAX_FEED_EVENTS = 3

const injectStyles = (): void => {
    const style = document.createElement('style')
    style.textContent = `
        @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 14px 30px rgba(15, 23, 42, 0.18); }
            50% { box-shadow: 0 20px 44px rgba(14, 116, 144, 0.22); }
        }

        @keyframes streak-pop {
            0% { transform: scale(0.98); opacity: 0.75; }
            100% { transform: scale(1); opacity: 1; }
        }

        .preview-shell {
            min-height: 100%;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 18px;
            background:
                radial-gradient(circle at top left, rgba(20, 184, 166, 0.16), transparent 38%),
                radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.2), transparent 45%),
                linear-gradient(145deg, #f8fafc, #e2e8f0 58%, #dbeafe);
        }

        .preview-card {
            width: min(100%, 460px);
            border-radius: 28px;
            padding: 22px;
            color: #0f172a;
            background: rgba(255, 255, 255, 0.88);
            border: 1px solid rgba(148, 163, 184, 0.28);
            backdrop-filter: blur(18px);
            animation: pulse-glow 5s ease-in-out infinite;
        }

        .preview-kicker {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            background: rgba(20, 184, 166, 0.12);
            color: #0f766e;
        }

        .preview-title {
            margin: 14px 0 8px;
            font-size: 34px;
            line-height: 1;
            font-weight: 800;
            letter-spacing: -0.04em;
        }

        .preview-subtitle {
            margin: 0;
            font-size: 14px;
            line-height: 1.5;
            color: #334155;
        }

        .preview-metrics {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin-top: 18px;
        }

        .preview-metric {
            border-radius: 18px;
            padding: 14px;
            background: rgba(241, 245, 249, 0.95);
            border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .preview-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #64748b;
        }

        .preview-value {
            margin-top: 6px;
            font-size: 24px;
            line-height: 1;
            font-weight: 800;
            letter-spacing: -0.04em;
        }

        .preview-value-copy {
            margin-top: 4px;
            font-size: 13px;
            color: #334155;
            animation: streak-pop 300ms ease-out;
        }

        .preview-section {
            margin-top: 18px;
            border-radius: 20px;
            padding: 16px;
            background: rgba(248, 250, 252, 0.92);
            border: 1px solid rgba(148, 163, 184, 0.16);
        }

        .preview-section h2 {
            margin: 0 0 10px;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #475569;
        }

        .preview-list {
            margin: 0;
            padding: 0;
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 9px;
        }

        .preview-list-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            font-size: 14px;
            color: #0f172a;
        }

        .preview-rank {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 26px;
            height: 26px;
            border-radius: 999px;
            background: #0f172a;
            color: white;
            font-size: 12px;
            font-weight: 800;
        }

        .preview-top-player {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
        }

        .preview-username {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-weight: 700;
        }

        .preview-time {
            font-variant-numeric: tabular-nums;
            color: #0f766e;
            font-weight: 700;
        }

        .preview-feed-item {
            display: block;
            padding: 10px 12px;
            border-radius: 14px;
            background: rgba(226, 232, 240, 0.72);
            color: #1e293b;
            font-size: 13px;
            line-height: 1.4;
        }

        .preview-cta {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            min-height: 52px;
            margin-top: 18px;
            border: 0;
            border-radius: 18px;
            background: linear-gradient(135deg, #0f766e, #2563eb);
            color: white;
            font-size: 15px;
            font-weight: 800;
            letter-spacing: 0.01em;
            cursor: pointer;
            transition: transform 180ms ease, box-shadow 180ms ease;
            box-shadow: 0 16px 28px rgba(37, 99, 235, 0.24);
        }

        .preview-cta:hover {
            transform: translateY(-1px);
            box-shadow: 0 20px 32px rgba(37, 99, 235, 0.28);
        }
    `
    document.head.appendChild(style)
}

const formatElapsedTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const formatDifficulty = (difficulty: Difficulty): string =>
    `${difficulty[0]?.toUpperCase() ?? ''}${difficulty.slice(1)}`

const createLeaderboardRow = (entry: LeaderboardEntry): HTMLLIElement => {
    const row = document.createElement('li')
    row.className = 'preview-list-item'

    const player = document.createElement('div')
    player.className = 'preview-top-player'

    const rank = document.createElement('span')
    rank.className = 'preview-rank'
    rank.textContent = String(entry.rank)

    const username = document.createElement('span')
    username.className = 'preview-username'
    username.textContent = entry.username

    const time = document.createElement('span')
    time.className = 'preview-time'
    time.textContent = formatElapsedTime(entry.adjustedTime)

    player.append(rank, username)
    row.append(player, time)
    return row
}

const buildFeedText = (event: Pick<RecentCompletionEvent, 'username' | 'adjustedTime'>): string =>
    `${event.username} just finished in ${formatElapsedTime(event.adjustedTime)}`

const renderRecentFeed = (container: HTMLElement, events: Pick<RecentCompletionEvent, 'username' | 'adjustedTime'>[]): void => {
    container.replaceChildren()

    const items = events.slice(0, MAX_FEED_EVENTS)
    if (items.length === 0) {
        const empty = document.createElement('span')
        empty.className = 'preview-feed-item'
        empty.textContent = 'Be the first solver to light up the race.'
        container.appendChild(empty)
        return
    }

    for (const event of items) {
        const item = document.createElement('span')
        item.className = 'preview-feed-item'
        item.textContent = buildFeedText(event)
        container.appendChild(item)
    }
}

const render = (app: HTMLElement, state: PreviewState): PreviewElements => {
    app.style.cssText = 'height: 100%; width: 100%;'
    injectStyles()

    const shell = document.createElement('div')
    shell.className = 'preview-shell'

    const card = document.createElement('section')
    card.className = 'preview-card'

    const kicker = document.createElement('div')
    kicker.className = 'preview-kicker'
    kicker.textContent = 'Today’s Reddit Race'

    const title = document.createElement('h1')
    title.className = 'preview-title'
    title.textContent = state.featuredRace.title

    const subtitle = document.createElement('p')
    subtitle.className = 'preview-subtitle'
    subtitle.textContent = `${formatDifficulty(state.featuredRace.difficulty)} board (${state.featuredRace.difficulty}). Shared leaderboard. One solve that moves the whole thread.`

    const metrics = document.createElement('div')
    metrics.className = 'preview-metrics'

    const difficultyMetric = document.createElement('div')
    difficultyMetric.className = 'preview-metric'

    const difficultyLabel = document.createElement('div')
    difficultyLabel.className = 'preview-label'
    difficultyLabel.textContent = 'Featured Difficulty'

    const difficultyValue = document.createElement('div')
    difficultyValue.className = 'preview-value'
    difficultyValue.textContent = formatDifficulty(state.featuredRace.difficulty)

    const difficultyCopy = document.createElement('div')
    difficultyCopy.className = 'preview-value-copy'
    difficultyCopy.textContent = 'Practice boards stay unlocked too.'

    difficultyMetric.append(difficultyLabel, difficultyValue, difficultyCopy)

    const solverMetric = document.createElement('div')
    solverMetric.className = 'preview-metric'

    const solverLabel = document.createElement('div')
    solverLabel.className = 'preview-label'
    solverLabel.textContent = 'Live Race'

    const solverValue = document.createElement('div')
    solverValue.className = 'preview-value'
    solverValue.textContent = `${state.featuredRace.solverCount}`

    const solverCopy = document.createElement('div')
    solverCopy.className = 'preview-value-copy'
    solverCopy.textContent = `${state.featuredRace.solverCount} solvers chasing the board`

    solverMetric.append(solverLabel, solverValue, solverCopy)
    metrics.append(difficultyMetric, solverMetric)

    const streakSection = document.createElement('section')
    streakSection.className = 'preview-section'

    const streakHeading = document.createElement('h2')
    streakHeading.textContent = 'Return Loop'

    const streakCopy = document.createElement('p')
    streakCopy.className = 'preview-subtitle'
    const freezeSuffix = state.playerProfile.freezeCount > 0
        ? ` • ${state.playerProfile.freezeCount} freeze${state.playerProfile.freezeCount === 1 ? '' : 's'} banked`
        : ''
    streakCopy.textContent = `${state.playerProfile.currentStreak}-day streak${freezeSuffix}`
    streakSection.append(streakHeading, streakCopy)

    const leaderboardSection = document.createElement('section')
    leaderboardSection.className = 'preview-section'

    const leaderboardHeading = document.createElement('h2')
    leaderboardHeading.textContent = 'Top Solvers'

    const leaderboardList = document.createElement('ol')
    leaderboardList.className = 'preview-list'
    for (const entry of state.topPlayers) {
        leaderboardList.appendChild(createLeaderboardRow(entry))
    }
    leaderboardSection.append(leaderboardHeading, leaderboardList)

    const feedSection = document.createElement('section')
    feedSection.className = 'preview-section'

    const feedHeading = document.createElement('h2')
    feedHeading.textContent = 'Live Feed'

    const feedList = document.createElement('div')
    feedList.className = 'preview-list'
    renderRecentFeed(feedList, state.recentCompletions)
    feedSection.append(feedHeading, feedList)

    const cta = document.createElement('button')
    cta.className = 'preview-cta'
    cta.textContent = 'Play Today\'s Race'
    cta.addEventListener('click', (event: MouseEvent) => {
        try {
            localStorage.setItem(DIFFICULTY_STORAGE_KEY, state.featuredRace.difficulty)
        } catch {
            // localStorage unavailable; continue into the game anyway
        }

        requestExpandedMode(event, 'game')
    })

    card.append(kicker, title, subtitle, metrics, streakSection, leaderboardSection, feedSection, cta)
    shell.appendChild(card)
    app.replaceChildren(shell)

    return {
        solverCount: solverCopy,
        recentFeed: feedList,
    }
}

const fetchPreviewState = async (): Promise<PreviewState> => {
    const response = await fetch('/api/preview-state')
    const payload = await response.json() as PreviewResponse

    if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.status === 'error' ? payload.message : 'Failed to load preview')
    }

    return payload.data
}

const boot = async (): Promise<void> => {
    const app = document.getElementById('app')
    if (!app) throw new Error('App element not found')

    try {
        const state = await fetchPreviewState()
        const elements = render(app, state)
        const feedEvents: Pick<RecentCompletionEvent, 'username' | 'adjustedTime'>[] = [
            ...state.recentCompletions,
        ]
        let solverCount = state.featuredRace.solverCount

        connectRealtime<CompletionMessage>({
            channel: state.channel,
            onMessage: (message) => {
                if (message.type !== 'completion') return
                solverCount = message.solverCount ?? (solverCount + 1)
                elements.solverCount.textContent = `${solverCount} solvers chasing the board`
                feedEvents.unshift({
                    username: message.username,
                    adjustedTime: message.adjustedTime,
                })
                renderRecentFeed(elements.recentFeed, feedEvents)
            },
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load today’s race.'
        app.innerHTML = `
            <div class="preview-shell">
                <section class="preview-card">
                    <h1 class="preview-title">Sudoku</h1>
                    <p class="preview-subtitle">${message}</p>
                </section>
            </div>
        `
    }
}

void boot()
