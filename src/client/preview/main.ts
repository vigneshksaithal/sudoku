import { requestExpandedMode } from '@devvit/web/client'
import { DIFFICULTY_STORAGE_KEY, VALID_DIFFICULTIES } from '../lib/constants'
import type { Difficulty } from '../lib/types'
import '../app.css'

// ─── 9×9 sample grid (0 = empty, will be animated) ───────────────────────────
// A realistic easy-looking partially-filled 9×9.
// Givens are non-zero; zeros are the cells we animate solving.
const SAMPLE_GRID: ReadonlyArray<ReadonlyArray<number>> = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9],
]

// Sequence of cells to animate filling in — spread across the board for visual interest
const SOLVE_SEQUENCE: ReadonlyArray<{ row: number; col: number; value: number }> = [
    { row: 0, col: 2, value: 4 },
    { row: 0, col: 3, value: 6 },
    { row: 1, col: 1, value: 7 },
    { row: 2, col: 0, value: 1 },
    { row: 2, col: 6, value: 7 },
    { row: 3, col: 1, value: 5 },
    { row: 4, col: 1, value: 2 },
    { row: 5, col: 1, value: 1 },
    { row: 6, col: 0, value: 9 },
    { row: 7, col: 0, value: 2 },
    { row: 8, col: 0, value: 3 },
    { row: 8, col: 2, value: 6 },
]

const GRID_SIZE = 9
const BOX_SIZE = 3

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

