// ─── Type Definitions ─────────────────────────────────────────────────────────

export type LogType =
    | 'given'
    | 'single'
    | 'hiddenSingleRow' | 'hiddenSingleColumn' | 'hiddenSingleSection'
    | 'nakedPairRow' | 'nakedPairColumn' | 'nakedPairSection'
    | 'pointingPairTripleRow' | 'pointingPairTripleColumn'
    | 'rowBox' | 'columnBox'
    | 'hiddenPairRow' | 'hiddenPairColumn' | 'hiddenPairSection'
    | 'guess' | 'rollback'

export type LogItem = {
    round: number
    type: LogType
    value: number     // digit 1–9, or 0 if not applicable
    position: number  // cell index 0–80, or -1 if not applicable
}

export type Symmetry = 'none' | 'rotate180' | 'rotate90' | 'mirror' | 'flip'

export type Difficulty = 'simple' | 'easy' | 'intermediate' | 'expert'

export type SolveStats = Record<LogType, number>

// ─── Index Math ───────────────────────────────────────────────────────────────

/** Convert (valueIndex, cell) to possibilities array index */
export const possibilityIndex = (valueIndex: number, cell: number): number =>
    valueIndex + 9 * cell

/** Cell index to row (0–8) */
export const cellToRow = (cell: number): number => Math.floor(cell / 9)

/** Cell index to column (0–8) */
export const cellToCol = (cell: number): number => cell % 9

/** Cell index to box (0–8) */
export const cellToBox = (cell: number): number => {
    const row = cellToRow(cell)
    const col = cellToCol(cell)
    return Math.floor(row / 3) * 3 + Math.floor(col / 3)
}

/** Row and column to cell index */
export const rowColToCell = (row: number, col: number): number => row * 9 + col

// ─── Peer Computation ─────────────────────────────────────────────────────────

/** Return the 20 peer cell indices for a given cell (same row, col, or box, excluding self) */
export const getPeers = (cell: number): number[] => {
    const row = cellToRow(cell)
    const col = cellToCol(cell)
    const peers = new Set<number>()

    // Same row
    for (let c = 0; c < 9; c++) peers.add(rowColToCell(row, c))
    // Same column
    for (let r = 0; r < 9; r++) peers.add(rowColToCell(r, col))
    // Same box
    const boxRow = Math.floor(row / 3) * 3
    const boxCol = Math.floor(col / 3) * 3
    for (let r = boxRow; r < boxRow + 3; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) {
            peers.add(rowColToCell(r, c))
        }
    }

    peers.delete(cell)
    return [...peers]
}

// ─── Solver State ─────────────────────────────────────────────────────────────

export type SolverState = {
    solution: number[]        // length 81, 0 = unsolved
    solutionRound: number[]   // length 81, round when each cell was placed
    possibilities: number[]   // length 729, 0 = still possible, >0 = round eliminated
    solveLog: LogItem[]
    round: number
    recordHistory: boolean
}

/** Initialize solver state from a puzzle array (givens are pre-marked at round 0) */
// Round 1 is reserved for given-cell eliminations in the possibilities array.
// Round 0 is used only in solutionRound[] to identify given cells in the log.
// This avoids the ambiguity where possibilities[i] === 0 means "still possible".
const GIVEN_ROUND = 1

export const createSolverState = (puzzle: number[], recordHistory = false): SolverState => {
    const state: SolverState = {
        solution: new Array(81).fill(0) as number[],
        solutionRound: new Array(81).fill(0) as number[],
        possibilities: new Array(729).fill(0) as number[],
        solveLog: [],
        round: 2,
        recordHistory,
    }
    for (let cell = 0; cell < 81; cell++) {
        const value = puzzle[cell]
        if (value !== undefined && value !== 0) {
            // Use GIVEN_ROUND (1) for possibilities eliminations so they're non-zero.
            // Use 0 in solutionRound to identify givens for log purposes.
            mark(state, cell, GIVEN_ROUND, value)
            state.solutionRound[cell] = 0
            if (recordHistory) {
                // Replace all GIVEN_ROUND log entries from this mark with a single 'given' entry
                state.solveLog = state.solveLog.filter((e) => e.round !== GIVEN_ROUND)
                state.solveLog.push({ round: 0, type: 'given', value, position: cell })
            }
        }
    }
    return state
}

/** Place a value at a cell, eliminating candidates from peers and self, tagged with round */
export const mark = (state: SolverState, position: number, round: number, value: number): void => {
    state.solution[position] = value
    state.solutionRound[position] = round

    const valueIndex = value - 1
    const peers = getPeers(position)

    // Eliminate this value from all 20 peers
    for (const peer of peers) {
        const idx = possibilityIndex(valueIndex, peer)
        if (state.possibilities[idx] === 0) {
            state.possibilities[idx] = round
            if (state.recordHistory) {
                state.solveLog.push({ round, type: 'given', value, position: peer })
            }
        }
    }

    // Eliminate all other candidates from this cell
    for (let vi = 0; vi < 9; vi++) {
        if (vi !== valueIndex) {
            const idx = possibilityIndex(vi, position)
            if (state.possibilities[idx] === 0) {
                state.possibilities[idx] = round
                if (state.recordHistory) {
                    state.solveLog.push({ round, type: 'given', value: vi + 1, position })
                }
            }
        }
    }
}

