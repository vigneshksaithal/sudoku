<script lang="ts">
    import IconButton from "./IconButton.svelte";

    let {
        onNumber,
        onErase,
        notesMode,
        onToggleNotes,
        onHint,
        hintsRemaining,
        hintsDisabled,
    }: {
        onNumber: (num: number) => void;
        onErase: () => void;
        notesMode: boolean;
        onToggleNotes: () => void;
        onHint: () => void;
        hintsRemaining: number;
        hintsDisabled: boolean;
    } = $props();
</script>

<div class="flex flex-col gap-2 w-full" role="group" aria-label="Number pad">
    <!-- Controls: notes | hint -->
    <div class="grid grid-cols-2 gap-2 w-full">
        <IconButton
            onclick={onToggleNotes}
            label={notesMode ? "Notes on" : "Notes off"}
            variant="notes"
            active={notesMode}
        >
            <span class="text-lg leading-none">✏️</span>
            <span class="text-sm">Notes</span>
        </IconButton>
        <IconButton
            onclick={onHint}
            label="Hint, {hintsRemaining} remaining"
            variant="hint"
            disabled={hintsDisabled}
        >
            <span class="text-lg leading-none">💡</span>
            <span class="text-sm font-bold">{hintsRemaining}</span>
        </IconButton>
    </div>

    <!-- Digits 1–9 + erase as 10th cell, 5 per row -->
    <div class="grid grid-cols-5 gap-2 w-full">
        {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as num (num)}
            <button
                class="aspect-square w-full rounded-xl bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-bold text-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-blue-500"
                onclick={() => onNumber(num)}
                aria-label="Enter {num}"
            >
                {num}
            </button>
        {/each}
        <button
            class="aspect-square w-full rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-bold text-lg hover:bg-red-200 dark:hover:bg-red-800/50 active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-red-500"
            onclick={onErase}
            aria-label="Erase cell"
        >
            ✕
        </button>
    </div>
</div>
