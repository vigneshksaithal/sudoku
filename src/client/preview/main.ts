import { requestExpandedMode } from '@devvit/web/client'
import { DIFFICULTY_STORAGE_KEY, VALID_DIFFICULTIES } from '../lib/constants'
import type { Difficulty } from '../lib/types'
import '../app.css'

// 4×4 mini grid: 0 = empty cell
// Solution: row0=1234, row1=3412, row2=2143, row3=4321
const SAMPLE_GRID = [
    [1, 0, 3, 0],
    [0, 4, 0, 2],
    [2, 0, 4, 0],
    [0, 3, 0, 1],
] as const

const SOLVE_SEQUENCE: ReadonlyArray<{ row: number; col: number; value: number }> = [
    { row: 0, col: 1, value: 2 },
    { row: 0, col: 3, value: 4 },
    { row: 1, col: 0, value: 3 },
    { row: 1, col: 2, value: 1 },
    { row: 2, col: 1, value: 1 },
    { row: 2, col: 3, value: 3 },
    { row: 3, col: 0, value: 4 },
    { row: 3, col: 2, value: 2 },
]

const GRID_SIZE = 4
const BOX_SIZE = 2

const getDefaultDifficulty = (): Difficulty => {
    try {
        const stored = localStorage.getItem(DIFFICULTY_STORAGE_KEY)
        if (stored !== null && (VALID_DIFFICULTIES as readonly string[]).includes(stored)) {
            return stored as Difficulty
        }
    } catch {
        // localStorage unavailable
    }
    return 'easy'
}

