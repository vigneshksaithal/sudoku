<script lang="ts">
  import { Undo2, Lightbulb, Eraser, Pen, MousePointer2 } from "lucide-svelte";

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
    lockedDigit,
    digitFirstMode,
    onToggleDigitFirst,
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
    lockedDigit: number | null;
    digitFirstMode: boolean;
    onToggleDigitFirst: () => void;
  } = $props();

  const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

  const isSolved = (digit: number): boolean =>
    (digitCounts.get(digit) ?? 0) >= 9;
</script>

<div class="w-full space-y-2" role="group" aria-label="Number pad">
  <!-- Mode tabs + Undo/Hint buttons -->
  <div class="flex items-center gap-2">
    <div
      class="flex flex-1 rounded-full bg-neutral-100 p-1 dark:bg-neutral-800"
    >
      <button
        class={[
          "flex-1 flex items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
          !notesMode
            ? "bg-white text-blue-600 shadow-sm dark:bg-neutral-700 dark:text-blue-400"
            : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200",
        ]}
        onclick={onToggleNotes}
        aria-pressed={!notesMode}
        aria-label="Normal mode"
      >
        <Pen size={18} />
        <span class="hidden sm:inline">Normal</span>
      </button>
      <button
        class={[
          "flex-1 flex items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
          notesMode
            ? "bg-white text-blue-600 shadow-sm dark:bg-neutral-700 dark:text-blue-400"
            : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200",
        ]}
        onclick={onToggleNotes}
        aria-pressed={notesMode}
        aria-label="Candidate mode"
      >
        <MousePointer2 size={18} />
        <span class="hidden sm:inline">Candidate</span>
      </button>
    </div>
    <button
      class={[
        "flex items-center justify-center rounded-full min-h-11 min-w-11 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500",
        undoDisabled
          ? "cursor-not-allowed opacity-40 bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700",
      ]}
      onclick={onUndo}
      disabled={undoDisabled}
      aria-label="Undo last move"
      title="Undo"
    >
      <Undo2 size={20} />
    </button>
    <button
      class={[
        "flex items-center justify-center rounded-full min-h-11 min-w-11 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-500",
        hintsDisabled
          ? "cursor-not-allowed opacity-40 bg-amber-50 text-amber-400 dark:bg-amber-900/20 dark:text-amber-600"
          : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-800/50",
      ]}
      onclick={onHint}
      disabled={hintsDisabled}
      aria-label="Get hint"
      title="Hint"
    >
      <Lightbulb size={20} />
    </button>
  </div>

  <!-- 5-column digit grid -->
  <div class="grid grid-cols-5 gap-2">
    {#each DIGITS as num (num)}
      <button
        class={[
          "flex items-center justify-center rounded-md min-h-12 text-2xl font-serif transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700",
          lockedDigit === num
            ? "ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-900/40"
            : isSolved(num) && "opacity-40",
        ]}
        onclick={() => onNumber(num)}
        aria-label="Enter {num}"
        aria-pressed={lockedDigit === num}
      >
        {num}
      </button>
    {/each}
    <button
      class="flex items-center justify-center rounded-md min-h-12 text-xl font-bold transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-800/50"
      onclick={onErase}
      aria-label="Erase cell"
    >
      <Eraser size={24} />
    </button>
  </div>

  <!-- Checkboxes row -->
  <div class="flex items-center gap-4 px-1">
    <label
      class="flex cursor-pointer items-center gap-2 text-sm text-neutral-700 select-none dark:text-neutral-300"
    >
      <input
        type="checkbox"
        class="h-4 w-4 accent-blue-600"
        checked={autoCandidateActive}
        onchange={onAutoCandidate}
      />
      Auto Candidate
    </label>
    <label
      class="flex cursor-pointer items-center gap-2 text-sm text-neutral-700 select-none dark:text-neutral-300"
    >
      <input
        type="checkbox"
        class="h-4 w-4 accent-blue-600"
        checked={digitFirstMode}
        onchange={onToggleDigitFirst}
      />
      Digit First
    </label>
  </div>
</div>
