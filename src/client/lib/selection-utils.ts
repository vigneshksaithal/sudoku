import type { CellCoord } from './notes-utils'

export type Selection = {
    readonly cells: ReadonlySet<string>
    readonly focusCell: CellCoord | null
}

export const EMPTY_SELECTION: Selection = {
    cells: new Set(),
    focusCell: null,
}

export const cellKey = (row: number, col: number): string => `${row},${col}`

export const parseKey = (key: string): CellCoord => {
    const [r, c] = key.split(',').map(Number)
    return [r!, c!] as const
}

export const setSelection = (row: number, col: number): Selection => ({
    cells: new Set([cellKey(row, col)]),
    focusCell: [row, col],
})

export const extendSelection = (selection: Selection, row: number, col: number): Selection => ({
    cells: new Set([...selection.cells, cellKey(row, col)]),
    focusCell: [row, col],
})

export const toggleSelection = (selection: Selection, row: number, col: number): Selection => {
    const key = cellKey(row, col)
    const next = new Set(selection.cells)
    if (next.has(key)) {
        next.delete(key)
        if (next.size === 0) return { cells: next, focusCell: null }
        // If the removed cell was the focusCell, pick any remaining cell as new focus
        const isFocusRemoved =
            selection.focusCell !== null &&
            selection.focusCell[0] === row &&
            selection.focusCell[1] === col
        if (isFocusRemoved) {
            const remaining = next.values().next().value as string
            return { cells: next, focusCell: parseKey(remaining) }
        }
        return { cells: next, focusCell: selection.focusCell }
    }
    next.add(key)
    return { cells: next, focusCell: [row, col] }
}

export const clearSelection = (): Selection => EMPTY_SELECTION

export const moveFocus = (focusCell: CellCoord | null, dr: number, dc: number): Selection => {
    if (!focusCell) return EMPTY_SELECTION
    const [row, col] = focusCell
    return setSelection(Math.max(0, Math.min(8, row + dr)), Math.max(0, Math.min(8, col + dc)))
}

export const isSelected = (selection: Selection, row: number, col: number): boolean =>
    selection.cells.has(cellKey(row, col))

export const isMultiSelection = (selection: Selection): boolean => selection.cells.size > 1