/** Undo all placements and eliminations from a specific round */
export const rollbackRound = (state: SolverState, round: number): void => {
    // Never roll back round 0 (given placements) or round 1 (given eliminations)
    if (round <= 1) return
    // Restore solution entries placed in this round
    for (let cell = 0; cell < 81; cell++) {
        if (state.solutionRound[cell] === round) {
            state.solution[cell] = 0
            state.solutionRound[cell] = 0
        }
    }
    // Restore possibilities entries tagged with this round
    for (let i = 0; i < 729; i++) {
        if (state.possibilities[i] === round) {
            state.possibilities[i] = 0
        }
    }
    // Remove log entries from this round
    state.solveLog = state.solveLog.filter((e) => e.round !== round)
}

// ─── State Helpers (pure — take state arrays as parameters) ──────────────────

/** Count remaining candidates for a cell (entries equal to 0 in possibilities[cell*9 .. cell*9+8]) */
export const countPossibilities = (cell: number, possibilities: number[]): number => {
    let count = 0
    for (let v = 0; v < 9; v++) {
        if (possibilities[possibilityIndex(v, cell)] === 0) count++
    }
    return count
}

/** Check if a specific candidate is still possible for a cell */
export const isPossible = (cell: number, valueIndex: number, possibilities: number[]): boolean =>
    possibilities[possibilityIndex(valueIndex, cell)] === 0

/** Check if the puzzle is fully solved (all 81 cells have non-zero values) */
export const isSolved = (solution: number[]): boolean =>
    solution.every((v) => v !== 0)

/** Check if the puzzle is impossible (any unsolved cell has 0 remaining candidates) */
export const isImpossible = (solution: number[], possibilities: number[]): boolean =>
    solution.some((v, cell) => v === 0 && countPossibilities(cell, possibilities) === 0)

// ─── Techniques ──────────────────────────────────────────────────────────────

/** Naked Single: scan all 81 cells; place value when exactly 1 candidate remains.
 *  Returns true if any placement was made. */
export const onlyPossibilityForCell = (state: SolverState, round: number): boolean => {
    for (let cell = 0; cell < 81; cell++) {
        if (state.solution[cell] !== 0) continue
        let count = 0
        let lastValueIndex = -1
        for (let vi = 0; vi < 9; vi++) {
            if (state.possibilities[possibilityIndex(vi, cell)] === 0) {
                count++
                lastValueIndex = vi
            }
        }
        if (count !== 1 || lastValueIndex === -1) continue
        const value = lastValueIndex + 1
        mark(state, cell, round, value)
        if (state.recordHistory) {
            // Replace the generic 'given' log entry added by mark with a 'single' entry
            state.solveLog = state.solveLog.filter(
                (e) => !(e.round === round && e.type === 'given' && e.position === cell && e.value === value)
            )
            state.solveLog.push({ round, type: 'single', value, position: cell })
        }
        return true
    }
    return false
}

/** Hidden Single in box: candidate appears in only 1 cell within a box → place it.
 *  Returns true if any placement was made. */
export const onlyValueInSection = (state: SolverState, round: number): boolean => {
    for (let box = 0; box < 9; box++) {
        const boxRow = Math.floor(box / 3) * 3
        const boxCol = (box % 3) * 3
        const cells: number[] = []
        for (let r = boxRow; r < boxRow + 3; r++)
            for (let c = boxCol; c < boxCol + 3; c++)
                cells.push(rowColToCell(r, c))

        for (let vi = 0; vi < 9; vi++) {
            let count = 0
            let lastCell = -1
            for (const cell of cells) {
                if (state.solution[cell] !== 0) continue
                if (state.possibilities[possibilityIndex(vi, cell)] === 0) {
                    count++
                    lastCell = cell
                }
            }
            if (count !== 1 || lastCell === -1) continue
            const value = vi + 1
            mark(state, lastCell, round, value)
            if (state.recordHistory) {
                state.solveLog = state.solveLog.filter(
                    (e) => !(e.round === round && e.type === 'given' && e.position === lastCell && e.value === value)
                )
                state.solveLog.push({ round, type: 'hiddenSingleSection', value, position: lastCell })
            }
            return true
        }
    }
    return false
}

/** Hidden Single in row: candidate appears in only 1 cell within a row → place it.
 *  Returns true if any placement was made. */
