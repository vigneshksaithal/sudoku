<script lang="ts">
    import IconButton from "./IconButton.svelte";

    let {
        onNumber,
        onErase,
        notesMode,
        onToggleNotes,
        onHint,
        hintsDisabled,
        onUndo,
        undoDisabled,
        digitCounts,
        padAlignment,
        onToggleAlignment,
    }: {
        onNumber: (num: number) => void;
        onErase: () => void;
        notesMode: boolean;
        onToggleNotes: () => void;
        onHint: () => void;
        hintsDisabled: boolean;
        onUndo: () => void;
        undoDisabled: boolean;
        digitCounts: ReadonlyMap<number, number>;
        padAlignment: "left" | "right";
        onToggleAlignment: () => void;
    } = $props();

    const isSolved = (digit: number): boolean =>
        (digitCounts.get(digit) ?? 0) >= 9;

    const digitGridOrder = $derived(
        padAlignment === "left" ? "order-1" : "order-2",
    );
    const actionColOrder = $derived(
        padAlignment === "left" ? "order-2" : "order-1",
    );
</script>

<div class="flex gap-2 w-full" role="group" aria-label="Number pad">
    <!-- Digit grid: 3×3 phone layout -->
    <div class="grid grid-cols-3 gap-2 flex-1 {digitGridOrder}">
        {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as num (num)}
            <button
                class="aspect-square w-full rounded-xl bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-bold text-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-blue-500 {isSolved(
                    num,
                )
                    ? 'opacity-40'
                    : ''}"
                onclick={() => onNumber(num)}
                aria-label="Enter {num}"
            >
                {num}
            </button>
        {/each}
    </div>

    <!-- Action column: vertical -->
    <div class="flex flex-col gap-2 {actionColOrder}" style="width: 4.5rem;">
        <IconButton
            onclick={onUndo}
            label="Undo last move"
            variant="default"
            disabled={undoDisabled}
        >
            <span class="text-lg leading-none">↩</span>
            <span class="text-xs">Undo</span>
        </IconButton>
        <IconButton
            onclick={onToggleNotes}
            label={notesMode ? "Notes on" : "Notes off"}
            variant="notes"
            active={notesMode}
        >
            <span class="text-lg leading-none">✏️</span>
            <span class="text-xs">Notes</span>
        </IconButton>
        <IconButton
            onclick={onHint}
            label="Hint"
            variant="hint"
            disabled={hintsDisabled}
        >
            <span class="text-lg leading-none">💡</span>
            <span class="text-xs">Hint</span>
        </IconButton>
        <IconButton onclick={onErase} label="Erase cell" variant="danger">
            <span class="text-lg leading-none">✕</span>
            <span class="text-xs">Erase</span>
        </IconButton>
        <IconButton
            onclick={onToggleAlignment}
            label={padAlignment === "left"
                ? "Switch pad to right"
                : "Switch pad to left"}
            variant="default"
        >
            <span class="text-lg leading-none">↔</span>
        </IconButton>
    </div>
</div>
