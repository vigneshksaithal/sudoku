<script lang="ts">
  import type { Selection } from "../lib/selection-utils";
  import {
    isSelected,
    computeRectSelection,
    cellFromPointer,
  } from "../lib/selection-utils";
  import { getCellClasses } from "../lib/grid-utils";
  import type { CellState, NotesBoard, TechniqueHighlight } from "../lib/types";
  import type { CellCoord } from "../lib/notes-utils";

  const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

  let {
    board,
    notesBoard,
    selection,
    highlightDigit,
    techniqueHighlight,
    hintDigit,
    onCellSelect,
    onDragSelect,
    onShiftCellSelect,
  }: {
    board: CellState[][];
    notesBoard: NotesBoard;
    selection: Selection;
    highlightDigit: number | null;
    techniqueHighlight: TechniqueHighlight | null;
    hintDigit: number | null;
    onCellSelect: (row: number, col: number) => void;
    onDragSelect: (selection: Selection) => void;
    onShiftCellSelect?: (row: number, col: number) => void;
  } = $props();

  const isPrimaryCell = (r: number, c: number): boolean =>
    techniqueHighlight !== null &&
    techniqueHighlight.primaryCells.some(([pr, pc]) => pr === r && pc === c);

  const isSecondaryCell = (r: number, c: number): boolean =>
    techniqueHighlight !== null &&
    techniqueHighlight.secondaryCells.some(([sr, sc]) => sr === r && sc === c);

  const computeCellClasses = (
    r: number,
    c: number,
    cell: CellState,
  ): string => {
    const selected = isSelected(selection, r, c);
    const isNoteHighlight =
      highlightDigit !== null &&
      cell.value === 0 &&
      (notesBoard[r]?.[c]?.has(highlightDigit) ?? false);
    const focused =
      selection.focusCell?.[0] === r && selection.focusCell?.[1] === c;

    return getCellClasses({
      r,
      c,
      cell,
      selected,
      focused,
      highlightDigit,
      isNoteHighlight,
      isPrimary: isPrimaryCell(r, c),
      isSecondary: isSecondaryCell(r, c),
      hasConflict: cell.hasConflict,
    });
  };

  let isDragging = $state(false);
  let anchorCell: CellCoord | null = $state(null);
  let gridEl: HTMLDivElement;

  const handlePointerDown = (
    e: PointerEvent,
    row: number,
    col: number,
  ): void => {
    e.preventDefault();
    if (e.shiftKey) {
      onShiftCellSelect?.(row, col);
      return;
    }
    onCellSelect(row, col);
    anchorCell = [row, col] as const;
    isDragging = true;
    try {
      gridEl.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture may fail with invalid pointer ID — fall back to uncaptured drag
    }
  };

  const handlePointerMove = (e: PointerEvent): void => {
    if (!isDragging || anchorCell === null) return;
    const gridRect = gridEl.getBoundingClientRect();
    const currentCell = cellFromPointer(e.clientX, e.clientY, gridRect);
    const newSelection = computeRectSelection(anchorCell, currentCell);
    onDragSelect(newSelection);
  };

  const handlePointerUp = (e: PointerEvent): void => {
    if (!isDragging) return;
    isDragging = false;
    anchorCell = null;
    try {
      gridEl.releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may already be released
    }
  };
</script>

<div
  bind:this={gridEl}
  class="grid grid-cols-9 select-none touch-none border-2 border-neutral-800 dark:border-neutral-200"
  role="grid"
  aria-label="Sudoku grid"
  tabindex="-1"
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
>
  {#each board as row, r (r)}
    {#each row as cell, c (c)}
      <button
        data-row={r}
        data-col={c}
        class={computeCellClasses(r, c, cell)}
        onpointerdown={(e) => handlePointerDown(e, r, c)}
        aria-label="Row {r + 1}, Column {c + 1}{cell.value
          ? `, value ${cell.value}`
          : ', empty'}"
        aria-selected={isSelected(selection, r, c)}
        role="gridcell"
      >
        {#if cell.value > 0}
          {cell.value}
        {:else if isPrimaryCell(r, c) && hintDigit !== null}
          <span
            class="text-lg font-bold text-emerald-600 opacity-70 dark:text-emerald-400"
          >
            {hintDigit}
          </span>
        {:else}
          <div class="grid h-full w-full grid-cols-3 p-px">
            {#each DIGITS as digit (digit)}
              <span
                class={[
                  "flex items-center justify-center text-[0.65rem] leading-none sm:text-[0.75rem]",
                  highlightDigit === digit &&
                    notesBoard[r]?.[c]?.has(digit) &&
                    "font-bold text-blue-600",
                ]}
              >
                {notesBoard[r]?.[c]?.has(digit) ? digit : ""}
              </span>
            {/each}
          </div>
        {/if}
      </button>
    {/each}
  {/each}
</div>
