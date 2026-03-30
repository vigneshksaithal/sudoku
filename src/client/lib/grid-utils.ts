import type { CellState } from './types'

export type BoxTint = 'light' | 'dark'

export type CellClassParams = {
    readonly r: number
    readonly c: number
    readonly cell: CellState
    readonly selected: boolean
    readonly focused: boolean
    readonly highlightDigit: number | null
    readonly isNoteHighlight: boolean
    readonly isPrimary: boolean
    readonly isSecondary: boolean
    readonly hasConflict: boolean
}

export const getBoxTint = (r: number, c: number): BoxTint => {
    const boxRow = Math.floor(r / 3)
    const boxCol = Math.floor(c / 3)
    return (boxRow + boxCol) % 2 === 0 ? 'light' : 'dark'
}

export const getCellClasses = (params: CellClassParams): string => {
    const classes: string[] = [
        BASE_CLASSES,
        ...getBorderClasses(params.r, params.c),
        getTextClasses(params),
        getBackgroundClass(params),
    ]

    if (params.focused) {
        classes.push('z-10 outline-2 outline-blue-500')
    }

    return classes.filter(Boolean).join(' ')
}

// --- Helpers (below callers) ---

const BASE_CLASSES =
    'flex aspect-square min-h-9 min-w-9 items-center justify-center text-lg font-mono focus:outline-none'

const getBorderClasses = (r: number, c: number): string[] => {
    const borders: string[] = []

    // Box borders (thick) — every 3rd cell start + outer edges
    if (r % 3 === 0) borders.push('border-t-[3px] border-t-neutral-800 dark:border-t-neutral-200')
    if (c % 3 === 0) borders.push('border-l-[3px] border-l-neutral-800 dark:border-l-neutral-200')
    if (r === 8) borders.push('border-b-[3px] border-b-neutral-800 dark:border-b-neutral-200')
    if (c === 8) borders.push('border-r-[3px] border-r-neutral-800 dark:border-r-neutral-200')

    // Cell borders (thin) — between cells within a box
    if (r % 3 !== 0) borders.push('border-t border-t-neutral-300 dark:border-t-neutral-600')
    if (c % 3 !== 0) borders.push('border-l border-l-neutral-300 dark:border-l-neutral-600')

    return borders
}

const getTextClasses = (params: CellClassParams): string => {
    // Conflict text color takes precedence over all other text styling
    if (params.hasConflict) {
        return params.cell.isGiven
            ? 'font-semibold text-red-600 dark:text-red-400'
            : 'text-red-600 dark:text-red-400'
    }

    return params.cell.isGiven
        ? 'font-semibold text-neutral-900 dark:text-neutral-100'
        : 'text-blue-600 dark:text-blue-400'
}

// Precedence: isPrimary > isSecondary > conflict > selected (amber) > digit match (blue) > note match (yellow) > box tint
const getBackgroundClass = (params: CellClassParams): string => {
    if (params.isPrimary && !params.hasConflict) {
        return 'bg-emerald-200 dark:bg-emerald-800/50'
    }

    if (params.isSecondary && !params.hasConflict) {
        return 'bg-cyan-100 dark:bg-cyan-900/30'
    }

    if (params.hasConflict) {
        return 'bg-red-50 dark:bg-red-900/30'
    }

    if (params.selected) {
        return 'bg-amber-200 dark:bg-amber-500/40'
    }

    const isDigitHighlight =
        params.highlightDigit !== null && params.cell.value === params.highlightDigit
    if (isDigitHighlight) {
        return 'bg-blue-200 dark:bg-blue-700/50'
    }

    if (params.isNoteHighlight) {
        return 'bg-yellow-200 dark:bg-yellow-700/50'
    }

    return getBoxTintClass(params.r, params.c)
}

const getBoxTintClass = (r: number, c: number): string =>
    getBoxTint(r, c) === 'light'
        ? 'bg-white dark:bg-neutral-900'
        : 'bg-neutral-100 dark:bg-neutral-800'