export const onlyValueInRow = (state: SolverState, round: number): boolean => {
    for (let row = 0; row < 9; row++) {
        for (let vi = 0; vi < 9; vi++) {
            let count = 0
            let lastCell = -1
            for (let col = 0; col < 9; col++) {
                const cell = rowColToCell(row, col)
                if (state.solution[cell] !== 0) continue
                if (state.possibilities[possibilityIndex(vi, cell)] === 0) {
                    count++
                    lastCell = cell
                }
            }
            if (count !== 1 || lastCell === -1) continue
            const value = vi + 1
            mark(state, lastCell, round, value)
            if (state.recordHistory) {
                state.solveLog = state.solveLog.filter(
                    (e) => !(e.round === round && e.type === 'given' && e.position === lastCell && e.value === value)
                )
                state.solveLog.push({ round, type: 'hiddenSingleRow', value, position: lastCell })
            }
            return true
        }
    }
    return false
}

/** Hidden Single in column: candidate appears in only 1 cell within a column → place it.
 *  Returns true if any placement was made. */
export const onlyValueInColumn = (state: SolverState, round: number): boolean => {
    for (let col = 0; col < 9; col++) {
        for (let vi = 0; vi < 9; vi++) {
            let count = 0
            let lastCell = -1
            for (let row = 0; row < 9; row++) {
                const cell = rowColToCell(row, col)
                if (state.solution[cell] !== 0) continue
                if (state.possibilities[possibilityIndex(vi, cell)] === 0) {
                    count++
                    lastCell = cell
                }
            }
            if (count !== 1 || lastCell === -1) continue
            const value = vi + 1
            mark(state, lastCell, round, value)
            if (state.recordHistory) {
                state.solveLog = state.solveLog.filter(
                    (e) => !(e.round === round && e.type === 'given' && e.position === lastCell && e.value === value)
                )
                state.solveLog.push({ round, type: 'hiddenSingleColumn', value, position: lastCell })
            }
            return true
        }
    }
    return false
}

// ─── Stub Techniques (implemented in later tasks) ────────────────────────────

/** Get the set of candidate value indices still possible for a cell */
const getCandidates = (cell: number, possibilities: number[]): number[] => {
    const candidates: number[] = []
    for (let vi = 0; vi < 9; vi++) {
        if (possibilities[possibilityIndex(vi, cell)] === 0) candidates.push(vi)
    }
    return candidates
}

/** Eliminate two candidates from all cells in a house except the pair cells.
 *  Returns true if any elimination was made. */
const eliminatePairFromHouse = (
    state: SolverState,
    houseCells: number[],
    pairCellA: number,
    pairCellB: number,
    vi1: number,
    vi2: number,
    round: number
): boolean => {
    let eliminated = false
    for (const cell of houseCells) {
        if (cell === pairCellA || cell === pairCellB) continue
        if (state.solution[cell] !== 0) continue
        for (const vi of [vi1, vi2]) {
            if (state.possibilities[possibilityIndex(vi, cell)] === 0) {
                state.possibilities[possibilityIndex(vi, cell)] = round
                eliminated = true
            }
        }
    }
    return eliminated
}