const injectStyles = (): void => {
    const style = document.createElement('style')
    style.textContent = `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
            --bg:            #f2f2f7;
            --bg-elevated:   rgba(255,255,255,0.72);
            --separator:     rgba(60,60,67,0.13);
            --separator-box: rgba(60,60,67,0.28);
            --label:         #1c1c1e;
            --label-2:       rgba(60,60,67,0.6);
            --accent:        #007aff;
            --accent-dark:   #0062cc;
            --cell-given:    #1c1c1e;
            --cell-placed:   #007aff;
            --cell-selected: rgba(0,122,255,0.18);
            --shadow-card:   0 2px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06);
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg:            #1c1c1e;
                --bg-elevated:   rgba(44,44,46,0.8);
                --separator:     rgba(84,84,88,0.36);
                --separator-box: rgba(84,84,88,0.65);
                --label:         #ffffff;
                --label-2:       rgba(235,235,245,0.6);
                --accent:        #0a84ff;
                --accent-dark:   #0070d8;
                --cell-given:    rgba(235,235,245,0.9);
                --cell-placed:   #0a84ff;
                --cell-selected: rgba(10,132,255,0.22);
                --shadow-card:   0 2px 16px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.3);
            }
        }

        html, body { height: 100%; background: var(--bg); }

        .scene {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 22px;
            height: 100%;
            width: 100%;
            padding: 28px 20px;
            background: var(--bg);
        }

        /* ── Grid ── */
        .grid-wrapper {
            position: relative;
            cursor: pointer;
        }
        .grid-wrapper:active .grid-card {
            transform: scale(0.98);
        }
        .grid-card {
            background: var(--bg-elevated);
            border-radius: 14px;
            box-shadow: var(--shadow-card);
            padding: 3px;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .grid-wrapper:hover .grid-card {
            box-shadow: 0 4px 20px rgba(0,122,255,0.18), 0 1px 4px rgba(0,0,0,0.08);
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            width: 120px;
            height: 120px;
            border-radius: 8px;
            overflow: hidden;
        }
        .cell {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 15px;
            font-weight: 600;
            font-family: system-ui, -apple-system, sans-serif;
            color: var(--cell-given);
            transition: background 0.18s ease;
        }
        .cell.selected { background: var(--cell-selected); }
        .cell .placed {
            color: var(--cell-placed);
            font-weight: 500;
        }

        /* Live badge */
        .live-badge {
            position: absolute;
            top: -8px;
            right: -8px;
            background: var(--accent);
            color: #fff;
            font-size: 9px;
            font-weight: 700;
            font-family: system-ui, -apple-system, sans-serif;
            letter-spacing: 0.06em;
            padding: 2px 6px;
            border-radius: 20px;
            text-transform: uppercase;
            display: flex;
            align-items: center;
            gap: 3px;
            box-shadow: 0 1px 4px rgba(0,122,255,0.4);
            animation: badge-pulse 2s ease-in-out infinite;
        }
        .live-dot {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: #fff;
            animation: dot-blink 1.2s ease-in-out infinite;
        }
        @keyframes badge-pulse {
            0%, 100% { box-shadow: 0 1px 4px rgba(0,122,255,0.4); }
            50%       { box-shadow: 0 1px 8px rgba(0,122,255,0.7); }
        }
        @keyframes dot-blink {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.3; }
        }

        /* ── Title ── */
        .title-block { text-align: center; }
        .title {
            font-size: 30px;
            font-weight: 700;
            letter-spacing: -0.025em;
            color: var(--label);
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.05;
        }
        .subtitle {
            margin-top: 4px;
            font-size: 14px;
            font-weight: 400;
            color: var(--label-2);
            font-family: system-ui, -apple-system, sans-serif;
        }

        /* ── Play Button ── */
        .play-btn-wrap {
            width: 100%;
            max-width: 264px;
        }
        .play-btn {
            position: relative;
            overflow: hidden;
            width: 100%;
            height: 60px;
            border-radius: 16px;
            border: none;
            background: linear-gradient(135deg, #1a8cff 0%, #0062cc 100%);
            color: #fff;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 18px;
            font-weight: 800;
            letter-spacing: 0.02em;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            /* Layered shadow: ambient + colored glow */
            box-shadow:
                0 0 0 0 rgba(0,122,255,0),
                0 6px 20px rgba(0,98,204,0.5),
                0 2px 6px rgba(0,0,0,0.15),
                inset 0 1px 0 rgba(255,255,255,0.2);
            /* Pulsating scale */
            animation: btn-breathe 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            -webkit-tap-highlight-color: transparent;
            transition: transform 0.1s ease, box-shadow 0.1s ease;
        }
        /* Shimmer sweep — the "game button" signature effect */
        .play-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 60%;
            height: 100%;
            background: linear-gradient(
                105deg,
                transparent 20%,
                rgba(255,255,255,0.35) 50%,
                transparent 80%
            );
            animation: shimmer-sweep 3s ease-in-out infinite;
            pointer-events: none;
        }
        /* Top edge highlight — gives depth */
        .play-btn::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: rgba(255,255,255,0.4);
            border-radius: 16px 16px 0 0;
            pointer-events: none;
        }
        .play-btn:hover {
            animation: none;
            transform: translateY(-2px) scale(1.02);
            box-shadow:
                0 0 0 0 rgba(0,122,255,0),
                0 10px 28px rgba(0,98,204,0.65),
                0 3px 8px rgba(0,0,0,0.18),
                inset 0 1px 0 rgba(255,255,255,0.25);
        }
        .play-btn:active {
            animation: none;
            transform: scale(0.97) translateY(1px);
            box-shadow:
                0 2px 8px rgba(0,98,204,0.4),
                0 1px 3px rgba(0,0,0,0.12),
                inset 0 1px 0 rgba(255,255,255,0.15);
        }

        /* Pulse: snappy grow → shrink → settle */
        @keyframes btn-breathe {
            0%   { transform: scale(1);     box-shadow: 0 6px 20px rgba(0,98,204,0.5),  0 2px 6px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.2); }
            30%  { transform: scale(1.07);  box-shadow: 0 10px 32px rgba(0,98,204,0.75), 0 4px 10px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.28); }
            55%  { transform: scale(0.96);  box-shadow: 0 3px 10px rgba(0,98,204,0.35),  0 1px 4px rgba(0,0,0,0.1),  inset 0 1px 0 rgba(255,255,255,0.15); }
            75%  { transform: scale(1.02);  box-shadow: 0 7px 22px rgba(0,98,204,0.55),  0 2px 6px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.2); }
            100% { transform: scale(1);     box-shadow: 0 6px 20px rgba(0,98,204,0.5),  0 2px 6px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.2); }
        }

        /* Shimmer: diagonal light sweep */
        @keyframes shimmer-sweep {
            0%   { left: -100%; opacity: 1; }
            60%  { left: 150%;  opacity: 1; }
            61%  { opacity: 0; }
            100% { left: 150%;  opacity: 0; }
        }

        /* Play icon: periodic "ready" pop */
        .play-icon {
            font-size: 16px;
            display: inline-block;
            animation: icon-ready 3s ease-in-out infinite;
            animation-delay: 1.3s;
        }
        @keyframes icon-ready {
            0%, 80%, 100% { transform: scale(1) translateX(0); }
            88%            { transform: scale(1.4) translateX(2px); }
            94%            { transform: scale(0.9) translateX(0); }
        }

        /* ── Corner ribbon banner ── */
        .ribbon-wrapper {
            position: fixed;
            top: 0;
            left: 0;
            width: 150px;
            height: 150px;
            overflow: hidden;
            pointer-events: none;
            z-index: 100;
        }
        .ribbon {
            position: absolute;
            top: 32px;
            left: -36px;
            width: 190px;
            padding: 8px 0;
            background: linear-gradient(135deg, #ff4500 0%, #ff6b3a 100%);
            color: #fff;
            font-size: 13px;
            font-weight: 700;
            font-family: system-ui, -apple-system, sans-serif;
            text-align: center;
            letter-spacing: 0.03em;
            transform: rotate(-45deg);
            box-shadow: 0 3px 10px rgba(255,69,0,0.35), 0 1px 3px rgba(0,0,0,0.2);
        }

        /* ── Entry animations ── */
        @keyframes rise {
            from { opacity: 0; transform: translateY(14px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .enter {
            opacity: 0;
            animation: rise 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }

        @keyframes appear {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        .num {
            opacity: 0;
            animation: appear 0.25s ease-out forwards;
        }

        @keyframes pop-in {
            0%   { opacity: 0; transform: scale(0.5); }
            60%  { opacity: 1; transform: scale(1.1); }
            100% { opacity: 1; transform: scale(1); }
        }
        .pop {
            animation: pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
    `
    document.head.appendChild(style)
}

