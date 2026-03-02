<script lang="ts">
    import type { CellState } from "../lib/types";

    let {
        board,
        selectedRow,
        selectedCol,
        onCellSelect,
    }: {
        board: CellState[][];
        selectedRow: number | null;
        selectedCol: number | null;
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
                {cell.value || ""}
            </button>
        {/each}
    {/each}
</div>