/** Naked Pairs in row/col/box: two cells sharing exactly 2 candidates → eliminate from peers */
export const handleNakedPairs = (state: SolverState, round: number): boolean => {
    // Rows first (Req 5.5)
    for (let row = 0; row < 9; row++) {
        const cells = Array.from({ length: 9 }, (_, c) => rowColToCell(row, c))
        for (let i = 0; i < cells.length; i++) {
            const cellA = cells[i]!
            if (state.solution[cellA] !== 0) continue
            const candidatesA = getCandidates(cellA, state.possibilities)
            if (candidatesA.length !== 2) continue
            for (let j = i + 1; j < cells.length; j++) {
                const cellB = cells[j]!
                if (state.solution[cellB] !== 0) continue
                const candidatesB = getCandidates(cellB, state.possibilities)
                if (candidatesB.length !== 2) continue
                if (candidatesA[0] !== candidatesB[0] || candidatesA[1] !== candidatesB[1]) continue
                const [vi1, vi2] = candidatesA as [number, number]
                if (eliminatePairFromHouse(state, cells, cellA, cellB, vi1, vi2, round)) {
                    if (state.recordHistory) {
                        state.solveLog.push({ round, type: 'nakedPairRow', value: 0, position: -1 })
                    }
                    return true
                }
            }
        }
    }

    // Columns (Req 5.5)
    for (let col = 0; col < 9; col++) {
        const cells = Array.from({ length: 9 }, (_, r) => rowColToCell(r, col))
        for (let i = 0; i < cells.length; i++) {
            const cellA = cells[i]!
            if (state.solution[cellA] !== 0) continue
            const candidatesA = getCandidates(cellA, state.possibilities)
            if (candidatesA.length !== 2) continue
            for (let j = i + 1; j < cells.length; j++) {
                const cellB = cells[j]!
                if (state.solution[cellB] !== 0) continue
                const candidatesB = getCandidates(cellB, state.possibilities)
                if (candidatesB.length !== 2) continue
                if (candidatesA[0] !== candidatesB[0] || candidatesA[1] !== candidatesB[1]) continue
                const [vi1, vi2] = candidatesA as [number, number]
                if (eliminatePairFromHouse(state, cells, cellA, cellB, vi1, vi2, round)) {
                    if (state.recordHistory) {
                        state.solveLog.push({ round, type: 'nakedPairColumn', value: 0, position: -1 })
                    }
                    return true
                }
            }
        }
    }

    // Boxes (Req 5.5)
    for (let box = 0; box < 9; box++) {
        const boxRow = Math.floor(box / 3) * 3
        const boxCol = (box % 3) * 3
        const cells: number[] = []
        for (let r = boxRow; r < boxRow + 3; r++)
            for (let c = boxCol; c < boxCol + 3; c++)
                cells.push(rowColToCell(r, c))
        for (let i = 0; i < cells.length; i++) {
            const cellA = cells[i]!
            if (state.solution[cellA] !== 0) continue
            const candidatesA = getCandidates(cellA, state.possibilities)
            if (candidatesA.length !== 2) continue
            for (let j = i + 1; j < cells.length; j++) {
                const cellB = cells[j]!
                if (state.solution[cellB] !== 0) continue
                const candidatesB = getCandidates(cellB, state.possibilities)
                if (candidatesB.length !== 2) continue
                if (candidatesA[0] !== candidatesB[0] || candidatesA[1] !== candidatesB[1]) continue
                const [vi1, vi2] = candidatesA as [number, number]
                if (eliminatePairFromHouse(state, cells, cellA, cellB, vi1, vi2, round)) {
                    if (state.recordHistory) {
                        state.solveLog.push({ round, type: 'nakedPairSection', value: 0, position: -1 })
                    }
                    return true
                }
            }
        }
    }

    return false
}

/** Pointing Pairs/Triples — row: candidate confined to one row in a box → eliminate from rest of row */
export const pointingRowReduction = (state: SolverState, round: number): boolean => {
    for (let box = 0; box < 9; box++) {
        const boxStartRow = Math.floor(box / 3) * 3
        const boxStartCol = (box % 3) * 3
        for (let vi = 0; vi < 9; vi++) {
            // Collect unsolved box cells that still have this candidate
            const cells: number[] = []
            for (let r = boxStartRow; r < boxStartRow + 3; r++)
                for (let c = boxStartCol; c < boxStartCol + 3; c++) {
                    const cell = rowColToCell(r, c)
                    if (state.solution[cell] === 0 && state.possibilities[possibilityIndex(vi, cell)] === 0)
                        cells.push(cell)
                }
            if (cells.length < 2) continue
            // Check all candidate cells share the same row
            const row = cellToRow(cells[0]!)
            if (!cells.every((c) => cellToRow(c) === row)) continue
            // Eliminate from rest of that row outside the box
            let eliminated = false
            for (let col = 0; col < 9; col++) {
                if (col >= boxStartCol && col < boxStartCol + 3) continue
                const cell = rowColToCell(row, col)
                if (state.solution[cell] !== 0) continue
                if (state.possibilities[possibilityIndex(vi, cell)] === 0) {
                    state.possibilities[possibilityIndex(vi, cell)] = round
                    eliminated = true
                }
            }
            if (eliminated) {
                if (state.recordHistory)
                    state.solveLog.push({ round, type: 'pointingPairTripleRow', value: vi + 1, position: -1 })
                return true
            }
        }
    }
    return false
}

/** Pointing Pairs/Triples — column: candidate confined to one column in a box → eliminate from rest of column */
export const pointingColumnReduction = (state: SolverState, round: number): boolean => {
    for (let box = 0; box < 9; box++) {
        const boxStartRow = Math.floor(box / 3) * 3
        const boxStartCol = (box % 3) * 3
        for (let vi = 0; vi < 9; vi++) {
            // Collect unsolved box cells that still have this candidate
            const cells: number[] = []
            for (let r = boxStartRow; r < boxStartRow + 3; r++)
                for (let c = boxStartCol; c < boxStartCol + 3; c++) {
                    const cell = rowColToCell(r, c)
                    if (state.solution[cell] === 0 && state.possibilities[possibilityIndex(vi, cell)] === 0)
                        cells.push(cell)
                }
            if (cells.length < 2) continue
            // Check all candidate cells share the same column
            const col = cellToCol(cells[0]!)
            if (!cells.every((c) => cellToCol(c) === col)) continue
            // Eliminate from rest of that column outside the box
            let eliminated = false
            for (let row = 0; row < 9; row++) {
                if (row >= boxStartRow && row < boxStartRow + 3) continue
                const cell = rowColToCell(row, col)
                if (state.solution[cell] !== 0) continue
                if (state.possibilities[possibilityIndex(vi, cell)] === 0) {
                    state.possibilities[possibilityIndex(vi, cell)] = round
                    eliminated = true
                }
            }
            if (eliminated) {
                if (state.recordHistory)
                    state.solveLog.push({ round, type: 'pointingPairTripleColumn', value: vi + 1, position: -1 })
                return true
            }
        }
    }
    return false
}

