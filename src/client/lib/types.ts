export type Difficulty = 'easy' | 'medium' | 'hard'

export type GameScreen = 'picking' | 'playing' | 'completed'

export type CellState = {
    value: number
    isGiven: boolean
    hasConflict: boolean
}
