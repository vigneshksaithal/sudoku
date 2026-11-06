/**
 * Advanced Sudoku techniques shared by the server grader and the client hint engine.
 *
 * Both sides convert their own candidate representation into a `CandidateMasks`
 * array and call `findAdvancedStep`, so a puzzle the server grades as Advanced
 * can always be explained by the client hints, step for step.
 *
 * Every technique here eliminates a single digit from one or more cells.
 */

/** 81 entries, one per cell (row-major). Bit (d - 1) set means digit d is a candidate.
 *  Solved cells must be 0. */
export type CandidateMasks = readonly number[]

export type AdvancedTechnique = 'x-wing' | 'skyscraper' | 'two-string-kite' | 'xy-wing' | 'w-wing'

/** Order in which techniques are tried, simplest first. Server and client both use it. */
export const ADVANCED_TECHNIQUES: readonly AdvancedTechnique[] = [
    'x-wing',
    'skyscraper',
    'two-string-kite',
    'xy-wing',
    'w-wing',
] as const

export type AdvancedStep = {
    technique: AdvancedTechnique
    /** Digit removed from every cell in `eliminations` */
    digit: number
    /** Cells forming the pattern (for highlighting), row-major indices */
    pattern: number[]
    /** Cells that lose `digit` */
    eliminations: number[]
    /** Technique-specific detail used to build an explanation */
    detail:
        | { kind: 'x-wing'; orientation: 'row' | 'column'; lines: [number, number]; crossLines: [number, number] }
        | { kind: 'skyscraper'; orientation: 'row' | 'column'; base: [number, number]; ends: [number, number] }
        | { kind: 'two-string-kite'; rowLink: [number, number]; colLink: [number, number]; box: number; ends: [number, number] }
        | { kind: 'xy-wing'; pivot: number; pincers: [number, number]; x: number; y: number; z: number }
        | { kind: 'w-wing'; cells: [number, number]; link: [number, number]; linkDigit: number }
}

// ─── Geometry ────────────────────────────────────────────────────────────────

export const rowOf = (cell: number): number => Math.floor(cell / 9)
export const colOf = (cell: number): number => cell % 9
export const boxOf = (cell: number): number => Math.floor(rowOf(cell) / 3) * 3 + Math.floor(colOf(cell) / 3)

export const sees = (a: number, b: number): boolean =>
    a !== b && (rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b))

const ROWS: number[][] = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c))
const COLS: number[][] = Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c))
const BOXES: number[][] = Array.from({ length: 9 }, (_, b) =>
    Array.from({ length: 9 }, (_, i) => (Math.floor(b / 3) * 3 + Math.floor(i / 3)) * 9 + (b % 3) * 3 + (i % 3)),
)
const HOUSES: number[][] = [...ROWS, ...COLS, ...BOXES]

const bit = (digit: number): number => 1 << (digit - 1)
const has = (masks: CandidateMasks, cell: number, digit: number): boolean => ((masks[cell] ?? 0) & bit(digit)) !== 0

const popcount = (mask: number): number => {
    let n = 0
    let m = mask
    while (m !== 0) {
        m &= m - 1
        n++
    }
    return n
}

const digitsOf = (mask: number): number[] => {
    const out: number[] = []
    for (let d = 1; d <= 9; d++) if (mask & bit(d)) out.push(d)
    return out
}

const cellsWith = (masks: CandidateMasks, house: readonly number[], digit: number): number[] =>
    house.filter((cell) => has(masks, cell, digit))

/** Cells (other than `exclude`) that see every cell in `targets` and still hold `digit`. */
const commonPeersWith = (
    masks: CandidateMasks,
    targets: readonly number[],
    digit: number,
    exclude: readonly number[],
): number[] => {
    const out: number[] = []
    for (let cell = 0; cell < 81; cell++) {
        if (exclude.includes(cell) || !has(masks, cell, digit)) continue
        if (targets.every((t) => sees(cell, t))) out.push(cell)
    }
    return out
}

/** Houses where `digit` has exactly two candidate cells (a strong link). */
const strongLinks = (masks: CandidateMasks, digit: number, houses: readonly number[][] = HOUSES): Array<[number, number]> => {
    const links: Array<[number, number]> = []
    const seen = new Set<string>()
    for (const house of houses) {
        const cells = cellsWith(masks, house, digit)
        if (cells.length !== 2) continue
        const key = `${cells[0]},${cells[1]}`
        if (seen.has(key)) continue
        seen.add(key)
        links.push([cells[0]!, cells[1]!])
    }
    return links
}

