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

export const computeRectSelection = (anchor: CellCoord, current: CellCoord): Selection => {
    const minRow = Math.min(anchor[0], current[0])
    const maxRow = Math.max(anchor[0], current[0])
    const minCol = Math.min(anchor[1], current[1])
    const maxCol = Math.max(anchor[1], current[1])

    const cells = new Set<string>()
    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            cells.add(cellKey(r, c))
        }
    }

    return { cells, focusCell: current }
}

export const clearSelection = (): Selection => EMPTY_SELECTION

export const moveFocus = (focusCell: CellCoord | null, dr: number, dc: number): Selection => {
    if (!focusCell) return EMPTY_SELECTION
    const [row, col] = focusCell
    return setSelection(Math.max(0, Math.min(8, row + dr)), Math.max(0, Math.min(8, col + dc)))
}

export const isSelected = (selection: Selection, row: number, col: number): boolean =>
    selection.cells.has(cellKey(row, col))

export const cellFromPointer = (
    clientX: number,
    clientY: number,
    gridRect: { left: number; top: number; width: number; height: number },
): CellCoord => {
    const row = Math.min(8, Math.max(0, Math.floor((clientY - gridRect.top) / (gridRect.height / 9))))
    const col = Math.min(8, Math.max(0, Math.floor((clientX - gridRect.left) / (gridRect.width / 9))))
    return [row, col] as const
}

export const isMultiSelection = (selection: Selection): boolean => selection.cells.size > 1

export const toggleCellSelection = (
    current: Selection,
    row: number,
    col: number,
): Selection => {
    const key = cellKey(row, col)

    if (current.cells.size === 0) {
        return { cells: new Set([key]), focusCell: [row, col] }
    }

    if (!current.cells.has(key)) {
        const cells = new Set(current.cells)
        cells.add(key)
        return { cells, focusCell: [row, col] }
    }

    if (current.cells.size === 1) {
        return current
    }

    // Cell is in selection and size > 1 — remove it
    const cells = new Set(current.cells)
    cells.delete(key)

    const wasFocus =
        current.focusCell !== null &&
        current.focusCell[0] === row &&
        current.focusCell[1] === col

    const focusCell = wasFocus ? parseKey(cells.values().next().value!) : current.focusCell

    return { cells, focusCell }
}