/** Box/Line Reduction — row: candidate confined to one box in a row → eliminate from rest of that box */
export const rowBoxReduction = (state: SolverState, round: number): boolean => {
    for (let row = 0; row < 9; row++) {
        for (let vi = 0; vi < 9; vi++) {
            // Collect unsolved row cells that still have this candidate
            const cells: number[] = []
            for (let col = 0; col < 9; col++) {
                const cell = rowColToCell(row, col)
                if (state.solution[cell] === 0 && state.possibilities[possibilityIndex(vi, cell)] === 0)
                    cells.push(cell)
            }
            if (cells.length < 2) continue
            // Check all candidate cells share the same box
            const box = cellToBox(cells[0]!)
            if (!cells.every((c) => cellToBox(c) === box)) continue
            // Eliminate from rest of that box outside the row
            const boxStartRow = Math.floor(box / 3) * 3
            const boxStartCol = (box % 3) * 3
            let eliminated = false
            for (let r = boxStartRow; r < boxStartRow + 3; r++) {
                if (r === row) continue
                for (let col = boxStartCol; col < boxStartCol + 3; col++) {
                    const cell = rowColToCell(r, col)
                    if (state.solution[cell] !== 0) continue
                    if (state.possibilities[possibilityIndex(vi, cell)] === 0) {
                        state.possibilities[possibilityIndex(vi, cell)] = round
                        eliminated = true
                    }
                }
            }
            if (eliminated) {
                if (state.recordHistory)
                    state.solveLog.push({ round, type: 'rowBox', value: vi + 1, position: -1 })
                return true
            }
        }
    }
    return false
}

/** Box/Line Reduction — column: candidate confined to one box in a column → eliminate from rest of that box */
export const colBoxReduction = (state: SolverState, round: number): boolean => {
    for (let col = 0; col < 9; col++) {
        for (let vi = 0; vi < 9; vi++) {
            // Collect unsolved column cells that still have this candidate
            const cells: number[] = []
            for (let row = 0; row < 9; row++) {
                const cell = rowColToCell(row, col)
                if (state.solution[cell] === 0 && state.possibilities[possibilityIndex(vi, cell)] === 0)
                    cells.push(cell)
            }
            if (cells.length < 2) continue
            // Check all candidate cells share the same box
            const box = cellToBox(cells[0]!)
            if (!cells.every((c) => cellToBox(c) === box)) continue
            // Eliminate from rest of that box outside the column
            const boxStartRow = Math.floor(box / 3) * 3
            const boxStartCol = (box % 3) * 3
            let eliminated = false
            for (let c = boxStartCol; c < boxStartCol + 3; c++) {
                if (c === col) continue
                for (let row = boxStartRow; row < boxStartRow + 3; row++) {
                    const cell = rowColToCell(row, c)
                    if (state.solution[cell] !== 0) continue
                    if (state.possibilities[possibilityIndex(vi, cell)] === 0) {
                        state.possibilities[possibilityIndex(vi, cell)] = round
                        eliminated = true
                    }
                }
            }
            if (eliminated) {
                if (state.recordHistory)
                    state.solveLog.push({ round, type: 'columnBox', value: vi + 1, position: -1 })
                return true
            }
        }
    }
    return false
}

/** Eliminate all candidates except vi1 and vi2 from a cell. Returns true if any elimination was made. */
const eliminateOtherCandidates = (
    state: SolverState,
    cell: number,
    vi1: number,
    vi2: number,
    round: number
): boolean => {
    let eliminated = false
    for (let vi = 0; vi < 9; vi++) {
        if (vi === vi1 || vi === vi2) continue
        if (state.possibilities[possibilityIndex(vi, cell)] === 0) {
            state.possibilities[possibilityIndex(vi, cell)] = round
            eliminated = true
        }
    }
    return eliminated
}

