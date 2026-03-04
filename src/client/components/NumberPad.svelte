<script lang="ts">
    let {
        onNumber,
        onErase,
        notesMode,
        onToggleNotes,
    }: {
        onNumber: (num: number) => void;
        onErase: () => void;
        notesMode: boolean;
        onToggleNotes: () => void;
    } = $props();
</script>

<div class="grid grid-cols-5 gap-2" role="group" aria-label="Number pad">
    {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as num (num)}
        <button
            class="min-w-[44px] min-h-[44px] rounded-lg bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-semibold text-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 active:bg-neutral-300 dark:active:bg-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onclick={() => onNumber(num)}
            aria-label="Enter {num}"
        >
            {num}
        </button>
    {/each}
    <button
        class={[
            "min-w-[44px] min-h-[44px] rounded-lg font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
            notesMode
                ? "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                : "bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-600 active:bg-neutral-300 dark:active:bg-neutral-500",
        ]}
        onclick={() => onToggleNotes()}
        aria-label={notesMode
            ? "Toggle notes mode (active)"
            : "Toggle notes mode"}
        aria-pressed={notesMode}
    >
        ✏️
    </button>
    <button
        class="min-w-[44px] min-h-[44px] rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-semibold text-lg hover:bg-red-200 dark:hover:bg-red-800/40 active:bg-red-300 dark:active:bg-red-700/40 focus:outline-none focus:ring-2 focus:ring-red-500"
        onclick={() => onErase()}
        aria-label="Erase cell"
    >
        ✕
    </button>
</div>
