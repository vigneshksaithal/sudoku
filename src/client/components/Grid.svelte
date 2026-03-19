<script lang="ts">
  import type { Selection } from "../lib/selection-utils";
  import { isSelected } from "../lib/selection-utils";
  import { getCellClasses } from "../lib/grid-utils";
  import type { CellState, NotesBoard, TechniqueHighlight } from "../lib/types";

  const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

  let {
    board,
    notesBoard,
    selection,
    highlightDigit,
    techniqueHighlight,
    hintDigit,
    onCellSelect,
    onCellExtend,
    onCellToggle,
  }: {
    board: CellState[][];
    notesBoard: NotesBoard;
    selection: Selection;
    highlightDigit: number | null;
    techniqueHighlight: TechniqueHighlight | null;
    hintDigit: number | null;
    onCellSelect: (row: number, col: number) => void;
    onCellExtend: (row: number, col: number) => void;
    onCellToggle: (row: number, col: number) => void;
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

  const handlePointerDown = (
    e: PointerEvent,
    row: number,
    col: number,
  ): void => {
    e.preventDefault();
    if (e.shiftKey) {
      onCellToggle(row, col);
    } else {
      onCellSelect(row, col);
    }
    isDragging = true;
  };

  const handlePointerMove = (e: PointerEvent): void => {
    if (!isDragging) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    const rowAttr = el.getAttribute("data-row");
    const colAttr = el.getAttribute("data-col");
    if (rowAttr === null || colAttr === null) return;
    const row = parseInt(rowAttr, 10);
    const col = parseInt(colAttr, 10);
    onCellExtend(row, col);
  };

  const handlePointerUp = (): void => {
    isDragging = false;
  };
</script>

<div
  class="grid grid-cols-9 select-none touch-none border-2 border-neutral-800 dark:border-neutral-200"
  role="grid"
  aria-label="Sudoku grid"
  tabindex="-1"
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointerleave={handlePointerUp}
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
                  "flex items-center justify-center text-[0.5rem] leading-none sm:text-[0.6rem]",
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