/** Apply hidden pair elimination to a house (array of 9 cells). Returns true if progress was made. */
const hiddenPairInHouse = (
    state: SolverState,
    houseCells: number[],
    round: number,
    logType: 'hiddenPairRow' | 'hiddenPairColumn' | 'hiddenPairSection'
): boolean => {
    for (let vi1 = 0; vi1 < 8; vi1++) {
        const cells1 = houseCells.filter(
            (c) => state.solution[c] === 0 && state.possibilities[possibilityIndex(vi1, c)] === 0
        )
        if (cells1.length !== 2) continue
        for (let vi2 = vi1 + 1; vi2 < 9; vi2++) {
            const cells2 = houseCells.filter(
                (c) => state.solution[c] === 0 && state.possibilities[possibilityIndex(vi2, c)] === 0
            )
            if (cells2.length !== 2) continue
            if (cells1[0] !== cells2[0] || cells1[1] !== cells2[1]) continue
            // Found hidden pair: vi1 and vi2 appear in exactly the same two cells
            const elim1 = eliminateOtherCandidates(state, cells1[0]!, vi1, vi2, round)
            const elim2 = eliminateOtherCandidates(state, cells1[1]!, vi1, vi2, round)
            if (elim1 || elim2) {
                if (state.recordHistory)
                    state.solveLog.push({ round, type: logType, value: 0, position: -1 })
                return true
            }
        }
    }
    return false
}

/** Hidden Pairs in row: two candidates in only the same two cells → eliminate other candidates */
export const hiddenPairInRow = (state: SolverState, round: number): boolean => {
    for (let row = 0; row < 9; row++) {
        const houseCells = Array.from({ length: 9 }, (_, col) => rowColToCell(row, col))
        if (hiddenPairInHouse(state, houseCells, round, 'hiddenPairRow')) return true
    }
    return false
}

/** Hidden Pairs in column: two candidates in only the same two cells → eliminate other candidates */
export const hiddenPairInColumn = (state: SolverState, round: number): boolean => {
    for (let col = 0; col < 9; col++) {
        const houseCells = Array.from({ length: 9 }, (_, row) => rowColToCell(row, col))
        if (hiddenPairInHouse(state, houseCells, round, 'hiddenPairColumn')) return true
    }
    return false
}

/** Hidden Pairs in box: two candidates in only the same two cells → eliminate other candidates */
export const hiddenPairInSection = (state: SolverState, round: number): boolean => {
    for (let box = 0; box < 9; box++) {
        const boxStartRow = Math.floor(box / 3) * 3
        const boxStartCol = (box % 3) * 3
        const houseCells: number[] = []
        for (let r = boxStartRow; r < boxStartRow + 3; r++)
            for (let c = boxStartCol; c < boxStartCol + 3; c++)
                houseCells.push(rowColToCell(r, c))
        if (hiddenPairInHouse(state, houseCells, round, 'hiddenPairSection')) return true
    }
    return false
}

// ─── Solve Loop ───────────────────────────────────────────────────────────────

/** Apply one technique step in fixed order. Returns true if progress was made. */
export const singleSolveMove = (state: SolverState, round: number): boolean =>
    onlyPossibilityForCell(state, round) ||
    onlyValueInSection(state, round) ||
    onlyValueInRow(state, round) ||
    onlyValueInColumn(state, round) ||
    handleNakedPairs(state, round) ||
    pointingRowReduction(state, round) ||
    pointingColumnReduction(state, round) ||
    rowBoxReduction(state, round) ||
    colBoxReduction(state, round) ||
    hiddenPairInRow(state, round) ||
    hiddenPairInColumn(state, round) ||
    hiddenPairInSection(state, round)

/** Main solve loop. Applies logic, falls back to guess-and-backtrack. Returns true if solved. */
export const solve = (state: SolverState): boolean => {
    // Apply logical techniques until no progress
    while (singleSolveMove(state, state.round)) {
        if (isSolved(state.solution)) return true
        if (isImpossible(state.solution, state.possibilities)) return false
    }

    if (isSolved(state.solution)) return true
    if (isImpossible(state.solution, state.possibilities)) return false

    // Find unsolved cell with fewest candidates (Req 10.1)
    let minCandidates = 10
    let bestCell = -1
    for (let cell = 0; cell < 81; cell++) {
        if (state.solution[cell] !== 0) continue
        const count = countPossibilities(cell, state.possibilities)
        if (count > 0 && count < minCandidates) {
            minCandidates = count
            bestCell = cell
        }
    }

    if (bestCell === -1) return false

    // Save round before guessing so we can restore on backtrack
    const savedRound = state.round

    // Odd round for guess, even round for next deductions (Req 10.6)
    const guessRound = savedRound + 1
    const deductionRound = savedRound + 2

    // Try each candidate in randomized order (Req 10.2)
    const candidates = shuffled(Array.from({ length: 9 }, (_, i) => i))
    for (const vi of candidates) {
        if (!isPossible(bestCell, vi, state.possibilities)) continue

        const value = vi + 1
        state.round = deductionRound

        // Log guess before marking (Req 10.4)
        if (state.recordHistory) {
            state.solveLog.push({ round: guessRound, type: 'guess', value, position: bestCell })
        }
        mark(state, bestCell, guessRound, value)

        if (solve(state)) return true

        // Backtrack all rounds from deductionRound onwards, then the guess round
        // (recursive solve may have advanced state.round further)
        const currentRound = state.round
        for (let r = currentRound; r >= deductionRound; r--) {
            rollbackRound(state, r)
        }
        rollbackRound(state, guessRound)
        state.round = savedRound
        if (state.recordHistory) {
            state.solveLog.push({ round: guessRound, type: 'rollback', value: 0, position: -1 })
        }
    }

    return false
}

