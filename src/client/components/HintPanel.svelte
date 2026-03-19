<script lang="ts">
  import type { TechniqueHint } from "../lib/types";

  const DIFFICULTY_CLASSES: Record<string, string> = {
    easy: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    medium:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    hard: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };

  let {
    hint,
    onApply,
    onDismiss,
  }: {
    hint: TechniqueHint;
    onApply: () => void;
    onDismiss: () => void;
  } = $props();

  const difficultyLabel = $derived(
    hint.difficulty.charAt(0).toUpperCase() + hint.difficulty.slice(1),
  );

  const badgeClass = $derived(
    DIFFICULTY_CLASSES[hint.difficulty] ??
      "bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200",
  );

  const actionLabel = $derived(
    hint.action === "placement" ? `Place ${hint.digit}` : "Remove candidates",
  );
</script>

<section
  aria-label="Hint"
  class="w-full rounded-lg border border-emerald-200 bg-emerald-50 p-3 shadow-sm dark:border-emerald-800 dark:bg-emerald-950"
>
  <div class="flex items-start gap-2">
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <h2
          class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100"
        >
          {hint.title}
        </h2>
        {#if hint.action === "placement"}
          <span
            class="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold tabular-nums text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
          >
            → {hint.digit}
          </span>
        {/if}
      </div>
      <p
        class="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400"
      >
        {hint.description}
      </p>
    </div>
    <button
      class="rounded p-1 text-neutral-400 transition-colors hover:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:hover:text-neutral-200"
      onclick={onDismiss}
      aria-label="Dismiss hint"
    >
      ✕
    </button>
  </div>

  <div class="mt-2 flex items-center justify-between gap-2">
    <span class={["rounded-full px-2 py-0.5 text-xs font-medium", badgeClass]}>
      {difficultyLabel}
    </span>
    <button
      class="min-h-9 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition-transform hover:bg-emerald-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      onclick={onApply}
      aria-label={actionLabel}
    >
      Apply
    </button>
  </div>
</section>
