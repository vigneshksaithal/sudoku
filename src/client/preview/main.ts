import { requestExpandedMode } from '@devvit/web/client'
import { DIFFICULTY_STORAGE_KEY, VALID_DIFFICULTIES } from '../lib/constants'
import type { Difficulty } from '../lib/types'
import '../app.css'

// ─── A/B Test Variant System ──────────────────────────────────────────────────
// 5 preview variants shown randomly. Each click is tracked server-side via
// POST /api/preview/track so we can measure which variant converts best.
// See docs/PREVIEW_AB_TEST.md for full documentation.

type Variant = 'A' | 'B' | 'C' | 'D' | 'E'

const VARIANTS: Variant[] = ['A', 'B', 'C', 'D', 'E']

const pickVariant = (): Variant => {
    const idx = Math.floor(Math.random() * VARIANTS.length)
    return VARIANTS[idx] ?? 'A'
}

// ─── Shared constants ─────────────────────────────────────────────────────────

const getDefaultDifficulty = (): Difficulty => {
    try {
        const stored = localStorage.getItem(DIFFICULTY_STORAGE_KEY)
        if (stored !== null && (VALID_DIFFICULTIES as readonly string[]).includes(stored)) {
            return stored as Difficulty
        }
    } catch { /* noop */ }
    return 'easy'
}

const getTodayShort = (): string => {
    const now = new Date()
    return now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
}

const getDailySolveCount = (): number => {
    const dayOfYear = Math.floor(
        (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
    )
    return 1800 + ((dayOfYear * 53) % 1601)
}

// ─── Track click ──────────────────────────────────────────────────────────────

const trackClick = (variant: Variant): void => {
    fetch('/api/preview/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant }),
    }).catch(() => { /* fire and forget */ })
}

// ─── Launch game ──────────────────────────────────────────────────────────────

const launchGame = (variant: Variant, difficulty: Difficulty, event: MouseEvent): void => {
    trackClick(variant)
    try { localStorage.setItem(DIFFICULTY_STORAGE_KEY, difficulty) } catch { /* noop */ }
    requestExpandedMode(event, 'game')
}

// ─── Base styles (shared across all variants) ─────────────────────────────────

const injectBaseStyles = (): void => {
    const style = document.createElement('style')
    style.textContent = `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }
        body { background: var(--bg); font-family: system-ui, -apple-system, sans-serif; }

        :root {
            --bg: #0f0f1a;
            --surface: rgba(255,255,255,0.04);
            --surface-2: rgba(255,255,255,0.08);
            --border: rgba(255,255,255,0.08);
            --text: #ffffff;
            --text-2: rgba(255,255,255,0.6);
            --text-3: rgba(255,255,255,0.35);
            --accent: #4a9eff;
            --accent-glow: rgba(74,158,255,0.3);
            --green: #34d399;
            --orange: #fb923c;
        }

        .scene {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            width: 100%;
            padding: 20px 16px;
            gap: 12px;
            overflow: hidden;
        }

        /* Shared button style */
        .cta {
            width: 100%;
            max-width: 280px;
            height: 52px;
            border-radius: 26px;
            border: none;
            background: linear-gradient(135deg, #4a9eff 0%, #2d6fd4 100%);
            color: #fff;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            box-shadow: 0 4px 16px rgba(74,158,255,0.35);
            transition: transform 0.1s ease, box-shadow 0.1s ease;
            -webkit-tap-highlight-color: transparent;
        }
        .cta:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(74,158,255,0.5); }
        .cta:active { transform: scale(0.97); }

        /* Mini grid shared */
        .mini-grid {
            display: grid;
            grid-template-columns: repeat(9, 1fr);
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid var(--border);
        }
        .mini-grid .c {
            aspect-ratio: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 600;
            color: var(--text-2);
            border-right: 1px solid var(--border);
            border-bottom: 1px solid var(--border);
        }
        .mini-grid .c:nth-child(9n) { border-right: none; }
        .mini-grid .c:nth-child(n+73) { border-bottom: none; }
        .mini-grid .c.bx { border-right-color: rgba(255,255,255,0.2); }
        .mini-grid .c.by { border-bottom-color: rgba(255,255,255,0.2); }
        .mini-grid .c.filled { color: var(--text); font-weight: 700; }
        .mini-grid .c.accent { color: var(--accent); font-weight: 700; }

        /* Pill */
        .pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: var(--surface-2);
            border-radius: 16px;
            padding: 5px 12px;
            font-size: 11px;
            font-weight: 600;
            color: var(--text-2);
            letter-spacing: 0.04em;
        }
        .pill .dot {
            width: 6px; height: 6px;
            border-radius: 50%;
            background: var(--accent);
        }

        /* Entry anim */
        @keyframes fadeUp {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .anim { opacity: 0; animation: fadeUp 0.35s ease-out forwards; }
    `
    document.head.appendChild(style)
}

