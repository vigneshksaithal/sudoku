---
name: devvit-viewport
description: Devvit webview platform constraints — viewport dimensions, pixel budgets, touch targets, and overflow prevention. Read this BEFORE designing or laying out any UI.
---

# Devvit Viewport & Platform Constraints

> Read this skill before writing ANY layout or sizing code. Devvit webviews run inside Reddit posts with fixed, non-negotiable dimensions. If you don't plan for the pixel budget, the UI will overflow.

## Viewport Dimensions

Devvit posts have a **fixed height** set in `devvit.json`. The width varies by device/context.

### Height (set via `post.entrypoints.*.height`)

| Height | Pixels | Use case |
|--------|--------|----------|
| `"short"` | ~240px | Simple widgets, counters, single-action UI |
| `"regular"` | ~320px | Cards, small games, compact interfaces |
| `"tall"` | ~512px | Full games, complex multi-section UI |

**This app uses `"tall"` (~512px).** Every pixel of vertical space must be accounted for.

### Width (varies by context)

| Context | Approximate width |
|---------|-------------------|
| Mobile inline (feed) | ~343px |
| Mobile expanded | Full screen (~375–430px) |
| Desktop inline | ~600–700px (post container) |
| Desktop expanded | Modal, varies |

**Design for 343px width first.** Everything else is bonus space.

## View Modes

### Inline Mode (default — in-feed)
- Fixed height, no scrolling, no overflow
- **Only tap/click input** — no drag, swipe, pinch, or scroll gestures
- Must not trap scroll — users scroll past your post in the feed
- Must load in under 1 second
- Cannot auto-launch expanded mode

### Expanded Mode (user-triggered modal/fullscreen)
- More vertical space (full screen on mobile, modal on desktop)
- Full gesture support (drag, swipe, etc.)
- Must be triggered by explicit user action (button tap)

## Pixel Budget Planning — CRITICAL

Before laying out a screen, do the math. Subtract fixed elements from the total height to find remaining space.

### Example: This app's "playing" screen (tall = ~512px)

```
Total height:                    512px
─ Vertical padding (py-2 × 2):  -16px
─ Difficulty tabs row:           -36px
─ Gap between sections:          -16px  (2 × gap-2)
─ NumberPad + controls:         -140px
─ Validation message (if any):  -24px
                                ──────
Available for grid + hints:     ~280px
```

### Rules for pixel budgeting

1. **Add up all fixed-height elements first** — headers, toolbars, button rows, status bars
2. **The remaining space is your flex zone** — use `flex-1 min-h-0` for the content area
3. **Never assume more space than the budget allows** — if your grid needs 350px but only 280px remain, it will overflow
4. **Account for conditional elements** — hint panels, error messages, toasts all eat vertical space
5. **Test at the smallest viewport** — 343×512 (mobile inline tall) is your worst case

### Vertical space guidelines by height mode

| Height | Fixed chrome budget | Flex content budget |
|--------|--------------------|--------------------|
| `"short"` (240px) | ≤60px | ~180px |
| `"regular"` (320px) | ≤80px | ~240px |
| `"tall"` (512px) | ≤200px | ~312px |

## Layout Patterns That Prevent Overflow

### Root container — always

```svelte
<div class="h-full w-full overflow-hidden flex flex-col">
  <!-- everything inside -->
</div>
```

### Fixed + flexible partitioning

```svelte
<div class="h-full w-full overflow-hidden flex flex-col">
  <header class="shrink-0"><!-- fixed height --></header>
  <main class="flex-1 min-h-0 flex flex-col items-center">
    <!-- flexible content — will shrink to fit -->
  </main>
  <footer class="shrink-0"><!-- fixed height controls --></footer>
</div>
```

### Aspect-ratio content (grids, boards)

```svelte
<!-- Let the grid fill available width, constrained by height -->
<div class="w-full max-w-md aspect-square max-h-full">
  <!-- grid content -->
</div>
```

Use `max-h-full` on aspect-ratio elements so they shrink when vertical space is tight.

## Touch & Interaction

### Minimum touch target sizes

