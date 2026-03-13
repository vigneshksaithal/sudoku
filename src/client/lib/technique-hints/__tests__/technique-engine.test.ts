import { describe, expect, it, vi } from 'vitest'
import type { CandidateBoard, CellState, TechniqueHint } from '../../types'

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('../naked-single', () => ({ detectNakedSingle: vi.fn(() => null) }))
vi.mock('../hidden-single', () => ({ detectHiddenSingle: vi.fn(() => null) }))
vi.mock('../naked-pair', () => ({ detectNakedPair: vi.fn(() => null) }))
vi.mock('../hidden-pair', () => ({ detectHiddenPair: vi.fn(() => null) }))
vi.mock('../pointing-pair', () => ({ detectPointingPair: vi.fn(() => null) }))
vi.mock('../box-line-reduction', () => ({ detectBoxLineReduction: vi.fn(() => null) }))

import { detectNakedSingle } from '../naked-single'
import { detectHiddenSingle } from '../hidden-single'
import { detectNakedPair } from '../naked-pair'
import { detectHiddenPair } from '../hidden-pair'
import { detectPointingPair } from '../pointing-pair'
import { detectBoxLineReduction } from '../box-line-reduction'
import { findTechniqueHint } from '../technique-engine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyCell = (): CellState => ({ value: 0, isGiven: false, hasConflict: false })
const filledCell = (v: number): CellState => ({ value: v, isGiven: true, hasConflict: false })

const emptyBoard = (): CellState[][] =>
    Array.from({ length: 9 }, () => Array.from({ length: 9 }, emptyCell))

const fullBoard = (): CellState[][] =>
    Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => filledCell(((r * 9 + c) % 9) + 1))
    )

const emptyCandidates = (): CandidateBoard =>
    Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, () => new Set<number>())
    )

const solution = Array(81).fill(1) as number[]

const makeHint = (technique: TechniqueHint['technique']): TechniqueHint => ({
    technique,
    difficulty: technique === 'naked-single' || technique === 'hidden-single' ? 'easy'
        : technique === 'naked-pair' || technique === 'hidden-pair' ? 'medium'
            : 'hard',
    title: technique,
    description: '',
    primaryCells: [[0, 0]],
    secondaryCells: [],
    action: technique === 'naked-single' || technique === 'hidden-single' ? 'placement' : 'elimination',
    digit: 1,
})

const mockNakedSingle = vi.mocked(detectNakedSingle)
const mockHiddenSingle = vi.mocked(detectHiddenSingle)
const mockNakedPair = vi.mocked(detectNakedPair)
const mockHiddenPair = vi.mocked(detectHiddenPair)
const mockPointingPair = vi.mocked(detectPointingPair)
const mockBoxLineReduction = vi.mocked(detectBoxLineReduction)

const resetMocks = (): void => {
    mockNakedSingle.mockReset().mockReturnValue(null)
    mockHiddenSingle.mockReset().mockReturnValue(null)
    mockNakedPair.mockReset().mockReturnValue(null)
    mockHiddenPair.mockReset().mockReturnValue(null)
    mockPointingPair.mockReset().mockReturnValue(null)
    mockBoxLineReduction.mockReset().mockReturnValue(null)
}

// ---------------------------------------------------------------------------
// Test 1: Returns null on a complete board (all cells filled)
// ---------------------------------------------------------------------------

describe('findTechniqueHint — complete board', () => {
    it('returns null when all cells are filled', () => {
        resetMocks()
        const hint = findTechniqueHint(fullBoard(), emptyCandidates(), solution)
        expect(hint).toBeNull()
    })

    it('does not call any detector when board is complete', () => {
        resetMocks()
        findTechniqueHint(fullBoard(), emptyCandidates(), solution)
        expect(mockNakedSingle).not.toHaveBeenCalled()
        expect(mockHiddenSingle).not.toHaveBeenCalled()
        expect(mockNakedPair).not.toHaveBeenCalled()
        expect(mockHiddenPair).not.toHaveBeenCalled()
        expect(mockPointingPair).not.toHaveBeenCalled()
        expect(mockBoxLineReduction).not.toHaveBeenCalled()
    })
})

// ---------------------------------------------------------------------------
// Test 2: Returns null when no techniques apply
// ---------------------------------------------------------------------------