// ─── Techniques ──────────────────────────────────────────────────────────────

/** X-Wing: a digit is confined to the same two columns in two rows (or rows in two columns). */
export const findXWing = (masks: CandidateMasks): AdvancedStep | null => {
    for (let digit = 1; digit <= 9; digit++) {
        for (const orientation of ['row', 'column'] as const) {
            const lines = orientation === 'row' ? ROWS : COLS
            const cross = orientation === 'row' ? COLS : ROWS
            const crossIndex = orientation === 'row' ? colOf : rowOf
            const positions = lines.map((line) => cellsWith(masks, line, digit))
            for (let a = 0; a < 9; a++) {
                const pa = positions[a]!
                if (pa.length !== 2) continue
                for (let b = a + 1; b < 9; b++) {
                    const pb = positions[b]!
                    if (pb.length !== 2) continue
                    const x1 = crossIndex(pa[0]!)
                    const x2 = crossIndex(pa[1]!)
                    if (crossIndex(pb[0]!) !== x1 || crossIndex(pb[1]!) !== x2) continue
                    const pattern = [pa[0]!, pa[1]!, pb[0]!, pb[1]!]
                    const eliminations = [...cross[x1]!, ...cross[x2]!].filter(
                        (cell) => !pattern.includes(cell) && has(masks, cell, digit),
                    )
                    if (eliminations.length === 0) continue
                    return {
                        technique: 'x-wing',
                        digit,
                        pattern,
                        eliminations,
                        detail: { kind: 'x-wing', orientation, lines: [a, b], crossLines: [x1, x2] },
                    }
                }
            }
        }
    }
    return null
}

/** Skyscraper: two parallel strong links that share one end line; the other ends
 *  cannot both be false, so cells seeing both lose the digit. */
export const findSkyscraper = (masks: CandidateMasks): AdvancedStep | null => {
    for (let digit = 1; digit <= 9; digit++) {
        for (const orientation of ['row', 'column'] as const) {
            const lines = orientation === 'row' ? ROWS : COLS
            const crossIndex = orientation === 'row' ? colOf : rowOf
            const links = strongLinks(masks, digit, lines)
            for (let i = 0; i < links.length; i++) {
                for (let j = i + 1; j < links.length; j++) {
                    const l1 = links[i]!
                    const l2 = links[j]!
                    for (const [base1, end1] of [[l1[0], l1[1]], [l1[1], l1[0]]] as const) {
                        for (const [base2, end2] of [[l2[0], l2[1]], [l2[1], l2[0]]] as const) {
                            if (crossIndex(base1) !== crossIndex(base2)) continue
                            if (crossIndex(end1) === crossIndex(end2)) continue // X-Wing
                            const pattern = [base1, end1, base2, end2]
                            const eliminations = commonPeersWith(masks, [end1, end2], digit, pattern)
                            if (eliminations.length === 0) continue
                            return {
                                technique: 'skyscraper',
                                digit,
                                pattern,
                                eliminations,
                                detail: { kind: 'skyscraper', orientation, base: [base1, base2], ends: [end1, end2] },
                            }
                        }
                    }
                }
            }
        }
    }
    return null
}

/** 2-String Kite: a row strong link and a column strong link with one end of each in
 *  the same box. The far ends cannot both be false. */
export const findTwoStringKite = (masks: CandidateMasks): AdvancedStep | null => {
    for (let digit = 1; digit <= 9; digit++) {
        const rowLinks = strongLinks(masks, digit, ROWS)
        const colLinks = strongLinks(masks, digit, COLS)
        for (const rl of rowLinks) {
            for (const cl of colLinks) {
                for (const [rowBoxEnd, rowEnd] of [[rl[0], rl[1]], [rl[1], rl[0]]] as const) {
                    for (const [colBoxEnd, colEnd] of [[cl[0], cl[1]], [cl[1], cl[0]]] as const) {
                        const cells = new Set([rowBoxEnd, rowEnd, colBoxEnd, colEnd])
                        if (cells.size !== 4) continue
                        if (boxOf(rowBoxEnd) !== boxOf(colBoxEnd)) continue
                        if (boxOf(rowEnd) === boxOf(rowBoxEnd) || boxOf(colEnd) === boxOf(colBoxEnd)) continue
                        const pattern = [rowEnd, rowBoxEnd, colBoxEnd, colEnd]
                        const eliminations = commonPeersWith(masks, [rowEnd, colEnd], digit, pattern)
                        if (eliminations.length === 0) continue
                        return {
                            technique: 'two-string-kite',
                            digit,
                            pattern,
                            eliminations,
                            detail: {
                                kind: 'two-string-kite',
                                rowLink: [rowEnd, rowBoxEnd],
                                colLink: [colBoxEnd, colEnd],
                                box: boxOf(rowBoxEnd),
                                ends: [rowEnd, colEnd],
                            },
                        }
                    }
                }
            }
        }
    }
    return null
}