// ─── Shuffle Helper ───────────────────────────────────────────────────────────

/** Return a new array with the same elements in a random order (Fisher-Yates). Does not mutate input. */
export const shuffled = (arr: number[]): number[] => {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
    }
    return copy
}

// ─── Serialization ────────────────────────────────────────────────────────────

/** Serialize a flat 81-element array to an 81-character string */
export const boardToString = (board: number[] | number[][]): string =>
    Array.isArray(board[0]) ? (board as number[][]).map((r) => r.join('')).join('') : (board as number[]).join('')

/** Parse an 81-character string into a flat 81-element array */
export const stringToBoard = (str: string): number[] => {
    if (str.length !== 81) throw new Error(`Invalid board string length: ${str.length}`)
    return Array.from(str, (ch) => {
        const n = Number(ch)
        if (isNaN(n) || ch < '0' || ch > '9') throw new Error(`Invalid board character: ${ch}`)
        return n
    })
}

// ─── Generation ───────────────────────────────────────────────────────────────

/** Generate a random complete 9×9 solution by solving an empty grid with randomized digit order.
 *  Returns a flat 81-element array with all cells filled (1-9). */
export const generateSolutionFlat = (): number[] => {
    const state = createSolverState(new Array(81).fill(0))
    solve(state)
    return state.solution
}

// ─── Symmetry Helpers ────────────────────────────────────────────────────────

/** Get symmetric partner cell indices for a given cell and symmetry mode.
 *  Result is deduplicated (center cells may map to themselves). */
export const getSymmetricPartners = (cell: number, symmetry: Symmetry): number[] => {
    const row = cellToRow(cell)
    const col = cellToCol(cell)
    const raw: number[] = (() => {
        switch (symmetry) {
            case 'none': return [cell]
            case 'rotate180': return [cell, 80 - cell]
            case 'rotate90': return [
                cell,
                9 * (8 - col) + row,
                80 - cell,
                9 * col + (8 - row),
            ]
            case 'mirror': return [cell, 9 * row + (8 - col)]
            case 'flip': return [cell, 9 * (8 - row) + col]
        }
    })()
    return [...new Set(raw)]
}

// ─── Solution Counter ─────────────────────────────────────────────────────────

/** Check if digit d is valid at board[idx] using simple constraint check. */
const isValidPlacement = (board: number[], idx: number, digit: number): boolean => {
    const row = Math.floor(idx / 9)
    const col = idx % 9
    const boxRow = Math.floor(row / 3) * 3
    const boxCol = Math.floor(col / 3) * 3
    for (let i = 0; i < 9; i++) {
        if (board[row * 9 + i] === digit) return false
        if (board[i * 9 + col] === digit) return false
        if (board[(boxRow + Math.floor(i / 3)) * 9 + boxCol + (i % 3)] === digit) return false
    }
    return true
}

/** Count solutions up to a limit (default 2). Uses recursive backtracking. */
export const countSolutions = (puzzle: number[], limit = 2): number => {
    const board = [...puzzle]
    let found = 0

    const search = (): void => {
        if (found >= limit) return
        const idx = board.indexOf(0)
        if (idx === -1) { found++; return }
        for (let d = 1; d <= 9; d++) {
            if (!isValidPlacement(board, idx, d)) continue
            board[idx] = d
            search()
            board[idx] = 0
            if (found >= limit) return
        }
    }

    search()
    return found
}

// ─── Puzzle Generation ────────────────────────────────────────────────────────

/** Remove clues from a solution while preserving unique solvability and symmetry. */
export const removeCluesToCreatePuzzle = (solution: number[], symmetry: Symmetry): number[] => {
    const puzzle = [...solution]
    const positions = shuffled(Array.from({ length: 81 }, (_, i) => i))

    for (const pos of positions) {
        if (puzzle[pos] === 0) continue  // already removed as part of a symmetric group
        const partners = getSymmetricPartners(pos, symmetry)
        const saved = partners.map((p) => puzzle[p]!)
        for (const p of partners) puzzle[p] = 0
        if (countSolutions(puzzle, 2) !== 1) {
            for (let i = 0; i < partners.length; i++) puzzle[partners[i]!] = saved[i]!
        }
    }

    return puzzle
}

// ─── Difficulty Classification ────────────────────────────────────────────────

