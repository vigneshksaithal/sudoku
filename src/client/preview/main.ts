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
        body { background: #0f0f1a; font-family: system-ui, -apple-system, sans-serif; }

        :root {
            --bg: #0f0f1a;
            --surface: rgba(255,255,255,0.05);
            --border: rgba(255,255,255,0.10);
            --border-box: rgba(255,255,255,0.22);
            --text: #f0f0f0;
            --text-2: rgba(240,240,240,0.55);
            --text-3: rgba(240,240,240,0.30);
            --accent: #3b82f6;
            --accent-light: #60a5fa;
        }

        /* ── Scene container — same for all variants ── */
        .scene {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            padding: 24px 20px;
            gap: 0;
            overflow: hidden;
        }

        /* ── CTA button — FIXED width, never a blob ── */
        .cta {
            display: block;
            width: 100%;
            height: 50px;
            border-radius: 12px;
            border: none;
            background: var(--accent);
            color: #fff;
            font-size: 15px;
            font-weight: 600;
            letter-spacing: 0.01em;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
            transition: opacity 0.12s ease, transform 0.1s ease;
        }
        .cta:hover { opacity: 0.88; }
        .cta:active { transform: scale(0.98); opacity: 0.80; }

        /* ── CTA wrapper — controls width ── */
        .cta-wrap {
            width: 100%;
            max-width: 300px;
        }

        /* ── Date pill ── */
        .pill {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            background: rgba(255,255,255,0.07);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 5px 13px;
            font-size: 11px;
            font-weight: 600;
            color: var(--text-2);
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }
        .pill-dot {
            width: 6px; height: 6px;
            border-radius: 50%;
            background: var(--accent-light);
            flex-shrink: 0;
        }

        /* ── 9×9 grid ── */
        .grid9 {
            display: grid;
            grid-template-columns: repeat(9, 1fr);
            border-radius: 8px;
            overflow: hidden;
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--border);
        }
        .grid9 .gc {
            aspect-ratio: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 600;
            color: var(--text-2);
        }
        .grid9 .gc.given { color: var(--text); font-weight: 700; }
        .grid9 .gc.hi { background: rgba(59,130,246,0.18); color: var(--accent-light); font-weight: 700; }
        .grid9 .gc.bdr { border-right: 1px solid var(--border-box); }
        .grid9 .gc.bdb { border-bottom: 1px solid var(--border-box); }
        .grid9 .gc.tbdr { border-right: 1px solid var(--border); }
        .grid9 .gc.tbdb { border-bottom: 1px solid var(--border); }

        /* ── Leaderboard row ── */
        .lb-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: rgba(255,255,255,0.04);
            border-radius: 10px;
            border: 1px solid var(--border);
        }

        /* ── Difficulty chip ── */
        .dchip {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 11px 14px;
            border-radius: 10px;
            border: 1px solid var(--border);
            background: rgba(255,255,255,0.04);
            cursor: pointer;
            transition: border-color 0.15s, background 0.15s;
            -webkit-tap-highlight-color: transparent;
        }
        .dchip.sel {
            border-color: var(--accent);
            background: rgba(59,130,246,0.10);
        }

        /* ── Entry animations ── */
        @keyframes fadeUp {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .a0 { opacity:0; animation: fadeUp 0.38s ease-out 0ms   forwards; }
        .a1 { opacity:0; animation: fadeUp 0.38s ease-out 80ms  forwards; }
        .a2 { opacity:0; animation: fadeUp 0.38s ease-out 160ms forwards; }
        .a3 { opacity:0; animation: fadeUp 0.38s ease-out 240ms forwards; }
        .a4 { opacity:0; animation: fadeUp 0.38s ease-out 320ms forwards; }

        /* ── Spacers ── */
        .sp8  { height: 8px;  flex-shrink: 0; }
        .sp12 { height: 12px; flex-shrink: 0; }
        .sp16 { height: 16px; flex-shrink: 0; }
        .sp20 { height: 20px; flex-shrink: 0; }
        .sp28 { height: 28px; flex-shrink: 0; }
    `
    document.head.appendChild(style)
}

// ─── Sample grid data + builder ───────────────────────────────────────────────

const GRID = [
    [5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],
    [8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],
    [0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9],
]

// Cells highlighted as "currently selected/filled"
const HIGHLIGHTED = new Set([[0,2],[1,1],[4,4]].map(([r,c]) => `${r},${c}`))

const buildGrid = (sizePx: number): string => {
    let html = `<div class="grid9" style="width:${sizePx}px;height:${sizePx}px">`
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const v = GRID[r]?.[c] ?? 0
            // Box boundary borders (thicker)
            const bdr = (c + 1) % 3 === 0 && c < 8 ? ' bdr' : (c < 8 ? ' tbdr' : '')
            const bdb = (r + 1) % 3 === 0 && r < 8 ? ' bdb' : (r < 8 ? ' tbdb' : '')
            const isHi = HIGHLIGHTED.has(`${r},${c}`)
            const cls = isHi ? ' hi' : (v > 0 ? ' given' : '')
            html += `<div class="gc${bdr}${bdb}${cls}">${v > 0 || isHi ? (isHi && v === 0 ? '4' : v) : ''}</div>`
        }
    }
    html += '</div>'
    return html
}

// ─── VARIANT A: Minimal ───────────────────────────────────────────────────────
// Clean, confident. Big title, one clear CTA, date context, social proof.

const renderVariantA = (app: HTMLElement, variant: Variant): void => {
    const difficulty = getDefaultDifficulty()
    const count = getDailySolveCount()
    app.innerHTML = `
        <div class="scene">
            <div class="a0" style="text-align:center">
                <div class="pill"><span class="pill-dot"></span>${getTodayShort()}</div>
            </div>
            <div class="sp20"></div>
            <div class="a1" style="text-align:center">
                <h1 style="font-size:38px;font-weight:800;color:var(--text);letter-spacing:-0.02em;line-height:1">Sudoku</h1>
                <p style="margin-top:8px;font-size:14px;color:var(--text-2);line-height:1.4">A fresh puzzle every day.<br>How fast can you solve it?</p>
            </div>
            <div class="sp28"></div>
            <div class="a2 cta-wrap">
                <button class="cta" id="cta-btn">Play Today's Puzzle</button>
            </div>
            <div class="sp12"></div>
            <p class="a3" style="font-size:12px;color:var(--text-3)">${count.toLocaleString()} solves today</p>
        </div>
    `
    app.querySelector('#cta-btn')!.addEventListener('click', (e) => launchGame(variant, difficulty, e as MouseEvent))
}

// ─── VARIANT B: Grid hero ─────────────────────────────────────────────────────
// The puzzle itself is the hook. Show it prominently.

const renderVariantB = (app: HTMLElement, variant: Variant): void => {
    const difficulty = getDefaultDifficulty()
    const count = getDailySolveCount()
    app.innerHTML = `
        <div class="scene">
            <div class="a0" style="text-align:center">
                <div class="pill"><span class="pill-dot"></span>${getTodayShort()}</div>
            </div>
            <div class="sp16"></div>
            <div class="a1" id="grid-tap" style="cursor:pointer">
                ${buildGrid(216)}
            </div>
            <div class="sp16"></div>
            <div class="a2" style="text-align:center">
                <h1 style="font-size:24px;font-weight:700;color:var(--text)">Today's Sudoku</h1>
                <p style="margin-top:4px;font-size:13px;color:var(--text-2)">${count.toLocaleString()} solves today</p>
            </div>
            <div class="sp16"></div>
            <div class="a3 cta-wrap">
                <button class="cta" id="cta-btn">Play Now</button>
            </div>
        </div>
    `
    const launch = (e: MouseEvent) => launchGame(variant, difficulty, e)
    app.querySelector('#cta-btn')!.addEventListener('click', launch as EventListener)
    app.querySelector('#grid-tap')!.addEventListener('click', launch as EventListener)
}

// ─── VARIANT C: Competitive ───────────────────────────────────────────────────
// Trigger competitive instinct with a real-looking leaderboard.

const renderVariantC = (app: HTMLElement, variant: Variant): void => {
    const difficulty = getDefaultDifficulty()
    const rows = [
        { rank: '🥇', name: 'speedrunner99', time: '2:14' },
        { rank: '🥈', name: 'PuzzleKing',    time: '3:01' },
        { rank: '🥉', name: 'quietsolver',   time: '3:28' },
    ]
    const lbHTML = rows.map(r => `
        <div class="lb-row">
            <span style="font-size:13px;color:var(--text-2)">${r.rank} &nbsp;${r.name}</span>
            <span style="font-size:13px;font-weight:700;color:var(--accent-light);font-variant-numeric:tabular-nums">${r.time}</span>
        </div>`).join('<div style="height:6px"></div>')

    app.innerHTML = `
        <div class="scene">
            <div class="a0" style="text-align:center">
                <h1 style="font-size:26px;font-weight:700;color:var(--text)">Today's Sudoku</h1>
                <p style="margin-top:5px;font-size:13px;color:var(--text-2)">Can you make the top 10?</p>
            </div>
            <div class="sp16"></div>
            <div class="a1" style="width:100%;max-width:280px">
                ${lbHTML}
            </div>
            <div class="sp20"></div>
            <div class="a2 cta-wrap">
                <button class="cta" id="cta-btn">Try to Beat Them</button>
            </div>
            <div class="sp12"></div>
            <p class="a3" style="font-size:12px;color:var(--text-3)">${getDailySolveCount().toLocaleString()} attempts today</p>
        </div>
    `
    app.querySelector('#cta-btn')!.addEventListener('click', (e) => launchGame(variant, difficulty, e as MouseEvent))
}

// ─── VARIANT D: Choice ────────────────────────────────────────────────────────
// Let users pick difficulty before clicking — they're already invested.

const renderVariantD = (app: HTMLElement, variant: Variant): void => {
    let selected: Difficulty = getDefaultDifficulty()
    const options: Array<{ d: Difficulty; label: string; hint: string }> = [
        { d: 'simple',       label: 'Simple',       hint: 'Relaxed' },
        { d: 'easy',         label: 'Easy',          hint: 'Casual' },
        { d: 'intermediate', label: 'Intermediate',  hint: 'Challenging' },
        { d: 'expert',       label: 'Expert',        hint: 'Hard' },
    ]

    const chipsHTML = options.map(o => `
        <button class="dchip${o.d === selected ? ' sel' : ''}" data-d="${o.d}">
            <span style="font-size:14px;font-weight:600;color:${o.d === selected ? 'var(--accent-light)' : 'var(--text)'}">${o.label}</span>
            <span style="font-size:11px;color:var(--text-3)">${o.hint}</span>
        </button>`).join('<div style="height:6px"></div>')

    app.innerHTML = `
        <div class="scene">
            <div class="a0" style="text-align:center">
                <h1 style="font-size:26px;font-weight:700;color:var(--text)">Pick your challenge</h1>
                <p style="margin-top:5px;font-size:13px;color:var(--text-2)">${getTodayShort()}</p>
            </div>
            <div class="sp16"></div>
            <div class="a1" style="width:100%;max-width:280px" id="chips">
                ${chipsHTML}
            </div>
            <div class="sp20"></div>
            <div class="a2 cta-wrap">
                <button class="cta" id="cta-btn">Start Puzzle</button>
            </div>
        </div>
    `

    app.querySelectorAll('.dchip').forEach((chip) => {
        chip.addEventListener('click', () => {
            selected = (chip as HTMLElement).dataset['d'] as Difficulty
            app.querySelectorAll('.dchip').forEach((c) => {
                const el = c as HTMLElement
                const isNow = el.dataset['d'] === selected
                el.classList.toggle('sel', isNow)
                const label = el.querySelector('span:first-child') as HTMLElement | null
                if (label) label.style.color = isNow ? 'var(--accent-light)' : 'var(--text)'
            })
        })
    })

    app.querySelector('#cta-btn')!.addEventListener('click', (e) => launchGame(variant, selected, e as MouseEvent))
}

// ─── VARIANT E: Social proof ──────────────────────────────────────────────────
// LIVE + stats + grid — real energy, real activity.

const renderVariantE = (app: HTMLElement, variant: Variant): void => {
    const difficulty = getDefaultDifficulty()
    const solves = getDailySolveCount()

    app.innerHTML = `
        <div class="scene">
            <div class="a0">
                <div class="pill" style="background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.25)">
                    <span style="width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0"></span>
                    <span style="color:rgba(240,240,240,0.7)">LIVE</span>
                </div>
            </div>
            <div class="sp12"></div>
            <div class="a1" id="grid-tap" style="cursor:pointer">
                ${buildGrid(192)}
            </div>
            <div class="sp14"></div>
            <div class="a2" style="display:flex;gap:24px;align-items:center">
                <div style="text-align:center">
                    <div style="font-size:22px;font-weight:700;color:var(--text);line-height:1">${solves.toLocaleString()}</div>
                    <div style="font-size:10px;color:var(--text-3);margin-top:2px;letter-spacing:0.05em">SOLVES</div>
                </div>
                <div style="width:1px;height:32px;background:rgba(255,255,255,0.10)"></div>
                <div style="text-align:center">
                    <div style="font-size:22px;font-weight:700;color:var(--accent-light);line-height:1">4:32</div>
                    <div style="font-size:10px;color:var(--text-3);margin-top:2px;letter-spacing:0.05em">AVG TIME</div>
                </div>
            </div>
            <div class="sp16"></div>
            <div class="a3" style="text-align:center">
                <p style="font-size:15px;font-weight:600;color:var(--text)">Today's Sudoku</p>
                <p style="margin-top:3px;font-size:13px;color:var(--text-2)">How fast can you solve it?</p>
            </div>
            <div class="sp16"></div>
            <div class="a4 cta-wrap">
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
