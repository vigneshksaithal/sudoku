import { SvelteSet } from 'svelte/reactivity'

export type Difficulty = 'simple' | 'easy' | 'intermediate' | 'expert'

export type GameScreen = 'playing' | 'completed'

export type CellState = {
    value: number
    isGiven: boolean
    hasConflict: boolean
}

export type NotesBoard = SvelteSet<number>[][]