| Element | Minimum size | Tailwind class |
|---------|-------------|----------------|
| Buttons | 44×44px | `min-h-11 min-w-11` |
| Grid cells | 36×36px | Acceptable for dense grids |
| Icon buttons | 44×44px | `min-h-11 min-w-11` |
| Spacing between targets | ≥4px | `gap-1` minimum |

### Inline mode gesture rules
- ✅ `click`, `pointerdown`, `pointerup`, `touchstart` (tap only)
- ❌ No `scroll`, `wheel`, `drag`, `pinch`, `swipe` listeners
- ❌ No `overflow-y-auto`, `overflow-x-auto`, `overflow-scroll`
- ✅ `touch-action: manipulation` on interactive elements (prevents double-tap zoom)

## Typography Scale

At these viewport sizes, font sizes must be compact but readable.

| Role | Size | Tailwind | Notes |
|------|------|----------|-------|
| Primary UI text | 14px | `text-sm` | Default for labels, values |
| Secondary/caption | 12px | `text-xs` | Hints, status messages |
| Large heading | 18–20px | `text-lg` / `text-xl` | Sparingly — eats vertical space |
| Grid cell digits | 16–20px | `text-base` / `text-lg` | Must be readable in small cells |
| Button labels | 14px | `text-sm` | With `font-medium` or `font-semibold` |

**Never use `text-2xl` or larger in inline mode** — it wastes precious vertical pixels.

## Theme Support (Required)

Devvit apps must support both light and dark mode via `prefers-color-scheme`.

```svelte
<div class="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
```

- Always define both light and dark variants for backgrounds, text, borders
- Test in both themes — the UI simulator has a toggle
- Avoid pure black (`#000`) and pure white (`#fff`) — use neutral-900/neutral-100

## Performance Constraints

| Metric | Target |
|--------|--------|
| Initial content load | < 1 second |
| Lighthouse score (mobile) | > 80 |
| Bundle size | Minimize — sandboxed webview |
| No external fetches | All API calls through `/api/*` server proxy |

## Common Overflow Causes — Anti-Patterns

| ❌ Anti-pattern | Why it breaks | ✅ Fix |
|----------------|---------------|--------|
| `h-screen` / `min-h-screen` | Webview is NOT the screen — it's a post container | `h-full` |
| Fixed `height: 400px` on content | Exceeds budget on short/regular modes | `flex-1 min-h-0` |
| `overflow-y-auto` on any element | Scroll traps violate inline mode rules | `overflow-hidden` + fit content |
| Large padding (`p-8`, `py-6`) | Eats 48–96px of vertical budget | `p-2` / `px-2 py-2` max |
| `gap-4` or larger between sections | 16px+ gaps add up fast across 4–5 sections | `gap-1` or `gap-2` |
| Unconditional elements (always-visible hints, messages) | Permanent vertical space consumption | Show conditionally, overlay, or collapse |
| `text-2xl` / `text-3xl` headings | 24–30px line height + margin wastes space | `text-lg` max for headings |
| Margin on outer containers | Pushes content outside the viewport | Padding on inner containers only |
| `aspect-square` without `max-h-full` | Square element exceeds available height | Add `max-h-full` constraint |
| Multiple stacked rows of buttons | Each row costs ~48px minimum | Combine into single row, use icons |

## Checklist Before Finishing Any UI Work

- [ ] Calculated pixel budget for the target height mode
- [ ] Root container uses `h-full w-full overflow-hidden flex flex-col`
- [ ] All fixed elements use `shrink-0`, flexible content uses `flex-1 min-h-0`
- [ ] Touch targets ≥ 44×44px (`min-h-11 min-w-11`)
- [ ] No scroll containers in inline mode
- [ ] Font sizes ≤ `text-lg` for headings, `text-sm` for body
- [ ] Padding ≤ `p-2` / `px-4` on outer containers
- [ ] Gaps ≤ `gap-2` between major sections
- [ ] Both light and dark mode styled
- [ ] Tested at 343×512 (mobile inline tall) — nothing overflows
- [ ] Conditional elements (hints, errors, toasts) don't push layout when visible
- [ ] No `h-screen`, `min-h-screen`, `overflow-auto`, or `overflow-scroll`