const bivalueCells = (masks: CandidateMasks): number[] => {
    const out: number[] = []
    for (let cell = 0; cell < 81; cell++) if (popcount(masks[cell] ?? 0) === 2) out.push(cell)
    return out
}

/** XY-Wing: pivot {x,y} sees pincers {x,z} and {y,z}; whichever pincer is z,
 *  cells seeing both pincers lose z. */
export const findXYWing = (masks: CandidateMasks): AdvancedStep | null => {
    const bivalues = bivalueCells(masks)
    for (const pivot of bivalues) {
        const pivotMask = masks[pivot]!
        const [x, y] = digitsOf(pivotMask) as [number, number]
        const wings = bivalues.filter((cell) => sees(cell, pivot))
        for (const w1 of wings) {
            const m1 = masks[w1]!
            if ((m1 & bit(x)) === 0 || (m1 & bit(y)) !== 0) continue
            const zMask = m1 & ~bit(x)
            const z = digitsOf(zMask)[0]!
            for (const w2 of wings) {
                if (w2 === w1) continue
                if (masks[w2]! !== (bit(y) | zMask)) continue
                const pattern = [pivot, w1, w2]
                const eliminations = commonPeersWith(masks, [w1, w2], z, pattern)
                if (eliminations.length === 0) continue
                return {
                    technique: 'xy-wing',
                    digit: z,
                    pattern,
                    eliminations,
                    detail: { kind: 'xy-wing', pivot, pincers: [w1, w2], x, y, z },
                }
            }
        }
    }
    return null
}

/** W-Wing: two identical bivalue cells {x,y} that don't see each other, joined by a
 *  strong link on x. At least one of them must be y. */
export const findWWing = (masks: CandidateMasks): AdvancedStep | null => {
    const bivalues = bivalueCells(masks)
    for (let i = 0; i < bivalues.length; i++) {
        for (let j = i + 1; j < bivalues.length; j++) {
            const a = bivalues[i]!
            const b = bivalues[j]!
            if (masks[a] !== masks[b] || sees(a, b)) continue
            const pair = digitsOf(masks[a]!)
            for (const linkDigit of pair) {
                const otherDigit = pair.find((d) => d !== linkDigit)!
                for (const [u, v] of strongLinks(masks, linkDigit)) {
                    for (const [nearA, nearB] of [[u, v], [v, u]] as const) {
                        if ([a, b].includes(nearA) || [a, b].includes(nearB)) continue
                        if (!sees(nearA, a) || !sees(nearB, b)) continue
                        const pattern = [a, nearA, nearB, b]
                        const eliminations = commonPeersWith(masks, [a, b], otherDigit, pattern)
                        if (eliminations.length === 0) continue
                        return {
                            technique: 'w-wing',
                            digit: otherDigit,
                            pattern,
                            eliminations,
                            detail: { kind: 'w-wing', cells: [a, b], link: [nearA, nearB], linkDigit },
                        }
                    }
                }
            }
        }
    }
    return null
}

const FINDERS: Record<AdvancedTechnique, (masks: CandidateMasks) => AdvancedStep | null> = {
    'x-wing': findXWing,
    skyscraper: findSkyscraper,
    'two-string-kite': findTwoStringKite,
    'xy-wing': findXYWing,
    'w-wing': findWWing,
}

/** First advanced step available, trying techniques in `ADVANCED_TECHNIQUES` order. */
export const findAdvancedStep = (masks: CandidateMasks): AdvancedStep | null => {
    for (const technique of ADVANCED_TECHNIQUES) {
        const step = FINDERS[technique](masks)
        if (step !== null) return step
    }
    return null
}

/** Human-readable cell name, e.g. R3C4. */
export const cellName = (cell: number): string => `R${rowOf(cell) + 1}C${colOf(cell) + 1}`