// Returns today's date formatted as e.g. "Thursday, May 22"
const getTodayLabel = (): string => {
    const now = new Date()
    return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

const injectStyles = (): void => {
    const style = document.createElement('style')
    style.textContent = `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
            --bg:            #f2f2f7;
            --bg-elevated:   rgba(255,255,255,0.85);
            --separator:     rgba(60,60,67,0.13);
            --separator-box: rgba(60,60,67,0.36);
            --label:         #1c1c1e;
            --label-2:       rgba(60,60,67,0.55);
            --label-3:       rgba(60,60,67,0.38);
            --accent:        #007aff;
            --accent-dark:   #0062cc;
            --cell-given:    #1c1c1e;
            --cell-placed:   #007aff;
            --cell-selected: rgba(0,122,255,0.15);
            --shadow-card:   0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06);
            --chip-bg:       rgba(0,0,0,0.06);
            --chip-active-bg: #007aff;
            --chip-active-text: #fff;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg:            #1c1c1e;
                --bg-elevated:   rgba(44,44,46,0.9);
                --separator:     rgba(84,84,88,0.32);
                --separator-box: rgba(84,84,88,0.60);
                --label:         #ffffff;
                --label-2:       rgba(235,235,245,0.55);
                --label-3:       rgba(235,235,245,0.32);
                --accent:        #0a84ff;
                --accent-dark:   #0070d8;
                --cell-given:    rgba(235,235,245,0.92);
                --cell-placed:   #0a84ff;
                --cell-selected: rgba(10,132,255,0.20);
                --shadow-card:   0 4px 24px rgba(0,0,0,0.45), 0 1px 6px rgba(0,0,0,0.3);
                --chip-bg:       rgba(255,255,255,0.10);
                --chip-active-bg: #0a84ff;
                --chip-active-text: #fff;
            }
        }

        html, body { height: 100%; background: var(--bg); }

        /* ── Scene ── */
        .scene {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 14px;
            min-height: 100%;
            width: 100%;
            padding: 20px 18px 24px;
            background: var(--bg);
        }

        /* ── Date pill ── */
        .date-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: var(--chip-bg);
            border-radius: 20px;
            padding: 5px 12px;
            font-size: 11px;
            font-weight: 600;
            font-family: system-ui, -apple-system, sans-serif;
            color: var(--label-2);
            letter-spacing: 0.02em;
            text-transform: uppercase;
        }
        .date-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--accent);
            animation: dot-blink 1.4s ease-in-out infinite;
            flex-shrink: 0;
        }
        @keyframes dot-blink {
            0%, 100% { opacity: 1;   transform: scale(1); }
            50%       { opacity: 0.4; transform: scale(0.75); }
        }

        /* ── Grid ── */
        .grid-wrapper {
            position: relative;
            cursor: pointer;
        }
        .grid-wrapper:active .grid-card {
            transform: scale(0.985);
        }
        .grid-card {
            background: var(--bg-elevated);
            border-radius: 12px;
            box-shadow: var(--shadow-card);
            padding: 6px;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .grid-wrapper:hover .grid-card {
            box-shadow: 0 6px 28px rgba(0,122,255,0.22), 0 2px 6px rgba(0,0,0,0.08);
            transform: translateY(-1px);
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(9, 1fr);
            width: 216px;
            height: 216px;
            border-radius: 6px;
            overflow: hidden;
        }
        .cell {
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 11px;
            font-weight: 600;
            color: var(--cell-given);
            transition: background 0.15s ease;
            position: relative;
        }
        .cell.selected {
            background: var(--cell-selected);
        }
        .cell .placed {
            color: var(--cell-placed);
            font-weight: 600;
        }
        .cell.empty-cell {
            color: var(--label-3);
        }

        /* ── Social proof row ── */
        .social-row {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 500;
            font-family: system-ui, -apple-system, sans-serif;
            color: var(--label-2);
        }
        .social-avatars {
            display: flex;
        }
        .avatar {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            border: 1.5px solid var(--bg);
            margin-left: -5px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            font-weight: 700;
            color: #fff;
        }
        .avatar:first-child { margin-left: 0; }
        .avatar-a { background: #ff4500; }
        .avatar-b { background: #0a84ff; }
        .avatar-c { background: #30d158; }
        .avatar-d { background: #ff9f0a; }

        /* ── Title ── */
        .title-block {
            text-align: center;
        }
        .title {
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.03em;
            color: var(--label);
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.05;
        }
        .subtitle {
            margin-top: 3px;
            font-size: 13px;
            font-weight: 400;
            color: var(--label-2);
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.4;
        }

        /* ── Difficulty chips ── */
        .chips-row {
            display: flex;
            gap: 7px;
            align-items: center;
        }
        .chip {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            font-family: system-ui, -apple-system, sans-serif;
            cursor: pointer;
            border: none;
            background: var(--chip-bg);
            color: var(--label-2);
            transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
            -webkit-tap-highlight-color: transparent;
            text-transform: capitalize;
        }
        .chip:active { transform: scale(0.94); }
        .chip.active {
            background: var(--chip-active-bg);
            color: var(--chip-active-text);
        }

        /* ── Play Button ── */
        .play-btn-wrap {
            width: 100%;
            max-width: 272px;
        }
        .play-btn {
            position: relative;
            overflow: hidden;
            width: 100%;
            height: 56px;
            border-radius: 16px;
            border: none;
            background: linear-gradient(135deg, #1a8cff 0%, #0062cc 100%);
            color: #fff;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 16px;
            font-weight: 800;
            letter-spacing: 0.01em;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 9px;
            box-shadow:
                0 6px 20px rgba(0,98,204,0.50),
                0 2px 6px rgba(0,0,0,0.14),
                inset 0 1px 0 rgba(255,255,255,0.20);
            animation: btn-breathe 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            -webkit-tap-highlight-color: transparent;
            transition: transform 0.1s ease, box-shadow 0.1s ease;
        }
        /* Shimmer sweep */
        .play-btn::before {
            content: '';
            position: absolute;
            top: 0; left: -100%;
            width: 60%; height: 100%;
            background: linear-gradient(
                105deg,
                transparent 20%,
                rgba(255,255,255,0.30) 50%,
                transparent 80%
            );
            animation: shimmer-sweep 3.5s ease-in-out infinite;
            pointer-events: none;
        }
        /* Top edge gloss */
        .play-btn::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 1px;
            background: rgba(255,255,255,0.38);
            border-radius: 16px 16px 0 0;
            pointer-events: none;
        }
        .play-btn:hover {
            animation: none;
            transform: translateY(-2px) scale(1.02);
            box-shadow:
                0 10px 28px rgba(0,98,204,0.65),
                0 3px 8px rgba(0,0,0,0.18),
                inset 0 1px 0 rgba(255,255,255,0.25);
        }
        .play-btn:active {
            animation: none;
            transform: scale(0.97) translateY(1px);
            box-shadow:
                0 2px 8px rgba(0,98,204,0.40),
                0 1px 3px rgba(0,0,0,0.12),
                inset 0 1px 0 rgba(255,255,255,0.15);
        }
        @keyframes btn-breathe {
            0%   { transform: scale(1);    box-shadow: 0 6px 20px rgba(0,98,204,0.50), 0 2px 6px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.20); }
            35%  { transform: scale(1.04); box-shadow: 0 9px 28px rgba(0,98,204,0.70), 0 3px 9px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.26); }
            60%  { transform: scale(0.98); box-shadow: 0 4px 12px rgba(0,98,204,0.38), 0 1px 4px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.16); }
            80%  { transform: scale(1.01); box-shadow: 0 7px 22px rgba(0,98,204,0.55), 0 2px 6px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.20); }
            100% { transform: scale(1);    box-shadow: 0 6px 20px rgba(0,98,204,0.50), 0 2px 6px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.20); }
        }
        @keyframes shimmer-sweep {
            0%  { left: -100%; opacity: 1; }
            55% { left: 150%;  opacity: 1; }
            56% { opacity: 0; }
            100%{ left: 150%;  opacity: 0; }
        }
        .play-icon {
            font-size: 15px;
            display: inline-block;
            animation: icon-nudge 3.5s ease-in-out infinite;
            animation-delay: 1.8s;
        }
        @keyframes icon-nudge {
            0%, 75%, 100% { transform: scale(1) translateX(0); }
            83%            { transform: scale(1.35) translateX(3px); }
            92%            { transform: scale(0.92) translateX(0); }
        }

        /* ── Entry animations ── */
        @keyframes rise {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .enter {
            opacity: 0;
            animation: rise 0.40s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        @keyframes appear {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        .num {
            opacity: 0;
            animation: appear 0.2s ease-out forwards;
        }
        @keyframes pop-in {
            0%   { opacity: 0; transform: scale(0.4); }
            60%  { opacity: 1; transform: scale(1.15); }
            100% { opacity: 1; transform: scale(1); }
        }
        .pop {
            animation: pop-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
    `
    document.head.appendChild(style)
}

// ─── Types ────────────────────────────────────────────────────────────────────
type CellRef = { element: HTMLDivElement; row: number; col: number }

// ─── Grid ─────────────────────────────────────────────────────────────────────
const createDecorativeGrid = (): { root: HTMLElement; cells: CellRef[] } => {
    const wrapper = document.createElement('div')
    wrapper.className = 'grid-wrapper enter'
    wrapper.style.animationDelay = '80ms'

    const card = document.createElement('div')
    card.className = 'grid-card'

    const grid = document.createElement('div')
    grid.className = 'grid'

    const cells: CellRef[] = []

    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const cell = document.createElement('div')
            cell.className = 'cell'

            // Box borders — thicker at 3×3 box boundaries
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
                // Stagger given-cell reveal across the whole board
                num.style.animationDelay = `${80 + (row * GRID_SIZE + col) * 8}ms`
                cell.appendChild(num)
            } else {
                cell.classList.add('empty-cell')
            }

            cells.push({ element: cell, row, col })
            grid.appendChild(cell)
        }
    }

    card.appendChild(grid)
    wrapper.appendChild(card)

    return { root: wrapper, cells }
}