type CellRef = { element: HTMLDivElement; row: number; col: number }

const createDecorativeGrid = (): { root: HTMLElement; cells: CellRef[] } => {
    const wrapper = document.createElement('div')
    wrapper.className = 'grid-wrapper enter'
    wrapper.style.animationDelay = '0ms'

    const card = document.createElement('div')
    card.className = 'grid-card'

    const grid = document.createElement('div')
    grid.className = 'grid'

    const cells: CellRef[] = []

    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const cell = document.createElement('div')
            cell.className = 'cell'

            const borderRight = col < GRID_SIZE - 1
                ? `1px solid ${(col + 1) % BOX_SIZE === 0 ? 'var(--separator-box)' : 'var(--separator)'}`
                : 'none'
            const borderBottom = row < GRID_SIZE - 1
                ? `1px solid ${(row + 1) % BOX_SIZE === 0 ? 'var(--separator-box)' : 'var(--separator)'}`
                : 'none'

            cell.style.borderRight = borderRight
            cell.style.borderBottom = borderBottom

            const value = SAMPLE_GRID[row]?.[col] ?? 0
            if (value > 0) {
                const num = document.createElement('span')
                num.className = 'num'
                num.textContent = String(value)
                num.style.animationDelay = `${(row * GRID_SIZE + col) * 10}ms`
                cell.appendChild(num)
            }

            cells.push({ element: cell, row, col })
            grid.appendChild(cell)
        }
    }

    const badge = document.createElement('div')
    badge.className = 'live-badge'
    const dot = document.createElement('div')
    dot.className = 'live-dot'
    badge.appendChild(dot)
    badge.appendChild(document.createTextNode('Live'))

    card.appendChild(grid)
    wrapper.appendChild(card)
    wrapper.appendChild(badge)

    return { root: wrapper, cells }
}

const getCell = (cells: ReadonlyArray<CellRef>, row: number, col: number): CellRef | undefined =>
    cells.find((c) => c.row === row && c.col === col)

