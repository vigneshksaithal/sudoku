import * as fc from 'fast-check'
import { describe, it } from 'vitest'
import { initialPauseState, reduce } from '../pause-reducer'
import type { PauseEvent } from '../pause-reducer'

// Events that can appear in sequences without RESET_ROUND
const backgroundEvents = ['VISIBILITY_HIDDEN', 'PAGEHIDE'] as const satisfies readonly PauseEvent[]
const nonBackgroundEvents = ['PAUSE_PRESSED', 'RESUME', 'VISIBILITY_SHOWN'] as const satisfies readonly PauseEvent[]
const allNonResetEvents = [...backgroundEvents, ...nonBackgroundEvents] as const satisfies readonly PauseEvent[]

// Arbitrary for a single non-reset event
const nonResetEventArb: fc.Arbitrary<PauseEvent> = fc.constantFrom(...allNonResetEvents)

// Arbitrary for a sequence of length 1–50 containing at least one background event.
// Strategy: generate a sequence of non-reset events, then filter to those with at least
// one background event. We use a smarter approach: always inject at least one background
// event at a random position to avoid excessive filtering.
const sequenceWithBackgroundArb: fc.Arbitrary<PauseEvent[]> = fc
    .tuple(
        // Position of the injected background event (0-indexed within the final sequence)
        fc.integer({ min: 0, max: 49 }),
        // The injected background event
        fc.constantFrom(...backgroundEvents),
        // Remaining events to fill the sequence (up to 49 more)
        fc.array(nonResetEventArb, { minLength: 0, maxLength: 49 }),
    )
    .map(([insertAt, bgEvent, rest]) => {
        // Build a sequence of length 1–50 with bgEvent at position `insertAt`
        const sequence: PauseEvent[] = [...rest]
        const clampedInsert = Math.min(insertAt, sequence.length)
        sequence.splice(clampedInsert, 0, bgEvent)
        return sequence
    })
    .filter((seq) => seq.length >= 1 && seq.length <= 50)

// Arbitrary for a sequence of only PAUSE_PRESSED and RESUME events (length 0–50)
const pauseResumeOnlyArb: fc.Arbitrary<PauseEvent[]> = fc.array(
    fc.constantFrom('PAUSE_PRESSED' as PauseEvent, 'RESUME' as PauseEvent),
    { minLength: 0, maxLength: 50 },
)

describe('pause-reducer property tests', () => {
    /**
     * Feature: solve-pause, Property 3
     * unrankedDueToBackground latches true after first background event
     *
     * For any event sequence of length 1–50 (no RESET_ROUND) containing at
     * least one VISIBILITY_HIDDEN or PAGEHIDE, folding `reduce` over the
     * sequence from `initialPauseState` must produce `unrankedDueToBackground
     * === true` for every intermediate state at or after the index of the
     * first background event.
     *
     * **Validates: Requirements 6.10, 7.4, 13.5, 15.3**
     */
    it('Property 3: unrankedDueToBackground latches true after first background event', () => {
        fc.assert(
            fc.property(sequenceWithBackgroundArb, (events) => {
                // Find the index of the first background event
                const firstBgIndex = events.findIndex(
                    (e) => e === 'VISIBILITY_HIDDEN' || e === 'PAGEHIDE',
                )

                // The sequence is guaranteed to contain at least one background event
                if (firstBgIndex === -1) return true

                // Fold reduce over the sequence, collecting intermediate states
                let state = initialPauseState
                for (let i = 0; i < events.length; i++) {
                    const event = events[i]!
                    state = reduce(state, event)

                    // At or after the first background event, the latch must be true
                    if (i >= firstBgIndex && !state.unrankedDueToBackground) {
                        return false
                    }
                }

                return true
            }),
            { numRuns: 100 },
        )
    })

    /**
     * Feature: solve-pause, Property 4
     * PAUSE/RESUME sequences with no background event leave unrankedDueToBackground false
     *
     * For any event sequence composed only of PAUSE_PRESSED and RESUME events
     * (no VISIBILITY_HIDDEN, PAGEHIDE, VISIBILITY_SHOWN, or RESET_ROUND),
     * folding `reduce` over the sequence from `initialPauseState` must produce
     * `unrankedDueToBackground === false` for every intermediate state and the
     * final state.
     *
     * **Validates: Requirements 2.7, 7.5, 7.6**
     */
    it('Property 4: PAUSE/RESUME sequences with no background event leave unrankedDueToBackground false', () => {
        fc.assert(
            fc.property(pauseResumeOnlyArb, (events) => {
                let state = initialPauseState

                for (const event of events) {
                    state = reduce(state, event)

                    if (state.unrankedDueToBackground) {
                        return false
                    }
                }

                return !state.unrankedDueToBackground
            }),
            { numRuns: 100 },
        )
    })
})
