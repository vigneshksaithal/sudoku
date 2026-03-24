import { requestExpandedMode } from '@devvit/web/client'
import { DIFFICULTY_STORAGE_KEY, VALID_DIFFICULTIES } from '../lib/constants'
import type { Difficulty } from '../lib/types'
import '../app.css'

// Sample puzzle for decorative grid — partial fill looks like a real game in progress
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

const injectStyles = (): void => {
    const style = document.createElement('style')
    style.textContent = `
        /* Background: slow, subtle blue drift */
        @keyframes bg-shift {
            0%   { background-position: 0% 50%; }
            50%  { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        .animated-bg {
            background: linear-gradient(135deg, #0f172a, #1e3a8a, #0f172a, #1e3a8a, #0f172a);
            background-size: 400% 400%;
            animation: bg-shift 10s ease infinite;
        }

        /* Outer span: gentle float — owns translateY */
        @keyframes letter-float {
            0%, 100% { transform: translateY(0); }
            50%       { transform: translateY(-5px); }
        }
        .letter-outer {
            display: inline-block;
            animation: letter-float 3s ease-in-out infinite;
        }

        /* Inner span: drops in once — owns opacity + scale */
        @keyframes letter-drop {
            0%   { opacity: 0; transform: scale(0.7); }
            70%  { opacity: 1; transform: scale(1.08); }
            100% { opacity: 1; transform: scale(1); }
        }
        .letter-inner {
            display: inline-block;
            opacity: 0;
            animation: letter-drop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            background: linear-gradient(135deg, #93c5fd, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        /* Grid: soft glow breathe */
        @keyframes grid-glow {
            0%, 100% { box-shadow: 0 0 8px 0px rgba(59,130,246,0.2), 0 4px 20px rgba(0,0,0,0.4); }
            50%       { box-shadow: 0 0 20px 4px rgba(59,130,246,0.4), 0 4px 28px rgba(0,0,0,0.5); }
        }
        .grid-glow {
            animation: grid-glow 4s ease-in-out infinite;
        }

        /* Subtitle + buttons: slide up into view */
        @keyframes fade-up {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up {
            opacity: 0;
            animation: fade-up 0.5s ease-out forwards;
        }
    `
    document.head.appendChild(style)
}

const createDecorativeGrid = (): HTMLElement => {
    const wrapper = document.createElement('div')
    wrapper.className = 'flex items-center justify-center'

    const grid = document.createElement('div')
    grid.className = 'grid-glow'
    grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(9, 1fr);
        width: 162px;
        height: 162px;
        border: 2px solid rgba(59,130,246,0.4);
        border-radius: 6px;
        overflow: hidden;
        background: rgba(255,255,255,0.05);
    `

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = document.createElement('div')
            const value = SAMPLE_GRID[row]?.[col] ?? 0

            const borderRight = (col + 1) % 3 === 0 && col < 8
                ? '2px solid rgba(96,165,250,0.5)'
                : '1px solid rgba(148,163,184,0.12)'
            const borderBottom = (row + 1) % 3 === 0 && row < 8
                ? '2px solid rgba(96,165,250,0.5)'
                : '1px solid rgba(148,163,184,0.12)'

            cell.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: 700;
                border-right: ${borderRight};
                border-bottom: ${borderBottom};
                color: ${value > 0 ? 'rgba(147,197,253,1)' : 'transparent'};
                background: ${value > 0 ? 'rgba(59,130,246,0.12)' : 'transparent'};
            `
            cell.textContent = value > 0 ? String(value) : '·'
            grid.appendChild(cell)
        }
    }

    wrapper.appendChild(grid)
    return wrapper
}

const createButton = (difficulty: Difficulty): HTMLButtonElement => {
    const btn = document.createElement('button')
    btn.textContent = difficulty
    btn.className = 'min-h-11 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white capitalize transition-all hover:bg-blue-500 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400'
    btn.addEventListener('click', (event: MouseEvent) => {
        try {
            localStorage.setItem(DIFFICULTY_STORAGE_KEY, difficulty)
        } catch {
            // localStorage unavailable — continue to expanded game
        }
        requestExpandedMode(event, 'game')
    })
    return btn
}

const render = (app: HTMLElement): void => {
    app.style.cssText = 'height: 100%; width: 100%;'
    app.className = 'flex h-full w-full items-center justify-center overflow-hidden'

    injectStyles()

    const bg = document.createElement('div')
    bg.className = 'animated-bg flex h-full w-full flex-col items-center justify-center gap-4 px-6 py-6'

    bg.appendChild(createDecorativeGrid())

    const titleBlock = document.createElement('div')
    titleBlock.className = 'text-center'

    const title = document.createElement('h1')
    title.className = 'text-4xl font-bold tracking-tight'

    // Outer span: floats. Inner span: drops in. Separate transforms = no conflict.
    Array.from('Sudoku').forEach((char, i) => {
        const outer = document.createElement('span')
        outer.className = 'letter-outer'
        outer.style.animationDelay = `${i * 120}ms`

        const inner = document.createElement('span')
        inner.textContent = char
        inner.className = 'letter-inner'
        inner.style.animationDelay = `${i * 100}ms`

        outer.appendChild(inner)
        title.appendChild(outer)
    })

    const subtitle = document.createElement('p')
    subtitle.textContent = 'Choose your challenge'
    subtitle.className = 'fade-up mt-1 text-sm text-slate-400'
    subtitle.style.animationDelay = '700ms'

    titleBlock.appendChild(title)
    titleBlock.appendChild(subtitle)
    bg.appendChild(titleBlock)

    const buttonGrid = document.createElement('div')
    buttonGrid.className = 'fade-up grid w-full max-w-xs grid-cols-2 gap-2'
    buttonGrid.style.animationDelay = '900ms'

    for (const difficulty of VALID_DIFFICULTIES) {
        buttonGrid.appendChild(createButton(difficulty))
    }

    bg.appendChild(buttonGrid)
    app.appendChild(bg)
}

const app = document.getElementById('app')
if (!app) throw new Error('App element not found')
render(app)