describe('findTechniqueHint — no techniques apply', () => {
    it('returns null when all detectors return null', () => {
        resetMocks()
        const hint = findTechniqueHint(emptyBoard(), emptyCandidates(), solution)
        expect(hint).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Test 3: Naked Single wins over all others (highest priority)
// ---------------------------------------------------------------------------

describe('findTechniqueHint — naked single priority', () => {
    it('returns naked-single hint when naked single is available', () => {
        resetMocks()
        const nakedHint = makeHint('naked-single')
        mockNakedSingle.mockReturnValue(nakedHint)
        mockHiddenSingle.mockReturnValue(makeHint('hidden-single'))
        mockNakedPair.mockReturnValue(makeHint('naked-pair'))

        const hint = findTechniqueHint(emptyBoard(), emptyCandidates(), solution)

        expect(hint).not.toBeNull()
        expect(hint!.technique).toBe('naked-single')
    })

    it('returns naked-single even when all other detectors also return hints', () => {
        resetMocks()
        mockNakedSingle.mockReturnValue(makeHint('naked-single'))
        mockHiddenSingle.mockReturnValue(makeHint('hidden-single'))
        mockNakedPair.mockReturnValue(makeHint('naked-pair'))
        mockHiddenPair.mockReturnValue(makeHint('hidden-pair'))
        mockPointingPair.mockReturnValue(makeHint('pointing-pair'))
        mockBoxLineReduction.mockReturnValue(makeHint('box-line-reduction'))

        const hint = findTechniqueHint(emptyBoard(), emptyCandidates(), solution)

        expect(hint!.technique).toBe('naked-single')
    })
})

// ---------------------------------------------------------------------------
// Test 4: Hidden Single wins over naked-pair and below
// ---------------------------------------------------------------------------

describe('findTechniqueHint — hidden single priority', () => {
    it('returns hidden-single when naked-single is null but hidden-single is available', () => {
        resetMocks()
        mockHiddenSingle.mockReturnValue(makeHint('hidden-single'))
        mockNakedPair.mockReturnValue(makeHint('naked-pair'))
        mockHiddenPair.mockReturnValue(makeHint('hidden-pair'))

        const hint = findTechniqueHint(emptyBoard(), emptyCandidates(), solution)

        expect(hint!.technique).toBe('hidden-single')
    })
})

// ---------------------------------------------------------------------------
// Test 5: Naked Pair wins over hidden-pair and below
// ---------------------------------------------------------------------------

describe('findTechniqueHint — naked pair priority', () => {
    it('returns naked-pair when naked/hidden singles are null', () => {
        resetMocks()
        mockNakedPair.mockReturnValue(makeHint('naked-pair'))
        mockHiddenPair.mockReturnValue(makeHint('hidden-pair'))
        mockPointingPair.mockReturnValue(makeHint('pointing-pair'))

        const hint = findTechniqueHint(emptyBoard(), emptyCandidates(), solution)

        expect(hint!.technique).toBe('naked-pair')
    })
})

// ---------------------------------------------------------------------------
// Test 6: Hidden Pair wins over pointing-pair and box-line-reduction
// ---------------------------------------------------------------------------

describe('findTechniqueHint — hidden pair priority', () => {
    it('returns hidden-pair when singles and naked-pair are null', () => {
        resetMocks()
        mockHiddenPair.mockReturnValue(makeHint('hidden-pair'))
        mockPointingPair.mockReturnValue(makeHint('pointing-pair'))
        mockBoxLineReduction.mockReturnValue(makeHint('box-line-reduction'))

        const hint = findTechniqueHint(emptyBoard(), emptyCandidates(), solution)

        expect(hint!.technique).toBe('hidden-pair')
    })
})

// ---------------------------------------------------------------------------
// Test 7: Pointing Pair wins over box-line-reduction
// ---------------------------------------------------------------------------

describe('findTechniqueHint — pointing pair priority', () => {
    it('returns pointing-pair when all higher-priority detectors return null', () => {
        resetMocks()
        mockPointingPair.mockReturnValue(makeHint('pointing-pair'))
        mockBoxLineReduction.mockReturnValue(makeHint('box-line-reduction'))

        const hint = findTechniqueHint(emptyBoard(), emptyCandidates(), solution)

        expect(hint!.technique).toBe('pointing-pair')
    })
})

// ---------------------------------------------------------------------------
// Test 8: Box/Line Reduction is last resort
// ---------------------------------------------------------------------------

describe('findTechniqueHint — box/line reduction priority', () => {
    it('returns box-line-reduction when all other detectors return null', () => {
        resetMocks()
        mockBoxLineReduction.mockReturnValue(makeHint('box-line-reduction'))

        const hint = findTechniqueHint(emptyBoard(), emptyCandidates(), solution)

        expect(hint!.technique).toBe('box-line-reduction')
    })
})

// ---------------------------------------------------------------------------
// Test 9: Pipeline ordering — each step is only reached if previous returns null
// ---------------------------------------------------------------------------

describe('findTechniqueHint — pipeline short-circuits', () => {
    it('does not call lower-priority detectors once naked-single returns a hint', () => {
        resetMocks()
        mockNakedSingle.mockReturnValue(makeHint('naked-single'))

        findTechniqueHint(emptyBoard(), emptyCandidates(), solution)

        expect(mockHiddenSingle).not.toHaveBeenCalled()
        expect(mockNakedPair).not.toHaveBeenCalled()
        expect(mockHiddenPair).not.toHaveBeenCalled()
        expect(mockPointingPair).not.toHaveBeenCalled()
        expect(mockBoxLineReduction).not.toHaveBeenCalled()
    })

    it('does not call lower-priority detectors once hidden-single returns a hint', () => {
        resetMocks()
        mockHiddenSingle.mockReturnValue(makeHint('hidden-single'))

        findTechniqueHint(emptyBoard(), emptyCandidates(), solution)

        expect(mockNakedPair).not.toHaveBeenCalled()
        expect(mockHiddenPair).not.toHaveBeenCalled()
        expect(mockPointingPair).not.toHaveBeenCalled()
        expect(mockBoxLineReduction).not.toHaveBeenCalled()
    })

    it('calls all detectors when all return null', () => {
        resetMocks()

        findTechniqueHint(emptyBoard(), emptyCandidates(), solution)

        expect(mockNakedSingle).toHaveBeenCalledOnce()
        expect(mockHiddenSingle).toHaveBeenCalledOnce()
        expect(mockNakedPair).toHaveBeenCalledOnce()
        expect(mockHiddenPair).toHaveBeenCalledOnce()
        expect(mockPointingPair).toHaveBeenCalledOnce()
        expect(mockBoxLineReduction).toHaveBeenCalledOnce()
    })
})
