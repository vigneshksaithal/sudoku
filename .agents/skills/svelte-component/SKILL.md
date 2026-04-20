---
name: svelte-component
description: Create a Svelte 5 component with optional data fetching and Devvit client effects. Use when adding UI components, views, interactive elements, or wiring client-side fetch to server endpoints.
---

# Add Svelte Component

> All code must follow the **Coding Principles** in AGENTS.md (functional, minimal, readable, modular).

## File placement
- Reusable UI component → `src/client/components/ComponentName.svelte`
- Page/view component → `src/client/views/ViewName.svelte`
- PascalCase filenames always

## Svelte 5 runes — required syntax

```svelte
<script lang="ts">
  import { onMount } from 'svelte'

  // State: $state() only — never plain let for reactive values
  let count = $state(0)
  let data = $state<MyType | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)

  // Derived: $derived() for computed values
  let doubled = $derived(count * 2)

  // Effects: $effect() for side effects
  $effect(() => {
    console.log('count changed:', count)
  })
</script>
```

## Layout rules (no scrolling — CRITICAL)

```svelte
<!-- Root component layout — always use this structure -->
<div class="h-full w-full overflow-hidden flex flex-col">
  <header class="flex-none"><!-- fixed height header --></header>
  <main class="flex-1 min-h-0 flex flex-col items-center justify-center">
    <!-- content -->
  </main>
  <footer class="flex-none"><!-- controls --></footer>
</div>
```

| ❌ Never use | ✅ Use instead |
|---|---|
| `overflow-y-auto` | `overflow-hidden` |
| `min-h-screen` / `h-screen` | `h-full` |
| `<style>` blocks | Tailwind classes only |
| `localStorage` | `fetch('/api/...')` |
| `fetch('https://...')` | Server proxy endpoint |
| Svelte 4 syntax (`$:`, `export let`) | Svelte 5 runes |

## Devvit client effects

Available from `@devvit/web/client` — use in response to user-initiated actions:

```typescript
import {
  showToast,
  showForm,
  navigateTo,
  requestExpandedMode,
  getWebViewMode,
  addWebViewModeListener,
  removeWebViewModeListener,
} from '@devvit/web/client'

// For payments
import { purchase, OrderResultStatus } from '@devvit/web/client'

// For realtime
import { connectRealtime } from '@devvit/web/client'
```

### Toast notifications

```svelte
<script lang="ts">
  import { showToast } from '@devvit/web/client'

  const handleAction = (): void => {
    showToast('Action completed!')
  }
</script>
```

### Navigation

```svelte
<script lang="ts">
  import { navigateTo } from '@devvit/web/client'

  const goToSubreddit = (): void => {
    navigateTo('https://www.reddit.com/r/webdev')
  }
</script>
```

### Forms (promise-based)

```svelte
<script lang="ts">
  import { showForm } from '@devvit/web/client'

  const handleShowForm = async (): Promise<void> => {
    const result = await showForm({
      form: {
        fields: [
          { type: 'string', name: 'username', label: 'Username' }
        ],
      },
    })
    if (result) {
      console.log('Form submitted:', result.username)
    }
  }
</script>
```

### Expanded mode (inline → fullscreen)

```svelte
<script lang="ts">
  import { requestExpandedMode, getWebViewMode } from '@devvit/web/client'

  let mode = $state(getWebViewMode()) // 'inline' | 'expanded'

  const handleExpand = async (event: MouseEvent): Promise<void> => {
    try {
      await requestExpandedMode(event, 'game') // entrypoint name from devvit.json
    } catch (e) {
      console.error('Failed to expand:', e)
    }
  }
</script>

{#if mode === 'inline'}
  <button onclick={handleExpand}>Play Game</button>
{:else}
  <!-- Full game UI -->
{/if}
```

### Realtime (live updates)

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { connectRealtime } from '@devvit/web/client'

  let messages = $state<string[]>([])

  onMount(async () => {
    const connection = await connectRealtime({
      channel: 'game-updates',
      onMessage: (data) => {
        messages = [...messages, JSON.stringify(data)]
      },
      onConnect: (channel) => console.log(`Connected to ${channel}`),
      onDisconnect: (channel) => console.log(`Disconnected from ${channel}`),
    })

    return () => {
      connection.disconnect()
    }
  })
</script>
```

### Payments

```svelte
<script lang="ts">
  import { purchase, OrderResultStatus } from '@devvit/web/client'

  let purchasing = $state(false)

  const handleBuy = async (sku: string): Promise<void> => {
    purchasing = true
    try {
      const result = await purchase(sku)
      if (result.status === OrderResultStatus.STATUS_SUCCESS) {
        // show success
      }
    } finally {
      purchasing = false
    }
  }
</script>
```

## Fetch on mount pattern

```svelte
<script lang="ts">
  import { onMount } from 'svelte'

  type MyData = { id: string; value: number }

  let data = $state<MyData | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)

  onMount(async () => {
    try {
      const res = await fetch('/api/my-endpoint')
      if (!res.ok) throw new Error('Failed to load data')
      const json = await res.json()
      if (json.status === 'error') throw new Error(json.message)
      data = json.data
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading = false
    }
  })
</script>

{#if loading}
  <div class="animate-pulse text-center">Loading...</div>
{:else if error}
  <div class="text-red-500 text-center">{error}</div>
{:else if data}
  <div>{data.value}</div>
{/if}
```

## Submit data pattern

```svelte
<script lang="ts">
  let submitting = $state(false)
  let error = $state<string | null>(null)

  const handleSubmit = async (payload: Record<string, unknown>): Promise<void> => {
    submitting = true
    error = null
    try {
      const res = await fetch('/api/my-endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Request failed')
      const json = await res.json()
      if (json.status === 'error') throw new Error(json.message)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      submitting = false
    }
  }
</script>
```

## Response handling

```typescript
// Server always returns one of:
// { status: 'success', data: { ... } }
// { status: 'error', message: 'Human-readable' }
// Always check json.status before accessing json.data
```

## Checklist before finishing
- [ ] Tests written FIRST for any logic extracted into `.ts` helper files
- [ ] Uses `$state()`, `$derived()`, `$effect()` — no Svelte 4 syntax
- [ ] No `<style>` blocks — Tailwind only
- [ ] No `localStorage` / `sessionStorage`
- [ ] No direct external `fetch()` — all through `/api/*`
- [ ] Root container uses `h-full w-full overflow-hidden flex flex-col`
- [ ] Loading, error, and success states all handled in UI
- [ ] POST requests include `Content-Type: application/json` header
- [ ] `finally` block resets loading/submitting state
- [ ] Error narrowing with `instanceof Error`
- [ ] Response `status` field checked before accessing `data`
- [ ] Client effects (`showToast`, `navigateTo`, etc.) only called from user-initiated actions
- [ ] Realtime connections cleaned up in `onMount` return function
- [ ] `bun run test` passes with zero failures
