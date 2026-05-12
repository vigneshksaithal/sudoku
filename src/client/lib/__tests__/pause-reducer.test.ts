import { describe, it, expect } from 'vitest'
import {
    initialPauseState,
    reduce,
} from '../pause-reducer'
import type { PauseState, PauseEvent } from '../pause-reducer'

// ─── State aliases ────────────────────────────────────────────────────────────
// R0: isPaused=false, unrankedDueToBackground=false
// P0: isPaused=true,  unrankedDueToBackground=false
// R1: isPaused=false, unrankedDueToBackground=true
// P1: isPaused=true,  unrankedDueToBackground=true

const R0: PauseState = { isPaused: false, unrankedDueToBackground: false }
const P0: PauseState = { isPaused: true, unrankedDueToBackground: false }
const R1: PauseState = { isPaused: false, unrankedDueToBackground: true }
const P1: PauseState = { isPaused: true, unrankedDueToBackground: true }

// ─── initialPauseState ────────────────────────────────────────────────────────

describe('initialPauseState', () => {
    it('equals R0: isPaused=false, unrankedDueToBackground=false', () => {
        expect(initialPauseState).toEqual(R0)
    })
})

// ─── Transitions from R0 ──────────────────────────────────────────────────────

describe('reduce from R0 (isPaused=false, unrankedDueToBackground=false)', () => {
    it('PAUSE_PRESSED → P0', () => {
        expect(reduce(R0, 'PAUSE_PRESSED')).toEqual(P0)
    })

    it('VISIBILITY_HIDDEN → R1', () => {
        expect(reduce(R0, 'VISIBILITY_HIDDEN')).toEqual(R1)
    })

    it('PAGEHIDE → R1', () => {
        expect(reduce(R0, 'PAGEHIDE')).toEqual(R1)
    })

    it('VISIBILITY_SHOWN is a no-op (stays R0)', () => {
        expect(reduce(R0, 'VISIBILITY_SHOWN')).toEqual(R0)
    })

    it('RESUME is a no-op (stays R0)', () => {
        expect(reduce(R0, 'RESUME')).toEqual(R0)
    })

    it('RESET_ROUND stays at R0', () => {
        expect(reduce(R0, 'RESET_ROUND')).toEqual(R0)
    })
})

// ─── Transitions from P0 ──────────────────────────────────────────────────────

describe('reduce from P0 (isPaused=true, unrankedDueToBackground=false)', () => {
    it('RESUME → R0', () => {
        expect(reduce(P0, 'RESUME')).toEqual(R0)
    })

    it('VISIBILITY_HIDDEN → P1', () => {
        expect(reduce(P0, 'VISIBILITY_HIDDEN')).toEqual(P1)
    })

    it('PAGEHIDE → P1', () => {
        expect(reduce(P0, 'PAGEHIDE')).toEqual(P1)
    })

    it('PAUSE_PRESSED is a no-op (stays P0)', () => {
        expect(reduce(P0, 'PAUSE_PRESSED')).toEqual(P0)
    })

    it('VISIBILITY_SHOWN is a no-op (stays P0)', () => {
        expect(reduce(P0, 'VISIBILITY_SHOWN')).toEqual(P0)
    })

    it('RESET_ROUND → R0', () => {
        expect(reduce(P0, 'RESET_ROUND')).toEqual(R0)
    })
})

// ─── Transitions from R1 ──────────────────────────────────────────────────────

describe('reduce from R1 (isPaused=false, unrankedDueToBackground=true)', () => {
    it('PAUSE_PRESSED → P1', () => {
        expect(reduce(R1, 'PAUSE_PRESSED')).toEqual(P1)
    })

    it('VISIBILITY_HIDDEN stays at R1', () => {
        expect(reduce(R1, 'VISIBILITY_HIDDEN')).toEqual(R1)
    })

    it('PAGEHIDE stays at R1', () => {
        expect(reduce(R1, 'PAGEHIDE')).toEqual(R1)
    })

    it('VISIBILITY_SHOWN stays at R1 (timer-restart is a side effect, not reducer state)', () => {
        expect(reduce(R1, 'VISIBILITY_SHOWN')).toEqual(R1)
    })

    it('RESUME is a no-op (stays R1)', () => {
        expect(reduce(R1, 'RESUME')).toEqual(R1)
    })

    it('RESET_ROUND → R0', () => {
        expect(reduce(R1, 'RESET_ROUND')).toEqual(R0)
    })
})

