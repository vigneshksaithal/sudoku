export type Difficulty = 'simple' | 'easy' | 'intermediate' | 'expert'

export type GameScreen = 'picking' | 'playing' | 'completed'

export type CellState = {
    value: number
    isGiven: boolean
    hasConflict: boolean
}
