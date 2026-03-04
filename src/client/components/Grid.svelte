<script lang="ts">
    import type { CellState, NotesBoard } from "../lib/types";
    import type { Selection } from "../lib/selection-utils";
    import { isSelected } from "../lib/selection-utils";

    const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

    let {
        board,
        notesBoard,
        selection,
        highlightDigit,
        onCellSelect,
        onCellExtend,
        onCellToggle,
        onDragEnd,
    }: {
        board: CellState[][];
        notesBoard: NotesBoard;
        selection: Selection;
        highlightDigit: number | null;
        onCellSelect: (row: number, col: number) => void;
        onCellExtend: (row: number, col: number) => void;
        onCellToggle: (row: number, col: number) => void;
        onDragEnd: () => void;
    } = $props();

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
        onDragEnd();
    };
</script>

<div
    class="grid grid-cols-9 border-2 border-neutral-800 dark:border-neutral-200 touch-none select-none"
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
                class={[
                    "flex items-center justify-center text-lg font-mono aspect-square min-w-[36px] min-h-[36px] border border-neutral-300 dark:border-neutral-600 focus:outline-none",
                    r % 3 === 0 &&
                        "border-t-2 border-t-neutral-800 dark:border-t-neutral-200",
                    c % 3 === 0 &&
                        "border-l-2 border-l-neutral-800 dark:border-l-neutral-200",
                    r === 8 &&
                        "border-b-2 border-b-neutral-800 dark:border-b-neutral-200",
                    c === 8 &&
                        "border-r-2 border-r-neutral-800 dark:border-r-neutral-200",
                    cell.isGiven
                        ? "font-semibold text-neutral-900 dark:text-neutral-100"
                        : "text-blue-600 dark:text-blue-400",
                    // Base background — overridden by selection/highlight below
                    !isSelected(selection, r, c) &&
                        cell.isGiven &&
                        "bg-neutral-100 dark:bg-neutral-700",
                    !isSelected(selection, r, c) &&
                        !cell.isGiven &&
                        "bg-white dark:bg-neutral-800",
                    !isSelected(selection, r, c) &&
                        highlightDigit !== null &&
                        cell.value === highlightDigit &&
                        "bg-blue-100 dark:bg-blue-900/30",
                    !isSelected(selection, r, c) &&
                        highlightDigit !== null &&
                        cell.value === 0 &&
                        notesBoard[r]?.[c]?.has(highlightDigit) &&
                        "bg-yellow-100 dark:bg-yellow-900/30",
                    !isSelected(selection, r, c) &&
                        cell.hasConflict &&
                        "bg-red-50 dark:bg-red-900/30",
                    cell.hasConflict && "text-red-600 dark:text-red-400",
                    // Selection highlight wins over all backgrounds
                    isSelected(selection, r, c) &&
                        "bg-blue-200 dark:bg-blue-700/60",
                    selection.focusCell?.[0] === r &&
                        selection.focusCell?.[1] === c &&
                        "outline outline-2 outline-blue-500 z-10",
                ]}
                onpointerdown={(e) => handlePointerDown(e, r, c)}
                aria-label="Row {r + 1}, Column {c + 1}{cell.value
                    ? `, value ${cell.value}`
                    : ', empty'}"
                aria-selected={isSelected(selection, r, c)}
                role="gridcell"
            >
                {#if cell.value > 0}
                    {cell.value}
                {:else}
                    <div class="grid grid-cols-3 w-full h-full p-[1px]">
                        {#each DIGITS as digit (digit)}
                            <span
                                class={[
                                    "flex items-center justify-center text-[0.5rem] sm:text-[0.6rem] leading-none",
                                    highlightDigit === digit &&
                                        notesBoard[r]?.[c]?.has(digit) &&
                                        "text-blue-600 font-bold",
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
