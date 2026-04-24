import { requestExpandedMode } from '@devvit/web/client'
import { DIFFICULTY_STORAGE_KEY, VALID_DIFFICULTIES } from '../lib/constants'
import type { Difficulty } from '../lib/types'
import '../app.css'

const SAMPLE_GRID = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9],
] as const

// Correct answers for empty cells — simulates a solve sequence
const SOLVE_SEQUENCE: ReadonlyArray<{ row: number; col: number; value: number }> = [
    { row: 0, col: 3, value: 6 },
    { row: 0, col: 5, value: 8 },
    { row: 1, col: 1, value: 7 },
    { row: 1, col: 2, value: 2 },
    { row: 2, col: 0, value: 1 },
    { row: 0, col: 4, value: 4 },
    { row: 2, col: 3, value: 3 },
    { row: 2, col: 7, value: 4 },
]

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
    simple: 'Simple',
    easy: 'Easy',
    intermediate: 'Intermediate',
    expert: 'Expert',
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
            --accent-bg:     rgba(0,122,255,0.1);
            --accent-soft:   rgba(0,122,255,0.08);
            --cell-given:    #1c1c1e;
            --cell-placed:   #007aff;
            --cell-selected: rgba(0,122,255,0.12);
            --shadow-card:   0 2px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06);
            --shadow-btn:    0 1px 3px rgba(0,0,0,0.08);
            --radius-card:   14px;
            --radius-btn:    12px;
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
                --accent-bg:     rgba(10,132,255,0.15);
                --accent-soft:   rgba(10,132,255,0.1);
                --cell-given:    rgba(235,235,245,0.9);
                --cell-placed:   #0a84ff;
                --cell-selected: rgba(10,132,255,0.18);
                --shadow-card:   0 2px 16px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.3);
                --shadow-btn:    0 1px 4px rgba(0,0,0,0.3);
            }
        }

        html, body { height: 100%; background: var(--bg); }

        .scene {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 24px;
            height: 100%;
            width: 100%;
            padding: 28px 20px;
            background: var(--bg);
        }

        .grid-card {
            background: var(--bg-elevated);
            border-radius: var(--radius-card);
            box-shadow: var(--shadow-card);
            padding: 3px;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(9, 1fr);
            width: 198px;
            height: 198px;
            border-radius: 11px;
            overflow: hidden;
        }
        .cell {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            font-family: system-ui, -apple-system, sans-serif;
            color: var(--cell-given);
            transition: background 0.2s ease;
            position: relative;
        }
        .cell.selected {
            background: var(--cell-selected);
        }
        .cell .placed {
            color: var(--cell-placed);
            font-weight: 500;
        }

        .title-block { text-align: center; }
        .title {
            font-size: 34px;
            font-weight: 700;
            letter-spacing: -0.025em;
            color: var(--label);
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.05;
        }
        .subtitle {
            margin-top: 5px;
            font-size: 15px;
            font-weight: 400;
            color: var(--label-2);
            font-family: system-ui, -apple-system, sans-serif;
        }

        .btn-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            width: 100%;
            max-width: 264px;
        }
        .diff-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 48px;
            border-radius: var(--radius-btn);
            border: none;
            background: var(--bg-elevated);
            box-shadow: var(--shadow-btn);
            cursor: pointer;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 15px;
            font-weight: 500;
            color: var(--accent);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            transition: opacity 0.15s ease, transform 0.12s ease, background 0.15s ease;
            -webkit-tap-highlight-color: transparent;
        }
        .diff-btn:hover { background: var(--accent-bg); }
        .diff-btn:active { opacity: 0.7; transform: scale(0.97); }

        /* Entry — one pass */
        @keyframes rise {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .enter {
            opacity: 0;
            animation: rise 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }

        /* Grid numbers initial stagger */
        @keyframes appear {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        .num {
            opacity: 0;
            animation: appear 0.25s ease-out forwards;
        }

        /* Placed number pop */
        @keyframes pop-in {
            0%   { opacity: 0; transform: scale(0.5); }
            60%  { opacity: 1; transform: scale(1.08); }
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
    const card = document.createElement('div')
    card.className = 'grid-card enter'
    card.style.animationDelay = '0ms'

    const grid = document.createElement('div')
    grid.className = 'grid'

    const cells: CellRef[] = []

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = document.createElement('div')
            cell.className = 'cell'

            const borderRight = col < 8
                ? `1px solid ${(col + 1) % 3 === 0 ? 'var(--separator-box)' : 'var(--separator)'}`
                : 'none'
            const borderBottom = row < 8
                ? `1px solid ${(row + 1) % 3 === 0 ? 'var(--separator-box)' : 'var(--separator)'}`
                : 'none'

            cell.style.borderRight = borderRight
            cell.style.borderBottom = borderBottom

            const value = SAMPLE_GRID[row]?.[col] ?? 0
            if (value > 0) {
                const num = document.createElement('span')
                num.className = 'num'
                num.textContent = String(value)
                num.style.animationDelay = `${(row * 9 + col) * 12}ms`
                cell.appendChild(num)
            }

            cells.push({ element: cell, row, col })
            grid.appendChild(cell)
        }
    }

    card.appendChild(grid)
    return { root: card, cells }
}

