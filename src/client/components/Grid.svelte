<script lang="ts">
    import type { CellState, NotesBoard } from "../lib/types";

    const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

    let {
        board,
        notesBoard,
        selectedRow,
        selectedCol,
        highlightDigit,
        onCellSelect,
    }: {
        board: CellState[][];
        notesBoard: NotesBoard;
        selectedRow: number | null;
        selectedCol: number | null;
        highlightDigit: number | null;
        onCellSelect: (row: number, col: number) => void;
    } = $props();
</script>

<div
    class="grid grid-cols-9 border-2 border-neutral-800 dark:border-neutral-200"
    role="grid"
    aria-label="Sudoku grid"
>
    {#each board as row, r (r)}
        {#each row as cell, c (c)}
            <button
                class={[
                    "flex items-center justify-center text-lg font-mono aspect-square min-w-[36px] min-h-[36px] border border-neutral-300 dark:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500",
                    r % 3 === 0 &&
                        "border-t-2 border-t-neutral-800 dark:border-t-neutral-200",
                    c % 3 === 0 &&
                        "border-l-2 border-l-neutral-800 dark:border-l-neutral-200",
                    r === 8 &&
                        "border-b-2 border-b-neutral-800 dark:border-b-neutral-200",
                    c === 8 &&
                        "border-r-2 border-r-neutral-800 dark:border-r-neutral-200",
                    cell.isGiven
                        ? "font-semibold bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                        : "bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400",
                    highlightDigit !== null &&
                        cell.value === highlightDigit &&
                        "bg-blue-100 dark:bg-blue-900/30",
                    highlightDigit !== null &&
                        cell.value === 0 &&
                        notesBoard[r]?.[c]?.has(highlightDigit) &&
                        "bg-yellow-100 dark:bg-yellow-900/30",
                    cell.hasConflict &&
                        "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30",
                    r === selectedRow &&
                        c === selectedCol &&
                        "ring-2 ring-blue-500 z-10",
                ]}
                onclick={() => onCellSelect(r, c)}
                aria-label="Row {r + 1}, Column {c + 1}{cell.value
                    ? `, value ${cell.value}`
                    : ', empty'}"
                aria-selected={r === selectedRow && c === selectedCol}
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