const startPlaybackLoop = (cells: ReadonlyArray<CellRef>): void => {
    let stepIndex = 0
    let prevSelected: CellRef | undefined
    const STEP_INTERVAL = 1400
    const INITIAL_DELAY = 900

    const step = (): void => {
        if (prevSelected) {
            prevSelected.element.classList.remove('selected')
        }

        const move = SOLVE_SEQUENCE[stepIndex % SOLVE_SEQUENCE.length]
        if (!move) return

        if (stepIndex > 0 && stepIndex % SOLVE_SEQUENCE.length === 0) {
            for (const s of SOLVE_SEQUENCE) {
                const ref = getCell(cells, s.row, s.col)
                if (ref) {
                    const placed = ref.element.querySelector('.placed')
                    if (placed) placed.remove()
                }
            }
        }

        const cellRef = getCell(cells, move.row, move.col)
        if (!cellRef) return

        cellRef.element.classList.add('selected')
        prevSelected = cellRef

        setTimeout(() => {
            const existing = cellRef.element.querySelector('.placed')
            if (existing) existing.remove()

            const span = document.createElement('span')
            span.className = 'placed pop'
            span.textContent = String(move.value)
            cellRef.element.appendChild(span)

            stepIndex++
        }, 500)
    }

    setTimeout(() => {
        step()
        setInterval(step, STEP_INTERVAL)
    }, INITIAL_DELAY)
}

const launchGame = (difficulty: Difficulty, event: MouseEvent): void => {
    try {
        localStorage.setItem(DIFFICULTY_STORAGE_KEY, difficulty)
    } catch {
        // localStorage unavailable — continue
    }
    requestExpandedMode(event, 'game')
}

const createPlayButton = (defaultDifficulty: Difficulty): HTMLElement => {
    const wrap = document.createElement('div')
    wrap.className = 'play-btn-wrap enter'
    wrap.style.animationDelay = '200ms'

    const btn = document.createElement('button')
    btn.className = 'play-btn'

    const icon = document.createElement('span')
    icon.className = 'play-icon'
    icon.textContent = '▶'

    const label = document.createElement('span')
    label.textContent = 'PLAY NOW'

    btn.appendChild(icon)
    btn.appendChild(label)

    btn.addEventListener('click', (event: MouseEvent) => {
        launchGame(defaultDifficulty, event)
    })

    wrap.appendChild(btn)
    return wrap
}

const render = (app: HTMLElement): void => {
    app.style.cssText = 'height:100%;width:100%;'

    injectStyles()

    const defaultDifficulty = getDefaultDifficulty()

    const scene = document.createElement('div')
    scene.className = 'scene'

    // Grid — clicking it also launches the game
    const { root: gridEl, cells } = createDecorativeGrid()
    gridEl.addEventListener('click', (event: MouseEvent) => {
        launchGame(defaultDifficulty, event)
    })
    scene.appendChild(gridEl)

    // Title
    const titleBlock = document.createElement('div')
    titleBlock.className = 'title-block enter'
    titleBlock.style.animationDelay = '100ms'

    const title = document.createElement('h1')
    title.className = 'title'
    title.textContent = 'Sudoku'

    const subtitle = document.createElement('p')
    subtitle.className = 'subtitle'
    subtitle.textContent = "Today's puzzle is ready — tap to play"

    titleBlock.appendChild(title)
    titleBlock.appendChild(subtitle)
    scene.appendChild(titleBlock)

    // Play button
    scene.appendChild(createPlayButton(defaultDifficulty))

    app.appendChild(scene)

    // Corner ribbon banner
    const ribbonWrapper = document.createElement('div')
    ribbonWrapper.className = 'ribbon-wrapper'
    const ribbon = document.createElement('div')
    ribbon.className = 'ribbon'
    ribbon.textContent = 'Play on Reddit'
    ribbonWrapper.appendChild(ribbon)
    app.appendChild(ribbonWrapper)

    startPlaybackLoop(cells)
}

const app = document.getElementById('app')
if (!app) throw new Error('App element not found')
render(app)