// ─── Sample grid data ─────────────────────────────────────────────────────────

const GRID = [
    [5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],
    [8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],
    [0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9],
]

const buildGridHTML = (size: string): string => {
    let html = `<div class="mini-grid" style="width:${size};height:${size}">`
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const v = GRID[r]?.[c] ?? 0
            const bx = (c + 1) % 3 === 0 && c < 8 ? ' bx' : ''
            const by = (r + 1) % 3 === 0 && r < 8 ? ' by' : ''
            const fill = v > 0 ? ' filled' : ''
            html += `<div class="c${bx}${by}${fill}">${v > 0 ? v : ''}</div>`
        }
    }
    html += '</div>'
    return html
}

// ─── VARIANT A: Minimal — Title + subtitle + CTA only ────────────────────────
// Philosophy: Maximum whitespace. Intrigue. "Less is more."

const renderVariantA = (app: HTMLElement, variant: Variant): void => {
    const difficulty = getDefaultDifficulty()
    app.innerHTML = `
        <div class="scene">
            <div class="anim" style="animation-delay:0ms;text-align:center">
                <h1 style="font-size:36px;font-weight:900;color:var(--text);letter-spacing:-0.03em">Sudoku</h1>
                <p style="margin-top:6px;font-size:14px;color:var(--text-2)">A new puzzle awaits</p>
            </div>
            <div class="anim" style="animation-delay:100ms;margin-top:8px">
                <div class="pill"><span class="dot"></span>${getTodayShort()}</div>
            </div>
            <div class="anim" style="animation-delay:200ms;margin-top:16px">
                <button class="cta" id="cta-btn">Play Now</button>
            </div>
            <p class="anim" style="animation-delay:280ms;font-size:12px;color:var(--text-3);margin-top:8px">${getDailySolveCount().toLocaleString()} solved today</p>
        </div>
    `
    app.querySelector('#cta-btn')!.addEventListener('click', (e) => launchGame(variant, difficulty, e as MouseEvent))
}

// ─── VARIANT B: Grid hero — Large grid dominates, compact text below ──────────
// Philosophy: "Show don't tell." The grid IS the hook.

const renderVariantB = (app: HTMLElement, variant: Variant): void => {
    const difficulty = getDefaultDifficulty()
    app.innerHTML = `
        <div class="scene" style="gap:14px">
            <div class="anim" style="animation-delay:0ms">
                <div class="pill"><span class="dot"></span>${getTodayShort()}</div>
            </div>
            <div class="anim" style="animation-delay:60ms;cursor:pointer" id="grid-tap">
                ${buildGridHTML('min(56vw, 220px)')}
            </div>
            <div class="anim" style="animation-delay:140ms;text-align:center">
                <h1 style="font-size:24px;font-weight:800;color:var(--text)">Today's Sudoku</h1>
                <p style="margin-top:3px;font-size:13px;color:var(--text-2)">${getDailySolveCount().toLocaleString()} solves</p>
            </div>
            <div class="anim" style="animation-delay:200ms">
                <button class="cta" id="cta-btn">Play Today's Puzzle</button>
            </div>
        </div>
    `
    const launch = (e: MouseEvent) => launchGame(variant, difficulty, e)
    app.querySelector('#cta-btn')!.addEventListener('click', launch as EventListener)
    app.querySelector('#grid-tap')!.addEventListener('click', launch as EventListener)
}

