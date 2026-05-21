import { requestExpandedMode } from '@devvit/web/client'
import { DIFFICULTY_STORAGE_KEY, VALID_DIFFICULTIES } from '../lib/constants'
import type { Difficulty } from '../lib/types'
import '../app.css'

// ─── 9×9 sample grid — matches the screenshot reference exactly ───────────────
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

const SOLVE_SEQUENCE: ReadonlyArray<{ row: number; col: number; value: number }> = [
    { row: 0, col: 2, value: 4 },
    { row: 0, col: 3, value: 6 },
    { row: 1, col: 1, value: 7 },
    { row: 2, col: 0, value: 1 },
    { row: 2, col: 6, value: 7 },
    { row: 3, col: 1, value: 5 },
    { row: 4, col: 4, value: 5 },
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
    } catch { /* noop */ }
    return 'intermediate'
}

const getTodayLabel = (): string => {
    const now = new Date()
    return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()
}

const injectStyles = (): void => {
    const style = document.createElement('style')
    style.textContent = `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
            --bg: #1a1a2e;
            --bg-grid: #1e1e32;
            --border-thin: rgba(255,255,255,0.08);
            --border-box: rgba(255,255,255,0.22);
            --label: #ffffff;
            --label-2: rgba(255,255,255,0.55);
            --label-3: rgba(255,255,255,0.30);
            --accent: #4a9eff;
            --accent-glow: rgba(74,158,255,0.25);
            --cell-given: rgba(255,255,255,0.92);
            --cell-placed: #4a9eff;
            --cell-selected: rgba(74,158,255,0.22);
            --chip-bg: rgba(255,255,255,0.08);
            --chip-active-bg: #4a9eff;
            --chip-active-text: #fff;
            --btn-gradient: linear-gradient(135deg, #4a9eff 0%, #2d7be5 100%);
        }

        html, body { height: 100%; background: var(--bg); overflow: hidden; }

        .scene {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            height: 100%;
            width: 100%;
            padding: 16px 16px 20px;
            background: var(--bg);
        }

        /* ── Date pill ── */
        .date-pill {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: 20px;
            padding: 6px 14px;
            font-size: 11px;
            font-weight: 700;
            font-family: system-ui, -apple-system, sans-serif;
            color: var(--label-2);
            letter-spacing: 0.06em;
        }
        .date-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--accent);
            box-shadow: 0 0 6px var(--accent-glow);
            animation: dot-pulse 2s ease-in-out infinite;
            flex-shrink: 0;
        }
        @keyframes dot-pulse {
            0%, 100% { opacity: 1; box-shadow: 0 0 4px var(--accent-glow); }
            50%      { opacity: 0.5; box-shadow: 0 0 10px var(--accent-glow); }
        }

        /* ── Grid ── */
        .grid-wrapper {
            position: relative;
            cursor: pointer;
        }
        .grid-wrapper:active { transform: scale(0.99); }
        .grid-card {
            background: var(--bg-grid);
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.06);
            padding: 2px;
            transition: transform 0.12s ease;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(9, 1fr);
            width: min(72vw, 280px);
            height: min(72vw, 280px);
            border-radius: 8px;
            overflow: hidden;
        }
        .cell {
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
            font-size: clamp(11px, 3.2vw, 14px);
            font-weight: 600;
            color: var(--cell-given);
            transition: background 0.15s ease;
            position: relative;
        }
        .cell.selected { background: var(--cell-selected); }
        .cell .placed { color: var(--cell-placed); font-weight: 700; }
        .cell.empty-cell { color: transparent; }

        /* ── Social proof ── */
        .social-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 500;
            font-family: system-ui, -apple-system, sans-serif;
            color: var(--label-2);
        }
        .social-avatars { display: flex; }
        .avatar {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 2px solid var(--bg);
            margin-left: -6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 700;
            color: #fff;
        }
        .avatar:first-child { margin-left: 0; }
        .av-r { background: #ff4500; }
        .av-u { background: #ffb800; }
        .av-k { background: #30d158; }
        .av-j { background: #af52de; }

        /* ── Title ── */
        .title-block { text-align: center; }
        .title {
            font-size: 32px;
            font-weight: 900;
            letter-spacing: -0.03em;
            color: var(--label);
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1;
        }
        .subtitle {
            margin-top: 5px;
            font-size: 14px;
            font-weight: 400;
            color: var(--label-2);
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.3;
        }

        /* ── Difficulty chips ── */
        .chips-row {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .chip {
            padding: 7px 14px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            font-family: system-ui, -apple-system, sans-serif;
            cursor: pointer;
            border: none;
            background: var(--chip-bg);
            color: var(--label-2);
            transition: all 0.15s ease;
            -webkit-tap-highlight-color: transparent;
            text-transform: capitalize;
        }
        .chip:active { transform: scale(0.93); }
        .chip.active {
            background: var(--chip-active-bg);
            color: var(--chip-active-text);
            box-shadow: 0 2px 12px rgba(74,158,255,0.35);
        }

        /* ── Play Button ── */
        .play-btn-wrap {
            width: 100%;
            max-width: 320px;
            padding: 0 8px;
        }
        .play-btn {
            position: relative;
            overflow: hidden;
            width: 100%;
            height: 58px;
            border-radius: 32px;
            border: none;
            background: var(--btn-gradient);
            color: #fff;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 17px;
            font-weight: 800;
            letter-spacing: 0.01em;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            box-shadow:
                0 4px 16px rgba(74,158,255,0.40),
                0 2px 4px rgba(0,0,0,0.20),
                inset 0 1px 0 rgba(255,255,255,0.15);
            -webkit-tap-highlight-color: transparent;
            transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .play-btn:hover {
            transform: translateY(-2px) scale(1.01);
            box-shadow:
                0 8px 24px rgba(74,158,255,0.55),
                0 3px 6px rgba(0,0,0,0.20),
                inset 0 1px 0 rgba(255,255,255,0.20);
        }
        .play-btn:active {
            transform: scale(0.97) translateY(1px);
            box-shadow:
                0 2px 8px rgba(74,158,255,0.30),
                0 1px 2px rgba(0,0,0,0.15),
                inset 0 1px 0 rgba(255,255,255,0.10);
        }
        /* Shimmer sweep */
        .play-btn::before {
            content: '';
            position: absolute;
            top: 0; left: -100%;
            width: 50%; height: 100%;
            background: linear-gradient(
                105deg,
                transparent 30%,
                rgba(255,255,255,0.20) 50%,
                transparent 70%
            );
            animation: shimmer 4s ease-in-out infinite;
            animation-delay: 1.5s;
            pointer-events: none;
        }
        @keyframes shimmer {
            0%  { left: -100%; }
            50% { left: 150%; }
            100%{ left: 150%; }
        }
        .play-icon {
            font-size: 15px;
            display: inline-block;
        }

        /* ── Entry animations ── */
        @keyframes rise {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .enter {
            opacity: 0;
            animation: rise 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        @keyframes appear {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        .num { opacity: 0; animation: appear 0.25s ease-out forwards; }
        @keyframes pop-in {
            0%   { opacity: 0; transform: scale(0.4); }
            65%  { opacity: 1; transform: scale(1.12); }
            100% { opacity: 1; transform: scale(1); }
        }
        .pop { animation: pop-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
    `
    document.head.appendChild(style)
}

