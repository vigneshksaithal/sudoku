<script lang="ts">
  let {
    onNumber,
    onErase,
    notesMode,
    onToggleNotes,
    onHint,
    hintsDisabled,
    onUndo,
    undoDisabled,
    onAutoCandidate,
    autoCandidateActive,
    digitCounts,
  }: {
    onNumber: (num: number) => void;
    onErase: () => void;
    notesMode: boolean;
    onToggleNotes: () => void;
    onHint: () => void;
    hintsDisabled: boolean;
    onUndo: () => void;
    undoDisabled: boolean;
    onAutoCandidate: () => void;
    autoCandidateActive: boolean;
    digitCounts: ReadonlyMap<number, number>;
  } = $props();

  const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

  const isSolved = (digit: number): boolean =>
    (digitCounts.get(digit) ?? 0) >= 9;
</script>

<div class="w-full space-y-2" role="group" aria-label="Number pad">
  <!-- Mode tabs + Undo/Hint buttons -->
  <div class="flex items-center gap-2">
    <div
      class="flex flex-1 rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800"
    >
      <button
        class={[
          "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
          !notesMode
            ? "bg-white text-blue-600 shadow-sm dark:bg-neutral-700 dark:text-blue-400"
            : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200",
        ]}
        style="min-height: 36px"
        onclick={onToggleNotes}
        aria-pressed={!notesMode}
        aria-label="Normal mode"
      >
        Normal
      </button>
      <button
        class={[
          "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
          notesMode
            ? "bg-white text-blue-600 shadow-sm dark:bg-neutral-700 dark:text-blue-400"
            : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200",
        ]}
        style="min-height: 36px"
        onclick={onToggleNotes}
        aria-pressed={notesMode}
        aria-label="Candidate mode"
      >
        Candidate
      </button>
    </div>
    <button
      class={[
        "flex items-center justify-center rounded-md min-h-11 min-w-11 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500",
        undoDisabled
          ? "cursor-not-allowed opacity-40 bg-neutral-100 text-neutral-400 dark:bg-neutral-700 dark:text-neutral-500"
          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600",
      ]}
      onclick={onUndo}
      disabled={undoDisabled}
      aria-label="Undo last move"
      title="Undo"
    >
      <span class="text-lg leading-none">↩</span>
    </button>
    <button
      class={[
        "flex items-center justify-center rounded-md min-h-11 min-w-11 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-500",
        hintsDisabled
          ? "cursor-not-allowed opacity-40 bg-amber-100 text-amber-400 dark:bg-amber-900/40 dark:text-amber-600"
          : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-800/50",
      ]}
      onclick={onHint}
      disabled={hintsDisabled}
      aria-label="Get hint"
      title="Hint"
    >
      <span class="text-lg leading-none">💡</span>
    </button>
  </div>

  <!-- 5-column digit grid -->
  <div class="grid grid-cols-5 gap-1">
    {#each DIGITS as num (num)}
      <button
        class={[
          "flex items-center justify-center rounded-md min-h-9 text-lg font-bold transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600",
          isSolved(num) && "opacity-40",
        ]}
        onclick={() => onNumber(num)}
        aria-label="Enter {num}"
      >
        {num}
      </button>
    {/each}
    <button
      class="flex items-center justify-center rounded-md min-h-9 text-lg font-bold transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-800/50"
      onclick={onErase}
      aria-label="Erase cell"
    >
      ✕
    </button>
  </div>

  <!-- Auto Candidate Mode checkbox -->
  <label
    class="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm text-neutral-700 select-none dark:text-neutral-300"
  >
    <input
      type="checkbox"
      class="h-4 w-4 accent-blue-600"
      checked={autoCandidateActive}
      onchange={onAutoCandidate}
    />
    Auto Candidate Mode
  </label>
</div>