// ─── VARIANT C: Competitive — Emphasizes leaderboard/speed ────────────────────
// Philosophy: Trigger competitive instinct. "Can you beat them?"

const renderVariantC = (app: HTMLElement, variant: Variant): void => {
    const difficulty = getDefaultDifficulty()
    const fakeTop3 = [
        { name: 'SpeedSolver42', time: '2:14' },
        { name: 'PuzzleMaster', time: '3:01' },
        { name: 'SudokuNinja', time: '3:28' },
    ]
    let leaderHTML = '<div style="width:100%;max-width:240px;display:flex;flex-direction:column;gap:6px">'
    fakeTop3.forEach((entry, i) => {
        const medal = ['🥇','🥈','🥉'][i] ?? ''
        leaderHTML += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface);border-radius:10px;border:1px solid var(--border)">
            <span style="font-size:13px;color:var(--text-2)">${medal} ${entry.name}</span>
            <span style="font-size:13px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums">${entry.time}</span>
        </div>`
    })
    leaderHTML += '</div>'

    app.innerHTML = `
        <div class="scene" style="gap:12px">
            <div class="anim" style="animation-delay:0ms;text-align:center">
                <h1 style="font-size:26px;font-weight:800;color:var(--text)">Today's Sudoku</h1>
                <p style="margin-top:4px;font-size:13px;color:var(--text-2)">Can you make the leaderboard?</p>
            </div>
            <div class="anim" style="animation-delay:80ms">
                ${leaderHTML}
            </div>
            <div class="anim" style="animation-delay:160ms">
                <button class="cta" id="cta-btn">Challenge Now</button>
            </div>
            <p class="anim" style="animation-delay:220ms;font-size:11px;color:var(--text-3)">${getDailySolveCount().toLocaleString()} attempts today</p>
        </div>
    `
    app.querySelector('#cta-btn')!.addEventListener('click', (e) => launchGame(variant, difficulty, e as MouseEvent))
}

// ─── VARIANT D: Choice — Difficulty selection is the hero ─────────────────────
// Philosophy: Give agency upfront. Choosing = investing.

const renderVariantD = (app: HTMLElement, variant: Variant): void => {
    let selected: Difficulty = getDefaultDifficulty()
    const difficulties: Difficulty[] = ['simple', 'easy', 'intermediate', 'expert']
    const labels: Record<Difficulty, string> = { simple: 'Simple', easy: 'Easy', intermediate: 'Medium', expert: 'Expert' }
    const descriptions: Record<Difficulty, string> = {
        simple: '~45 givens, relaxing',
        easy: '~36 givens, casual',
        intermediate: '~30 givens, challenging',
        expert: '~24 givens, hard',
    }

    let chipsHTML = '<div style="display:flex;flex-direction:column;gap:8px;width:100%;max-width:260px">'
    for (const d of difficulties) {
        const isActive = d === selected
        chipsHTML += `<button class="diff-chip${isActive ? ' active' : ''}" data-d="${d}" style="
            display:flex;align-items:center;justify-content:space-between;
            padding:12px 16px;border-radius:12px;border:1px solid ${isActive ? 'var(--accent)' : 'var(--border)'};
            background:${isActive ? 'rgba(74,158,255,0.1)' : 'var(--surface)'};
            cursor:pointer;transition:all 0.15s ease;
        ">
            <span style="font-size:14px;font-weight:600;color:${isActive ? 'var(--accent)' : 'var(--text)'}">${labels[d]}</span>
            <span style="font-size:11px;color:var(--text-3)">${descriptions[d]}</span>
        </button>`
    }
    chipsHTML += '</div>'

    app.innerHTML = `
        <div class="scene" style="gap:14px">
            <div class="anim" style="animation-delay:0ms;text-align:center">
                <h1 style="font-size:24px;font-weight:800;color:var(--text)">Pick your challenge</h1>
                <p style="margin-top:3px;font-size:13px;color:var(--text-2)">${getTodayShort()}</p>
            </div>
            <div class="anim" style="animation-delay:80ms">
                ${chipsHTML}
            </div>
            <div class="anim" style="animation-delay:180ms">
                <button class="cta" id="cta-btn">Start Puzzle</button>
            </div>
        </div>
    `

    // Wire chip selection
    app.querySelectorAll('.diff-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            selected = (chip as HTMLElement).dataset['d'] as Difficulty
            app.querySelectorAll('.diff-chip').forEach((c) => {
                const el = c as HTMLElement
                const isNowActive = el.dataset['d'] === selected
                el.style.borderColor = isNowActive ? 'var(--accent)' : 'var(--border)'
                el.style.background = isNowActive ? 'rgba(74,158,255,0.1)' : 'var(--surface)'
                el.querySelector('span')!.style.color = isNowActive ? 'var(--accent)' : 'var(--text)'
                el.classList.toggle('active', isNowActive)
            })
        })
    })

    app.querySelector('#cta-btn')!.addEventListener('click', (e) => launchGame(variant, selected, e as MouseEvent))
}

// ─── VARIANT E: Social proof — Stats + grid + urgency ─────────────────────────
// Philosophy: FOMO + social validation. "Everyone is playing."

const renderVariantE = (app: HTMLElement, variant: Variant): void => {
    const difficulty = getDefaultDifficulty()
    const solves = getDailySolveCount()
    const avgTime = '4:32'

    app.innerHTML = `
        <div class="scene" style="gap:12px">
            <div class="anim" style="animation-delay:0ms">
                <div class="pill"><span class="dot"></span>LIVE</div>
            </div>
            <div class="anim" style="animation-delay:60ms;cursor:pointer" id="grid-tap">
                ${buildGridHTML('min(48vw, 190px)')}
            </div>
            <div class="anim" style="animation-delay:120ms;display:flex;gap:16px;align-items:center">
                <div style="text-align:center">
                    <div style="font-size:20px;font-weight:800;color:var(--text)">${solves.toLocaleString()}</div>
                    <div style="font-size:10px;color:var(--text-3);margin-top:1px">SOLVES</div>
                </div>
                <div style="width:1px;height:28px;background:var(--border)"></div>
                <div style="text-align:center">
                    <div style="font-size:20px;font-weight:800;color:var(--accent)">${avgTime}</div>
                    <div style="font-size:10px;color:var(--text-3);margin-top:1px">AVG TIME</div>
                </div>
            </div>
            <div class="anim" style="animation-delay:180ms;text-align:center">
                <h1 style="font-size:22px;font-weight:800;color:var(--text)">Today's Sudoku</h1>
                <p style="margin-top:2px;font-size:12px;color:var(--text-2)">How fast can you solve it?</p>
            </div>
            <div class="anim" style="animation-delay:240ms">
                <button class="cta" id="cta-btn">Play Now</button>
            </div>
        </div>
    `
    const launch = (e: MouseEvent) => launchGame(variant, difficulty, e)
    app.querySelector('#cta-btn')!.addEventListener('click', launch as EventListener)
    app.querySelector('#grid-tap')!.addEventListener('click', launch as EventListener)
}

// ─── Render ───────────────────────────────────────────────────────────────────

const render = (app: HTMLElement): void => {
    app.style.cssText = 'height:100%;width:100%;'
    injectBaseStyles()

    const variant = pickVariant()

    switch (variant) {
        case 'A': renderVariantA(app, variant); break
        case 'B': renderVariantB(app, variant); break
        case 'C': renderVariantC(app, variant); break
        case 'D': renderVariantD(app, variant); break
        case 'E': renderVariantE(app, variant); break
    }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
const app = document.getElementById('app')
if (!app) throw new Error('App element not found')
render(app)
