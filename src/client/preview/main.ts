import { requestExpandedMode } from '@devvit/web/client'
import { DIFFICULTY_STORAGE_KEY, VALID_DIFFICULTIES } from '../lib/constants'
import type { Difficulty } from '../lib/types'
import '../app.css'

const createButton = (difficulty: Difficulty): HTMLButtonElement => {
    const btn = document.createElement('button')
    btn.textContent = difficulty
    btn.className =
        'min-h-11 w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold capitalize text-white transition-all hover:bg-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500'
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
    app.className =
        'flex h-full w-full items-center justify-center overflow-hidden p-4 bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100'

    const container = document.createElement('div')
    container.className = 'text-center space-y-6'

    const title = document.createElement('h1')
    title.textContent = 'Sudoku'
    title.className = 'text-3xl font-bold'

    const subtitle = document.createElement('p')
    subtitle.textContent = 'Choose a difficulty'
    subtitle.className = 'text-neutral-600 dark:text-neutral-400'

    const buttonGroup = document.createElement('div')
    buttonGroup.className = 'flex flex-col gap-3 justify-center'

    for (const difficulty of VALID_DIFFICULTIES) {
        buttonGroup.appendChild(createButton(difficulty))
    }

    container.appendChild(title)
    container.appendChild(subtitle)
    container.appendChild(buttonGroup)
    app.appendChild(container)
}

const app = document.getElementById('app')
if (!app) throw new Error('App element not found')
render(app)