type CellRef = { element: HTMLDivElement; row: number; col: number }

const createGrid = (): { root: HTMLElement; cells: CellRef[] } => {
    const wrapper = document.createElement('div')
    wrapper.className = 'grid-wrapper enter'
    wrapper.style.animationDelay = '60ms'

    const card = document.createElement('div')
    card.className = 'grid-card'

    const grid = document.createElement('div')
    grid.className = 'grid'

    const cells: CellRef[] = []

    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const cell = document.createElement('div')
            cell.className = 'cell'

            // Borders: thin inner, thicker at box boundaries
            if (col < GRID_SIZE - 1) {
                cell.style.borderRight = `1px solid ${(col + 1) % BOX_SIZE === 0 ? 'var(--border-box)' : 'var(--border-thin)'}`
            }
            if (row < GRID_SIZE - 1) {
                cell.style.borderBottom = `1px solid ${(row + 1) % BOX_SIZE === 0 ? 'var(--border-box)' : 'var(--border-thin)'}`
            }

            const value = SAMPLE_GRID[row]?.[col] ?? 0
            if (value > 0) {
                const num = document.createElement('span')
                num.className = 'num'
                num.textContent = String(value)
                num.style.animationDelay = `${60 + (row * GRID_SIZE + col) * 6}ms`
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
    const STEP_INTERVAL = 1300
    const INITIAL_DELAY = 1200

    const step = (): void => {
        if (prevSelected) prevSelected.element.classList.remove('selected')

        const move = SOLVE_SEQUENCE[stepIndex % SOLVE_SEQUENCE.length]
        if (!move) return

        // Reset when looping
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
        }, 500)
    }

    setTimeout(() => { step(); setInterval(step, STEP_INTERVAL) }, INITIAL_DELAY)
}

