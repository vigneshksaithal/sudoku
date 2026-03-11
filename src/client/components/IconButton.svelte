<script lang="ts">
    import type { Snippet } from "svelte";

    let {
        onclick,
        label,
        disabled = false,
        variant = "default",
        active = false,
        children,
    }: {
        onclick: () => void;
        label: string;
        disabled?: boolean;
        variant?: "default" | "danger" | "notes" | "hint";
        active?: boolean;
        children?: Snippet;
    } = $props();

    const BASE =
        "h-11 rounded-xl font-semibold text-base active:scale-95 transition-transform focus:outline-none focus:ring-2 flex items-center justify-center gap-1.5 w-full";

    const VARIANT_CLASSES: Record<"default" | "danger" | "hint", string> = {
        danger: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/50 focus:ring-red-500",
        hint: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/50 focus:ring-amber-500",
        default:
            "bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-600 focus:ring-blue-500",
    };

    const notesActive =
        "bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500";
    const notesInactive =
        "bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-600 focus:ring-blue-500";

    const variantClass = $derived(
        variant === "notes"
            ? active
                ? notesActive
                : notesInactive
            : (VARIANT_CLASSES[variant as "default" | "danger" | "hint"] ??
                  VARIANT_CLASSES.default),
    );
</script>

<button
    class="{BASE} {variantClass} {disabled
        ? 'opacity-40 cursor-not-allowed'
        : ''}"
    {onclick}
    {disabled}
    aria-label={label}
    aria-pressed={variant === "notes" ? active : undefined}
>
    {@render children?.()}
</button>
