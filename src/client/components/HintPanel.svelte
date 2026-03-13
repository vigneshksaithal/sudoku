<script lang="ts">
    import type { TechniqueHint } from "../lib/types";

    const DIFFICULTY_CLASSES: Record<string, string> = {
        easy: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
        medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
        hard: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    } as const;

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
        hint.action === "placement"
            ? `Place ${hint.digit}`
            : `Remove candidates`,
    );
</script>

<section
    aria-label="Hint"
    class="w-full max-w-md rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 shadow-sm overflow-hidden"
>
    <!-- Top row: technique name + digit badge + difficulty + dismiss -->
    <div
        class="flex items-center gap-2 px-3 py-2 border-b border-emerald-100 dark:border-emerald-900"
    >
        <span
            class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex-1 truncate"
        >
            {hint.title}
        </span>
        {#if hint.action === "placement"}
            <span
                class="text-sm font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md tabular-nums"
            >
                → {hint.digit}
            </span>
        {/if}
        <span
            class={["text-xs font-medium px-2 py-0.5 rounded-full", badgeClass]}
        >
            {difficultyLabel}
        </span>
        <button
            class="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-400 rounded p-0.5"
            onclick={onDismiss}
            aria-label="Dismiss hint"
        >
            ✕
        </button>
    </div>

    <!-- Description + apply -->
    <div class="flex items-center gap-2 px-3 py-2">
        <p
            class="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed flex-1"
        >
            {hint.description}
        </p>
        <button
            class="shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[36px]"
            onclick={onApply}
            aria-label={actionLabel}
        >
            Apply
        </button>
    </div>
</section>