const getCell = (cells: ReadonlyArray<CellRef>, row: number, col: number): CellRef | undefined =>
    cells.find((c) => c.row === row && c.col === col)

// Simulates gameplay: select cell → place number → pause → next
const startPlaybackLoop = (cells: ReadonlyArray<CellRef>): void => {
    let stepIndex = 0
    let prevSelected: CellRef | undefined
    const STEP_INTERVAL = 1800
    const INITIAL_DELAY = 1200

    const step = (): void => {
        // Clear previous selection highlight
        if (prevSelected) {
            prevSelected.element.classList.remove('selected')
        }

        const move = SOLVE_SEQUENCE[stepIndex % SOLVE_SEQUENCE.length]
        if (!move) return

        // If we're looping back to start, clear all placed numbers
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

        // Highlight the cell
        cellRef.element.classList.add('selected')
        prevSelected = cellRef

        // After a short beat, place the number
        setTimeout(() => {
            // Remove any existing placed number in this cell
            const existing = cellRef.element.querySelector('.placed')
            if (existing) existing.remove()

            const span = document.createElement('span')
            span.className = 'placed pop'
            span.textContent = String(move.value)
            cellRef.element.appendChild(span)

            stepIndex++
        }, 600)
    }

    setTimeout(() => {
        step()
        setInterval(step, STEP_INTERVAL)
    }, INITIAL_DELAY)
}

const createButton = (difficulty: Difficulty): HTMLButtonElement => {
    const btn = document.createElement('button')
    btn.className = 'diff-btn'
    btn.textContent = DIFFICULTY_LABELS[difficulty]

    btn.addEventListener('click', (event: MouseEvent) => {
        try {
            localStorage.setItem(DIFFICULTY_STORAGE_KEY, difficulty)
        } catch {
            // localStorage unavailable — continue
        }
        requestExpandedMode(event, 'game')
    })

    return btn
}

const render = (app: HTMLElement): void => {
    app.style.cssText = 'height:100%;width:100%;'

    injectStyles()

    const scene = document.createElement('div')
    scene.className = 'scene'

    const { root: gridEl, cells } = createDecorativeGrid()
    scene.appendChild(gridEl)

    const titleBlock = document.createElement('div')
    titleBlock.className = 'title-block enter'
    titleBlock.style.animationDelay = '120ms'

    const title = document.createElement('h1')
    title.className = 'title'
    title.textContent = 'Sudoku'

    const subtitle = document.createElement('p')
    subtitle.className = 'subtitle'
    subtitle.textContent = 'Choose your challenge'

    titleBlock.appendChild(title)
    titleBlock.appendChild(subtitle)
    scene.appendChild(titleBlock)

    const btnGrid = document.createElement('div')
    btnGrid.className = 'btn-grid enter'
    btnGrid.style.animationDelay = '220ms'

    for (const difficulty of VALID_DIFFICULTIES) {
        btnGrid.appendChild(createButton(difficulty))
    }

    scene.appendChild(btnGrid)
    app.appendChild(scene)

    // Start the gameplay simulation after the entrance animations settle
    startPlaybackLoop(cells)
}

const app = document.getElementById('app')
if (!app) throw new Error('App element not found')
render(app)
