<script lang="ts">
    import { onMount } from "svelte";

    let { onResume }: { onResume: () => void } = $props();

    let resumeButtonEl: HTMLButtonElement | null = $state(null);

    // Focus the Resume button on mount so keyboard users can immediately resume.
    onMount(() => {
        resumeButtonEl?.focus();

        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key === "Escape") {
                e.preventDefault();
                onResume();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    });

    // Trap Tab focus inside the overlay: the only focusable element is the
    // Resume button, so Tab and Shift+Tab both cycle back to it.
    const handleSentinelFocus = (): void => {
        resumeButtonEl?.focus();
    };

    const handleOverlayPointerDown = (e: PointerEvent): void => {
        e.stopPropagation();
        onResume();
    };

    const handleButtonPointerDown = (e: PointerEvent): void => {
        // Stop propagation so the button click doesn't also fire the overlay handler.
        e.stopPropagation();
    };
</script>

<div
    role="dialog"
    aria-modal="true"
    aria-label="Solve paused"
    tabindex="-1"
    class="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-neutral-900/70"
    onpointerdown={handleOverlayPointerDown}
>
    <!-- Focus sentinel: catches Tab-forward from the Resume button and loops focus back -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <span
        tabindex="0"
        onfocus={handleSentinelFocus}
        class="sr-only"
        aria-hidden="true"
    ></span>

    <button
        bind:this={resumeButtonEl}
        class="flex items-center justify-center rounded-lg min-h-14 px-8 py-3 text-lg font-semibold bg-white text-neutral-900 shadow-lg transition-all active:scale-95 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
        onclick={onResume}
        onpointerdown={handleButtonPointerDown}
        aria-label="Resume solve"
    >
        Resume
    </button>

    <!-- Focus sentinel: catches Shift+Tab from the Resume button and loops focus back -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <span
        tabindex="0"
        onfocus={handleSentinelFocus}
        class="sr-only"
        aria-hidden="true"
    ></span>
</div>