const INTERMEDIATE_TYPES = new Set<LogType>([
    'nakedPairRow', 'nakedPairColumn', 'nakedPairSection',
    'pointingPairTripleRow', 'pointingPairTripleColumn',
    'rowBox', 'columnBox',
    'hiddenPairRow', 'hiddenPairColumn', 'hiddenPairSection',
])

const EASY_TYPES = new Set<LogType>([
    'hiddenSingleRow', 'hiddenSingleColumn', 'hiddenSingleSection',
])

/** Classify difficulty from a solve log based on the most advanced technique used. */
export const getDifficulty = (log: LogItem[]): Difficulty => {
    if (log.some((e) => e.type === 'guess')) return 'expert'
    if (log.some((e) => INTERMEDIATE_TYPES.has(e.type))) return 'intermediate'
    if (log.some((e) => EASY_TYPES.has(e.type))) return 'easy'
    return 'simple'
}

/** Compute solve statistics — count occurrences of each LogType in the log. */
export const getSolveStats = (log: LogItem[]): SolveStats => {
    const stats = {
        given: 0, single: 0,
        hiddenSingleRow: 0, hiddenSingleColumn: 0, hiddenSingleSection: 0,
        nakedPairRow: 0, nakedPairColumn: 0, nakedPairSection: 0,
        pointingPairTripleRow: 0, pointingPairTripleColumn: 0,
        rowBox: 0, columnBox: 0,
        hiddenPairRow: 0, hiddenPairColumn: 0, hiddenPairSection: 0,
        guess: 0, rollback: 0,
    } satisfies SolveStats
    for (const entry of log) stats[entry.type]++
    return stats
}

/** Generate a puzzle matching the target difficulty by retrying up to maxAttempts times.
 *  Returns null if no matching puzzle is found within the attempt budget. */
export const generatePuzzleWithDifficulty = (
    difficulty: Difficulty,
    symmetry: Symmetry = 'rotate180',
    maxAttempts = 100,
): { puzzle: number[]; solution: number[] } | null => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const solution = generateSolutionFlat()
        const puzzle = removeCluesToCreatePuzzle(solution, symmetry)
        const state = createSolverState(puzzle, true)
        solve(state)
        if (getDifficulty(state.solveLog) === difficulty) return { puzzle, solution }
    }
    return null
}

// ─── Legacy API (removed in task 12.4) ───────────────────────────────────────
// Keeps src/server/post.ts and src/server/__tests__/post.test.ts compiling
// until they are rewritten in tasks 12.3 and 12.4.

/** @deprecated Use flat-array API. Removed in task 12.4. */
export type Board = number[][]

const isValidLegacy = (board: Board, row: number, col: number, num: number): boolean => {
    for (let c = 0; c < 9; c++) if (board[row]![c] === num) return false
    for (let r = 0; r < 9; r++) if (board[r]![col] === num) return false
    const br = Math.floor(row / 3) * 3
    const bc = Math.floor(col / 3) * 3
    for (let r = br; r < br + 3; r++)
        for (let c = bc; c < bc + 3; c++)
            if (board[r]![c] === num) return false
    return true
}

const solveLegacy = (board: Board): boolean => {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r]![c] !== 0) continue
            for (const num of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
                if (!isValidLegacy(board, r, c, num)) continue
                board[r]![c] = num
                if (solveLegacy(board)) return true
                board[r]![c] = 0
            }
            return false
        }
    }
    return true
}

const countSolutionsLegacy = (board: Board, limit = 2): number => {
    const copy = board.map((row) => [...row])
    const state = { found: 0 }
    const search = (r: number, c: number): void => {
        if (state.found >= limit) return
        if (r === 9) { state.found++; return }
        const nr = c === 8 ? r + 1 : r
        const nc = c === 8 ? 0 : c + 1
        if (copy[r]![c] !== 0) { search(nr, nc); return }
        for (let num = 1; num <= 9; num++) {
            if (state.found >= limit) return
            if (!isValidLegacy(copy, r, c, num)) continue
            copy[r]![c] = num
            search(nr, nc)
            copy[r]![c] = 0
        }
    }
    search(0, 0)
    return state.found
}

/** @deprecated Removed in task 12.4. */
export const generateSolution = (): Board => {
    const board: Board = Array.from({ length: 9 }, () => Array(9).fill(0) as number[])
    solveLegacy(board)
    return board
}

/** @deprecated Removed in task 12.4. */
export const punchHoles = (solution: Board, cellsToRemove: number): Board => {
    const board = solution.map((row) => [...row])
    const positions = shuffled(Array.from({ length: 81 }, (_, i) => i))
    let removed = 0
    for (const pos of positions) {
        if (removed >= cellsToRemove) break
        const r = Math.floor(pos / 9)
        const c = pos % 9
        const saved = board[r]![c]!
        board[r]![c] = 0
        if (countSolutionsLegacy(board) !== 1) board[r]![c] = saved
        else removed++
    }
    return board
}
