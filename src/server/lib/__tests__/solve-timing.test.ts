import { describe, expect, it } from 'vitest'
import { assessTiming, minimumRankedSeconds } from '../solve-timing'

// 26 givens, 55 empty cells; solvable with singles only.
const SINGLES_PUZZLE = '005020070060000000900007180008600025000508000150004900042300007000000090090010400'

const timing = { startedAt: '0', pausedMs: '0' }
const assess = (difficulty: Parameters<typeof assessTiming>[2], seconds: number) =>
    assessTiming(timing, SINGLES_PUZZLE, difficulty, seconds, seconds * 1000)

describe('minimumRankedSeconds', () => {
    it('scales the per-cell floor by difficulty', () => {
        expect(minimumRankedSeconds(SINGLES_PUZZLE, 'simple')).toBe(55)
        expect(minimumRankedSeconds(SINGLES_PUZZLE, 'easy')).toBe(55)
        expect(minimumRankedSeconds(SINGLES_PUZZLE, 'intermediate')).toBe(83)
        expect(minimumRankedSeconds(SINGLES_PUZZLE, 'expert')).toBe(110)
    })

    it('keeps the 10 second minimum for nearly complete grids', () => {
        const nearlyFull = '1'.repeat(78) + '000'
        expect(minimumRankedSeconds(nearlyFull, 'easy')).toBe(10)
        expect(minimumRankedSeconds(nearlyFull, 'expert')).toBe(10)
    })
})

describe('assessTiming', () => {
    it('ranks a 91 second easy solve that the flat two-second floor rejected', () => {
        expect(assess('easy', 91)).toEqual({ completionTime: 91, unranked: false })
    })

    it('still rejects the same time on expert', () => {
        expect(assess('expert', 91).unranked).toBe(true)
    })

    it('rejects easy solves below the easy floor', () => {
        expect(assess('easy', 54).unranked).toBe(true)
        expect(assess('easy', 55).unranked).toBe(false)
    })

    it('still rejects a client timer well below the server timer', () => {
        expect(assessTiming(timing, SINGLES_PUZZLE, 'easy', 60, 100_000).unranked).toBe(true)
    })
})
