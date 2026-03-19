import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
    DIFFICULTY_STORAGE_KEY,
    VALID_DIFFICULTIES,
    getNextDifficulty,
    parseDifficulty,
} from '../constants'
import type { Difficulty } from '../types'

describe('DIFFICULTY_STORAGE_KEY', () => {
    it('is the string sudoku-difficulty', () => {
        expect(DIFFICULTY_STORAGE_KEY).toBe('sudoku-difficulty')
    })
})

describe('VALID_DIFFICULTIES', () => {
    it('contains exactly the four valid difficulties', () => {
        expect(VALID_DIFFICULTIES).toEqual(['simple', 'easy', 'intermediate', 'expert'])
    })
})

describe('parseDifficulty', () => {
    it('returns each valid difficulty unchanged', () => {
        const valid: Difficulty[] = ['simple', 'easy', 'intermediate', 'expert']
        for (const d of valid) {
            expect(parseDifficulty(d)).toBe(d)
        }
    })

    it('returns simple for null', () => {
        expect(parseDifficulty(null)).toBe('simple')
    })

    it('returns simple for empty string', () => {
        expect(parseDifficulty('')).toBe('simple')
    })

    it('returns simple for invalid strings', () => {
        expect(parseDifficulty('hard')).toBe('simple')
        expect(parseDifficulty('EASY')).toBe('simple')
        expect(parseDifficulty('Simple')).toBe('simple')
        expect(parseDifficulty('medium')).toBe('simple')
    })
})

describe('getNextDifficulty', () => {
    it('returns the next difficulty in sequence', () => {
        expect(getNextDifficulty('simple')).toBe('easy')
        expect(getNextDifficulty('easy')).toBe('intermediate')
        expect(getNextDifficulty('intermediate')).toBe('expert')
    })

    it('wraps from expert back to simple', () => {
        expect(getNextDifficulty('expert')).toBe('simple')
    })
})

// Property 2: Difficulty validation accepts only valid values
// Validates: Requirements 4.3, 4.4, 3.3
describe('Property 2: parseDifficulty always returns a valid difficulty', () => {
    it('returns one of the four valid difficulties for any arbitrary string', () => {
        fc.assert(
            fc.property(fc.string(), (raw) => {
                const result = parseDifficulty(raw)
                expect(VALID_DIFFICULTIES).toContain(result)
            })
        )
    })

    it('returns the input unchanged for each of the four valid difficulty strings', () => {
        fc.assert(
            fc.property(fc.constantFrom(...VALID_DIFFICULTIES), (d) => {
                expect(parseDifficulty(d)).toBe(d)
            })
        )
    })

    it('returns simple for null', () => {
        fc.assert(
            fc.property(fc.constant(null), (raw) => {
                expect(parseDifficulty(raw)).toBe('simple')
            })
        )
    })
})

// Property 1: Difficulty round-trip through localStorage
// Validates: Requirements 2.4, 4.1, 4.2
// Uses an in-memory Map to simulate localStorage contract in Node test environment.
describe('Property 1: Difficulty round-trip through localStorage', () => {
    it('writing a valid difficulty and reading it back returns the original value', () => {
        fc.assert(
            fc.property(fc.constantFrom(...VALID_DIFFICULTIES), (difficulty) => {
                const store = new Map<string, string>()
                store.set(DIFFICULTY_STORAGE_KEY, difficulty)
                const raw = store.get(DIFFICULTY_STORAGE_KEY) ?? null
                const result = parseDifficulty(raw)
                expect(result).toBe(difficulty)
            })
        )
    })
})