// ─── Transitions from P1 ──────────────────────────────────────────────────────

describe('reduce from P1 (isPaused=true, unrankedDueToBackground=true)', () => {
    it('RESUME → R1', () => {
        expect(reduce(P1, 'RESUME')).toEqual(R1)
    })

    it('VISIBILITY_HIDDEN stays at P1', () => {
        expect(reduce(P1, 'VISIBILITY_HIDDEN')).toEqual(P1)
    })

    it('PAGEHIDE stays at P1', () => {
        expect(reduce(P1, 'PAGEHIDE')).toEqual(P1)
    })

    it('VISIBILITY_SHOWN stays at P1', () => {
        expect(reduce(P1, 'VISIBILITY_SHOWN')).toEqual(P1)
    })

    it('PAUSE_PRESSED is a no-op (stays P1)', () => {
        expect(reduce(P1, 'PAUSE_PRESSED')).toEqual(P1)
    })

    it('RESET_ROUND → R0', () => {
        expect(reduce(P1, 'RESET_ROUND')).toEqual(R0)
    })
})

// ─── Immutability ─────────────────────────────────────────────────────────────

describe('immutability — every transition returns a new object', () => {
    const allStates: PauseState[] = [R0, P0, R1, P1]
    const allEvents: PauseEvent[] = [
        'PAUSE_PRESSED',
        'RESUME',
        'VISIBILITY_HIDDEN',
        'VISIBILITY_SHOWN',
        'PAGEHIDE',
        'RESET_ROUND',
    ]

    for (const state of allStates) {
        for (const event of allEvents) {
            it(`reduce(${JSON.stringify(state)}, ${event}) returns a new object reference`, () => {
                const result = reduce(state, event)
                expect(result).not.toBe(state)
            })
        }
    }
})

// ─── unrankedDueToBackground latch invariant ──────────────────────────────────

describe('unrankedDueToBackground is never cleared except by RESET_ROUND', () => {
    const nonResetEvents: PauseEvent[] = [
        'PAUSE_PRESSED',
        'RESUME',
        'VISIBILITY_HIDDEN',
        'VISIBILITY_SHOWN',
        'PAGEHIDE',
    ]

    for (const event of nonResetEvents) {
        it(`${event} from R1 does not clear unrankedDueToBackground`, () => {
            const result = reduce(R1, event)
            expect(result.unrankedDueToBackground).toBe(true)
        })

        it(`${event} from P1 does not clear unrankedDueToBackground`, () => {
            const result = reduce(P1, event)
            expect(result.unrankedDueToBackground).toBe(true)
        })
    }

    it('RESET_ROUND from R1 clears unrankedDueToBackground to false', () => {
        expect(reduce(R1, 'RESET_ROUND').unrankedDueToBackground).toBe(false)
    })

    it('RESET_ROUND from P1 clears unrankedDueToBackground to false', () => {
        expect(reduce(P1, 'RESET_ROUND').unrankedDueToBackground).toBe(false)
    })
})

// ─── PAUSE_PRESSED / RESUME never mutate unrankedDueToBackground ──────────────

describe('PAUSE_PRESSED and RESUME never change unrankedDueToBackground', () => {
    it('PAUSE_PRESSED from R0 leaves unrankedDueToBackground false', () => {
        expect(reduce(R0, 'PAUSE_PRESSED').unrankedDueToBackground).toBe(false)
    })

    it('RESUME from P0 leaves unrankedDueToBackground false', () => {
        expect(reduce(P0, 'RESUME').unrankedDueToBackground).toBe(false)
    })

    it('PAUSE_PRESSED from R1 leaves unrankedDueToBackground true', () => {
        expect(reduce(R1, 'PAUSE_PRESSED').unrankedDueToBackground).toBe(true)
    })

    it('RESUME from P1 leaves unrankedDueToBackground true', () => {
        expect(reduce(P1, 'RESUME').unrankedDueToBackground).toBe(true)
    })
})