const launchGame = (difficulty: Difficulty, event: MouseEvent): void => {
    try { localStorage.setItem(DIFFICULTY_STORAGE_KEY, difficulty) } catch { /* noop */ }
    requestExpandedMode(event, 'game')
}

const render = (app: HTMLElement): void => {
    app.style.cssText = 'height:100%;width:100%;'
    injectStyles()

    let selectedDifficulty = getDefaultDifficulty()
    const scene = document.createElement('div')
    scene.className = 'scene'

    // ── 1. Date pill ──
    const datePill = document.createElement('div')
    datePill.className = 'date-pill enter'
    datePill.style.animationDelay = '0ms'
    const dot = document.createElement('div')
    dot.className = 'date-dot'
    datePill.appendChild(dot)
    datePill.appendChild(document.createTextNode(getTodayLabel()))
    scene.appendChild(datePill)

    // ── 2. Grid — the dominant visual ──
    const { root: gridEl, cells } = createGrid()
    gridEl.addEventListener('click', (e: MouseEvent) => launchGame(selectedDifficulty, e))
    scene.appendChild(gridEl)

    // ── 3. Social proof ──
    const socialRow = document.createElement('div')
    socialRow.className = 'social-row enter'
    socialRow.style.animationDelay = '180ms'

    const avatars = document.createElement('div')
    avatars.className = 'social-avatars'
    const avData: Array<[string, string]> = [['R', 'av-r'], ['u', 'av-u'], ['K', 'av-k'], ['J', 'av-j']]
    for (const [letter, cls] of avData) {
        const av = document.createElement('div')
        av.className = `avatar ${cls}`
        av.textContent = letter
        avatars.appendChild(av)
    }
    socialRow.appendChild(avatars)

    const solveText = document.createElement('span')
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000)
    const solveCount = 1800 + ((dayOfYear * 53) % 1601)
    solveText.textContent = `${solveCount.toLocaleString()} solves today`
    socialRow.appendChild(solveText)
    scene.appendChild(socialRow)

    // ── 4. Title ──
    const titleBlock = document.createElement('div')
    titleBlock.className = 'title-block enter'
    titleBlock.style.animationDelay = '120ms'
    const title = document.createElement('h1')
    title.className = 'title'
    title.textContent = 'Sudoku'
    const subtitle = document.createElement('p')
    subtitle.className = 'subtitle'
    subtitle.textContent = 'A new puzzle every day. How fast can you solve it?'
    titleBlock.appendChild(title)
    titleBlock.appendChild(subtitle)
    scene.appendChild(titleBlock)

    // ── 5. Difficulty chips ──
    const chipsRow = document.createElement('div')
    chipsRow.className = 'chips-row enter'
    chipsRow.style.animationDelay = '220ms'
    const difficulties: Difficulty[] = ['simple', 'easy', 'intermediate', 'expert']
    for (const d of difficulties) {
        const chip = document.createElement('button')
        chip.className = `chip${d === selectedDifficulty ? ' active' : ''}`
        chip.textContent = d
        chip.addEventListener('click', () => {
            chipsRow.querySelectorAll('.chip').forEach(c => c.classList.remove('active'))
            chip.classList.add('active')
            selectedDifficulty = d
        })
        chipsRow.appendChild(chip)
    }
    scene.appendChild(chipsRow)

    // ── 6. CTA Button ──
    const btnWrap = document.createElement('div')
    btnWrap.className = 'play-btn-wrap enter'
    btnWrap.style.animationDelay = '280ms'
    const btn = document.createElement('button')
    btn.className = 'play-btn'
    btn.setAttribute('aria-label', "Play today's Sudoku puzzle")
    const icon = document.createElement('span')
    icon.className = 'play-icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.textContent = '▶'
    const label = document.createElement('span')
    label.textContent = "Play Today's Puzzle"
    btn.appendChild(icon)
    btn.appendChild(label)
    btn.addEventListener('click', (e: MouseEvent) => launchGame(selectedDifficulty, e))
    btnWrap.appendChild(btn)
    scene.appendChild(btnWrap)

    app.appendChild(scene)
    startPlaybackLoop(cells)
}

const app = document.getElementById('app')
if (!app) throw new Error('App element not found')
render(app)