const getCell = (cells: ReadonlyArray<CellRef>, row: number, col: number): CellRef | undefined =>
    cells.find((c) => c.row === row && c.col === col)

const startPlaybackLoop = (cells: ReadonlyArray<CellRef>): void => {
    let stepIndex = 0
    let prevSelected: CellRef | undefined
    const STEP_INTERVAL = 1200  // faster than before — more lively
    const INITIAL_DELAY = 1000

    const step = (): void => {
        if (prevSelected) {
            prevSelected.element.classList.remove('selected')
        }

        const move = SOLVE_SEQUENCE[stepIndex % SOLVE_SEQUENCE.length]
        if (!move) return

        // Reset placed cells when the sequence loops
        if (stepIndex > 0 && stepIndex % SOLVE_SEQUENCE.length === 0) {
            for (const s of SOLVE_SEQUENCE) {
                const ref = getCell(cells, s.row, s.col)
                if (ref) {
                    const placed = ref.element.querySelector('.placed')
                    if (placed) placed.remove()
                    ref.element.classList.add('empty-cell')
                }
            }
        }

        const cellRef = getCell(cells, move.row, move.col)
        if (!cellRef) return

        cellRef.element.classList.add('selected')
        cellRef.element.classList.remove('empty-cell')
        prevSelected = cellRef

        setTimeout(() => {
            const existing = cellRef.element.querySelector('.placed')
            if (existing) existing.remove()

            const span = document.createElement('span')
            span.className = 'placed pop'
            span.textContent = String(move.value)
            cellRef.element.appendChild(span)

            stepIndex++
        }, 480)
    }

    setTimeout(() => {
        step()
        setInterval(step, STEP_INTERVAL)
    }, INITIAL_DELAY)
}

// ─── Launch ───────────────────────────────────────────────────────────────────
const launchGame = (difficulty: Difficulty, event: MouseEvent): void => {
    try {
        localStorage.setItem(DIFFICULTY_STORAGE_KEY, difficulty)
    } catch {
        // localStorage unavailable — continue
    }
    requestExpandedMode(event, 'game')
}

