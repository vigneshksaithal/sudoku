import { describe, expect, it } from 'vitest'
import {
    findAdvancedStep,
    findSkyscraper,
    findTwoStringKite,
    findWWing,
    findXWing,
    findXYWing,
} from '../advanced-techniques'

const at = (r: number, c: number): number => r * 9 + c
const bits = (...digits: number[]): number => digits.reduce((m, d) => m | (1 << (d - 1)), 0)

/** Build masks from [row, col, digits[]] entries; every other cell is solved (0). */
const masksFrom = (entries: Array<[number, number, number[]]>): number[] => {
    const masks = new Array<number>(81).fill(0)
    for (const [r, c, digits] of entries) masks[at(r, c)] = bits(...digits)
    return masks
}

describe('findXWing', () => {
    it('removes the digit from the rest of both columns', () => {
        const masks = masksFrom([
            [0, 2, [1]], [0, 6, [1]],
            [4, 2, [1]], [4, 6, [1]],
            [7, 2, [1, 5]],
        ])
        const step = findXWing(masks)
        expect(step).toMatchObject({ technique: 'x-wing', digit: 1, eliminations: [at(7, 2)] })
        expect(step!.pattern.sort((a, b) => a - b)).toEqual([at(0, 2), at(0, 6), at(4, 2), at(4, 6)])
    })

    it('needs the same two columns in both rows', () => {
        const masks = masksFrom([
            [0, 2, [1]], [0, 6, [1]],
            [4, 2, [1]], [4, 7, [1]],
            [7, 2, [1, 5]],
        ])
        expect(findXWing(masks)).toBeNull()
    })
})

describe('findSkyscraper', () => {
    it('removes the digit from cells that see both roof cells', () => {
        const masks = masksFrom([
            [1, 0, [1]], [1, 4, [1]],
            [6, 0, [1]], [6, 5, [1]],
            [0, 5, [1, 7]],
        ])
        const step = findSkyscraper(masks)
        expect(step).toMatchObject({ technique: 'skyscraper', digit: 1 })
        expect(step!.eliminations).toEqual([at(0, 5)])
        expect(step!.detail).toMatchObject({ kind: 'skyscraper', orientation: 'row' })
    })
})

describe('findTwoStringKite', () => {
    it('joins a row link and a column link through a box', () => {
        const masks = masksFrom([
            [0, 1, [4]], [0, 6, [4]],
            [2, 0, [4]], [7, 0, [4]],
            [7, 6, [4, 9]],
        ])
        const step = findTwoStringKite(masks)
        expect(step).toMatchObject({ technique: 'two-string-kite', digit: 4, eliminations: [at(7, 6)] })
        expect(step!.detail).toMatchObject({ kind: 'two-string-kite', box: 0, ends: [at(0, 6), at(7, 0)] })
    })
})

describe('findXYWing', () => {
    it('removes z from cells that see both pincers', () => {
        const masks = masksFrom([
            [0, 0, [1, 2]],
            [0, 5, [1, 3]],
            [5, 0, [2, 3]],
            [5, 5, [3, 4]],
        ])
        const step = findXYWing(masks)
        expect(step).toMatchObject({ technique: 'xy-wing', digit: 3, eliminations: [at(5, 5)] })
        expect(step!.detail).toMatchObject({ kind: 'xy-wing', pivot: at(0, 0), x: 1, y: 2, z: 3 })
    })

    it('ignores pincers that share the pivot pair', () => {
        const masks = masksFrom([
            [0, 0, [1, 2]],
            [0, 5, [1, 2]],
            [5, 0, [1, 2]],
            [5, 5, [1, 2, 3]],
        ])
        expect(findXYWing(masks)).toBeNull()
    })
})

describe('findWWing', () => {
    it('removes the other digit from cells that see both bivalue cells', () => {
        const masks = masksFrom([
            [0, 0, [1, 2]],
            [4, 8, [1, 2]],
            [6, 0, [1, 7]], [6, 8, [1, 7]],
            [0, 8, [2, 5]],
        ])
        const step = findWWing(masks)
        expect(step).toMatchObject({ technique: 'w-wing', digit: 2, eliminations: [at(0, 8)] })
        expect(step!.detail).toMatchObject({ kind: 'w-wing', cells: [at(0, 0), at(4, 8)], linkDigit: 1 })
    })

    it('needs the two bivalue cells not to see each other', () => {
        const masks = masksFrom([
            [0, 0, [1, 2]],
            [0, 7, [1, 2]],
            [6, 0, [1]], [6, 7, [1]],
            [1, 1, [2, 5]],
        ])
        expect(findWWing(masks)).toBeNull()
    })
})

describe('findAdvancedStep', () => {
    it('returns null when no pattern exists', () => {
        expect(findAdvancedStep(new Array<number>(81).fill(0))).toBeNull()
    })

    it('prefers X-Wing over later techniques', () => {
        const masks = masksFrom([
            [0, 2, [1]], [0, 6, [1]],
            [4, 2, [1]], [4, 6, [1]],
            [7, 2, [1, 5]],
        ])
        expect(findAdvancedStep(masks)?.technique).toBe('x-wing')
    })
})
