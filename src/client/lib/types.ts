import { SvelteSet } from 'svelte/reactivity'

export type Difficulty = 'simple' | 'easy' | 'intermediate' | 'expert'

export type GameScreen = 'playing' | 'completed' | 'submit'

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

export type PuzzleType = 'community' | 'generated'

export type CommunityPuzzleResponse = {
    type: 'community'
    creatorUsername: string
    puzzles: Record<string, string>
    solutions: Record<string, string>
    solveCount: number
}

export type GeneratedPuzzleResponse = {
    type: 'generated'
    puzzles: Record<string, string>
    solutions: Record<string, string>
}

export type PuzzleResponse = CommunityPuzzleResponse | GeneratedPuzzleResponse

export type SubmissionHistoryEntry = {
    postId: string
    difficulty: Difficulty
    createdAt: number
    solveCount: number
}

export type SubmitScreenState = 'input' | 'validating' | 'preview' | 'submitting' | 'success'
