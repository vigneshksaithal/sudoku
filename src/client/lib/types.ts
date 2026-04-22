import { SvelteSet } from 'svelte/reactivity'

export type Difficulty = 'simple' | 'easy' | 'intermediate' | 'expert'

export type GameScreen = 'playing' | 'completed'

export type InputMode = 'cell-first' | 'digit-first'

export type CellState = {
    value: number
    isGiven: boolean
    hasConflict: boolean
}

export type NotesBoard = SvelteSet<number>[][]

export type TechniqueType =
    | 'naked-single'
    | 'hidden-single'
    | 'naked-pair'
    | 'hidden-pair'
    | 'pointing-pair'
    | 'box-line-reduction'

export type TechniqueDifficulty = 'easy' | 'medium' | 'hard'

export type TechniqueAction = 'placement' | 'elimination'

export type TechniqueHint = {
    technique: TechniqueType
    difficulty: TechniqueDifficulty
    title: string
    description: string
    primaryCells: ReadonlyArray<readonly [number, number]>
    secondaryCells: ReadonlyArray<readonly [number, number]>
    action: TechniqueAction
    digit: number
    eliminations?: ReadonlyArray<{ row: number; col: number; digits: number[] }>
}

export type CandidateBoard = ReadonlyArray<ReadonlyArray<ReadonlySet<number>>>

export type TechniqueHighlight = {
    primaryCells: ReadonlyArray<readonly [number, number]>
    secondaryCells: ReadonlyArray<readonly [number, number]>
}
