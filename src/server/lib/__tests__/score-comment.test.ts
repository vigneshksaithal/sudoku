import { expect, describe, it } from 'vitest'

import { formatScoreComment } from '../score-comment'

// ─── formatScoreComment ───────────────────────────────────────────────────────

describe('formatScoreComment', () => {
    it('includes the difficulty name', () => {
        const result = formatScoreComment({ difficulty: 'expert', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: false })
        expect(result).toContain('expert')
    })

    it('includes the formatted time in m:ss', () => {
        const result = formatScoreComment({ difficulty: 'easy', completionTime: 154, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: false })
        expect(result).toContain('2:34')
    })

    it('includes the hints count', () => {
        const result = formatScoreComment({ difficulty: 'easy', completionTime: 60, hintsUsed: 3, mistakesCount: 0, notesUsed: false, unranked: false })
        expect(result).toContain('3')
    })

    it('includes the mistakes count', () => {
        const result = formatScoreComment({ difficulty: 'easy', completionTime: 60, hintsUsed: 0, mistakesCount: 5, notesUsed: false, unranked: false })
        expect(result).toContain('5')
    })

    // ─── Perfect solve ────────────────────────────────────────────────────────

    it('includes "Perfect solve!" when hints=0 and mistakes=0', () => {
        const result = formatScoreComment({ difficulty: 'simple', completionTime: 90, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: false })
        expect(result).toContain('Perfect solve!')
    })

    it('does not include "Perfect solve!" when hints > 0', () => {
        const result = formatScoreComment({ difficulty: 'simple', completionTime: 90, hintsUsed: 1, mistakesCount: 0, notesUsed: false, unranked: false })
        expect(result).not.toContain('Perfect solve!')
    })

    it('does not include "Perfect solve!" when mistakes > 0', () => {
        const result = formatScoreComment({ difficulty: 'simple', completionTime: 90, hintsUsed: 0, mistakesCount: 2, notesUsed: false, unranked: false })
        expect(result).not.toContain('Perfect solve!')
    })

    it('does not include "Perfect solve!" when both hints and mistakes > 0', () => {
        const result = formatScoreComment({ difficulty: 'simple', completionTime: 90, hintsUsed: 1, mistakesCount: 1, notesUsed: false, unranked: false })
        expect(result).not.toContain('Perfect solve!')
    })

    // ─── Time formatting edge cases ───────────────────────────────────────────

    it('formats 0 seconds as "0:00"', () => {
        const result = formatScoreComment({ difficulty: 'easy', completionTime: 0, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: false })
        expect(result).toContain('0:00')
    })

    it('formats 61 seconds as "1:01"', () => {
        const result = formatScoreComment({ difficulty: 'easy', completionTime: 61, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: false })
        expect(result).toContain('1:01')
    })

    it('formats 59 seconds as "0:59"', () => {
        const result = formatScoreComment({ difficulty: 'easy', completionTime: 59, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: false })
        expect(result).toContain('0:59')
    })

    it('formats 3600 seconds as "60:00"', () => {
        const result = formatScoreComment({ difficulty: 'easy', completionTime: 3600, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: false })
        expect(result).toContain('60:00')
    })

    it('formats 3661 seconds as "61:01"', () => {
        const result = formatScoreComment({ difficulty: 'easy', completionTime: 3661, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: false })
        expect(result).toContain('61:01')
    })

    // ─── Notes used ───────────────────────────────────────────────────────────

    it('includes "📝 Notes | Yes |" when notesUsed is true', () => {
        const result = formatScoreComment({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: true, unranked: false })
        expect(result).toContain('📝 Notes | Yes |')
    })

    it('includes "📝 Notes | No |" when notesUsed is false', () => {
        const result = formatScoreComment({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: false })
        expect(result).toContain('📝 Notes | No |')
    })

    // ─── Unranked row ─────────────────────────────────────────────────────────

    it('includes "| 🏁 Unranked | Yes |" immediately after the Notes row when unranked is true', () => {
        const result = formatScoreComment({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: true })
        expect(result).toContain('| 🏁 Unranked | Yes |')
        // The unranked row must appear immediately after the Notes row
        const notesIndex = result.indexOf('📝 Notes')
        const unrankedIndex = result.indexOf('🏁 Unranked')
        expect(unrankedIndex).toBeGreaterThan(notesIndex)
        const between = result.slice(notesIndex, unrankedIndex)
        expect(between.split('\n').length).toBeLessThanOrEqual(2)
    })

    it('does not include "🏁 Unranked" anywhere when unranked is false', () => {
        const result = formatScoreComment({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: false })
        expect(result).not.toContain('🏁 Unranked')
    })

    it('still includes "Perfect solve!" when unranked is true and hints=0 and mistakes=0', () => {
        const result = formatScoreComment({ difficulty: 'easy', completionTime: 120, hintsUsed: 0, mistakesCount: 0, notesUsed: false, unranked: true })
        expect(result).toContain('Perfect solve!')
        expect(result).toContain('| 🏁 Unranked | Yes |')
    })
})
