export type PauseState = {
    isPaused: boolean
    unrankedDueToBackground: boolean
}

export type PauseEvent =
    | 'PAUSE_PRESSED'
    | 'RESUME'
    | 'VISIBILITY_HIDDEN'
    | 'VISIBILITY_SHOWN'
    | 'PAGEHIDE'
    | 'RESET_ROUND'

export const initialPauseState: PauseState = {
    isPaused: false,
    unrankedDueToBackground: false,
}

export const reduce = (state: PauseState, event: PauseEvent): PauseState => {
    switch (event) {
        case 'PAUSE_PRESSED':
            // Only transitions when not already paused; never changes unrankedDueToBackground
            if (state.isPaused) return { ...state }
            return { ...state, isPaused: true }

        case 'RESUME':
            // Only transitions when paused; never changes unrankedDueToBackground
            if (!state.isPaused) return { ...state }
            return { ...state, isPaused: false }

        case 'VISIBILITY_HIDDEN':
        case 'PAGEHIDE':
            // Always latches unrankedDueToBackground; never clears isPaused
            return { ...state, unrankedDueToBackground: true }

        case 'VISIBILITY_SHOWN':
            // Timer restart is a side effect at the adapter layer — reducer is a no-op
            return { ...state }

        case 'RESET_ROUND':
            // The only event that clears both flags
            return { isPaused: false, unrankedDueToBackground: false }
    }
}