// ─── Social proof row ─────────────────────────────────────────────────────────
const createSocialProof = (): HTMLElement => {
    const row = document.createElement('div')
    row.className = 'social-row enter'
    row.style.animationDelay = '220ms'

    // Coloured avatar cluster
    const avatars = document.createElement('div')
    avatars.className = 'social-avatars'
    const colours: Array<'avatar-a' | 'avatar-b' | 'avatar-c' | 'avatar-d'> = [
        'avatar-a', 'avatar-b', 'avatar-c', 'avatar-d',
    ]
    const initials = ['R', 'u', 'K', 'J']
    colours.forEach((cls, i) => {
        const av = document.createElement('div')
        av.className = `avatar ${cls}`
        av.textContent = initials[i] ?? ''
        avatars.appendChild(av)
    })

    const text = document.createElement('span')
    // Deterministic-looking number seeded on today's date so it changes daily
    const dayOfYear = Math.floor(
        (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
    )
    // Ranges 1,800 – 3,400 across the year
    const solveCount = 1800 + ((dayOfYear * 53) % 1601)
    text.textContent = `${solveCount.toLocaleString()} solves today`

    row.appendChild(avatars)
    row.appendChild(text)
    return row
}

// ─── Difficulty chips ─────────────────────────────────────────────────────────
const createDifficultyChips = (
    selected: Difficulty,
    onSelect: (d: Difficulty, e: MouseEvent) => void,
): HTMLElement => {
    const wrap = document.createElement('div')
    wrap.className = 'chips-row enter'
    wrap.style.animationDelay = '260ms'

    const difficulties: Difficulty[] = ['simple', 'easy', 'intermediate', 'expert']

    for (const d of difficulties) {
        const chip = document.createElement('button')
        chip.className = `chip${d === selected ? ' active' : ''}`
        chip.textContent = d
        chip.addEventListener('click', (e: MouseEvent) => {
            // Update active chip visually
            wrap.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'))
            chip.classList.add('active')
            onSelect(d, e)
        })
        wrap.appendChild(chip)
    }

    return wrap
}

// ─── Play button ──────────────────────────────────────────────────────────────
const createPlayButton = (getDifficulty: () => Difficulty): HTMLElement => {
    const wrap = document.createElement('div')
    wrap.className = 'play-btn-wrap enter'
    wrap.style.animationDelay = '300ms'

    const btn = document.createElement('button')
    btn.className = 'play-btn'
    btn.setAttribute('aria-label', 'Play today\'s Sudoku puzzle')

    const icon = document.createElement('span')
    icon.className = 'play-icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.textContent = '▶'

    const label = document.createElement('span')
    label.textContent = "Play Today's Puzzle"

    btn.appendChild(icon)
    btn.appendChild(label)

    btn.addEventListener('click', (event: MouseEvent) => {
        launchGame(getDifficulty(), event)
    })

    wrap.appendChild(btn)
    return wrap
}

// ─── Render ───────────────────────────────────────────────────────────────────
const render = (app: HTMLElement): void => {
    app.style.cssText = 'height:100%;width:100%;'

    injectStyles()

    // Mutable selected difficulty — shared between chips and play button
    let selectedDifficulty = getDefaultDifficulty()

    const scene = document.createElement('div')
    scene.className = 'scene'

    // 1. Date pill — temporal urgency ("this puzzle exists only today")
    const datePill = document.createElement('div')
    datePill.className = 'date-pill enter'
    datePill.style.animationDelay = '0ms'
    const dot = document.createElement('div')
    dot.className = 'date-dot'
    const dateText = document.createElement('span')
    dateText.textContent = getTodayLabel()
    datePill.appendChild(dot)
    datePill.appendChild(dateText)
    scene.appendChild(datePill)

    // 2. 9×9 grid — the main visual hook; clicking launches game
    const { root: gridEl, cells } = createDecorativeGrid()
    gridEl.addEventListener('click', (event: MouseEvent) => {
        launchGame(selectedDifficulty, event)
    })
    scene.appendChild(gridEl)

    // 3. Social proof — bandwagon effect
    scene.appendChild(createSocialProof())

    // 4. Title block
    const titleBlock = document.createElement('div')
    titleBlock.className = 'title-block enter'
    titleBlock.style.animationDelay = '160ms'

    const title = document.createElement('h1')
    title.className = 'title'
    title.textContent = 'Sudoku'

    const subtitle = document.createElement('p')
    subtitle.className = 'subtitle'
    subtitle.textContent = "A new puzzle every day. How fast can you solve it?"

    titleBlock.appendChild(title)
    titleBlock.appendChild(subtitle)
    scene.appendChild(titleBlock)

    // 5. Difficulty chips — pre-commit investment / agency
    scene.appendChild(
        createDifficultyChips(selectedDifficulty, (d) => {
            selectedDifficulty = d
        }),
    )

    // 6. CTA — specific, daily-habit framing
    scene.appendChild(createPlayButton(() => selectedDifficulty))

    app.appendChild(scene)

    // Start the animated solve demo
    startPlaybackLoop(cells)
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
const app = document.getElementById('app')
if (!app) throw new Error('App element not found')
render(app)
