---
name: add-api-route
description: Add a new Hono API route or server-side utility. Use when adding endpoints, handlers, reusable server logic, validation helpers, or data transformation functions.
---

# Add API Route or Server Utility

> All code must follow the **Coding Principles** in AGENTS.md (functional, minimal, readable, modular).

## Route placement
- Small routes (1-2 handlers): add directly to `src/server/index.ts`
- Larger feature routes: create `src/server/routes/{feature-name}.ts` and import into `src/server/index.ts`
- Reusable helpers: create `src/server/lib/{feature-name}.ts`
- Public client routes: `/api/kebab-case`
- Devvit menu items: `/internal/menu/action-name`
- Devvit triggers: `/internal/on-event-name`

## Route handler pattern

```typescript
import { Hono } from 'hono'
import type { Context } from 'hono'
import { context, redis, reddit } from '@devvit/web/server'

const HTTP_STATUS_BAD_REQUEST = 400
const HTTP_STATUS_FORBIDDEN = 403
const HTTP_STATUS_INTERNAL_ERROR = 500

const myHandler = async (c: Context): Promise<Response> => {
  try {
    const userId = requireUserId()
    const result = await doThing()
    return c.json({ status: 'success', data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ status: 'error', message }, HTTP_STATUS_INTERNAL_ERROR)
  }
}

app.get('/api/my-route', myHandler)
```

## Response shapes (always use these)

```typescript
// Success: { status: 'success', data: { ... } }
// Error:   { status: 'error', message: 'Human-readable string' }
// Menu navigation: { navigateTo: 'https://reddit.com/...' }

type SuccessResponse<T> = { status: 'success'; data: T }
type ErrorResponse = { status: 'error'; message: string }
type ApiResponse<T> = SuccessResponse<T> | ErrorResponse
```

## Context guard helpers

Extract these into `src/server/lib/context-guards.ts` when used across multiple routes:

```typescript
import { context } from '@devvit/web/server'

export const requireUserId = (): string => {
  const { userId } = context
  if (!userId) throw new Error('User must be logged in')
  return userId
}

export const requirePostId = (): string => {
  const { postId } = context
  if (!postId) throw new Error('Must be in a post context')
  return postId
}
```

## Utility module pattern

For reusable server logic in `src/server/lib/`:

```typescript
export const parseRedisNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined) return fallback
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  return 'Unknown error'
}
```

---

## Security & Input Validation

Every `/api/*` endpoint is callable by any Reddit user who loads the post. Treat all client input as untrusted.

### Validate request body — never trust raw input

```typescript
const handler = async (c: Context): Promise<Response> => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json({ status: 'error', message: 'Invalid request body' }, HTTP_STATUS_BAD_REQUEST)
  }

  // Validate each field — never spread or destructure blindly
  const { guess } = body as Record<string, unknown>
  if (typeof guess !== 'string' || guess.length === 0 || guess.length > 200) {
    return c.json({ status: 'error', message: 'Invalid guess' }, HTTP_STATUS_BAD_REQUEST)
  }
}
```

### Validation rules

| ❌ Never | ✅ Instead |
|----------|-----------|
| Use `await c.req.json()` then destructure directly | Parse with `.catch(() => null)`, check shape |
| Trust `typeof x === 'string'` alone | Also check length bounds |
| Accept numeric input as-is | `parseInt` + `Number.isNaN` + range check |
| Pass raw user input into Redis keys | Build keys from validated/server-sourced values only |

### Type-safe validator for complex payloads

```typescript
type SubmitGuessInput = { guess: string; difficulty: 'easy' | 'medium' | 'hard' }
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'] as const

const parseSubmitGuess = (raw: unknown): SubmitGuessInput | null => {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const { guess, difficulty } = obj
  if (typeof guess !== 'string' || guess.length === 0 || guess.length > 500) return null
  if (typeof difficulty !== 'string') return null
  if (!VALID_DIFFICULTIES.includes(difficulty as typeof VALID_DIFFICULTIES[number])) return null
  return { guess, difficulty: difficulty as SubmitGuessInput['difficulty'] }
}

// Usage:
const input = parseSubmitGuess(await c.req.json().catch(() => null))
if (!input) {
  return c.json({ status: 'error', message: 'Invalid input' }, HTTP_STATUS_BAD_REQUEST)
}
```

### Authorization — always use `context.userId`

```typescript
// ❌ WRONG: client tells us who they are
const { userId } = await c.req.json()

// ✅ RIGHT: server knows who they are
const { userId } = context
```

### Ownership checks for mutations

```typescript
const owner = await redis.hGet(`game:${postId}:meta`, 'creatorId')
if (owner !== userId) {
  return c.json({ status: 'error', message: 'Not authorized' }, HTTP_STATUS_FORBIDDEN)
}
```

### Redis key safety
- Only use `context.*` values or validated/bounded strings in keys
- Never let user input contain `:` — it's your key delimiter
- If user input must appear in a key (e.g., room code), validate: `/^[a-zA-Z0-9]{4,8}$/`

### Data exposure — return only what the client needs
- Omit internal IDs, solutions, admin flags from responses
- Leaderboards: show username + score, not userId

---

## Constraints
- Functions ≤30 lines, single responsibility
- No `setInterval`, no long-running processes (30s request timeout)
- No filesystem access — use Redis or `media.upload()`
- No native Node modules (sharp, ffmpeg) — use external services

## Checklist before finishing
- [ ] Tests written FIRST in `src/server/__tests__/` using `bun:test` and devvit-mocks
- [ ] Handler is an arrow function with explicit return type
- [ ] try/catch with `instanceof Error` narrowing
- [ ] HTTP status uses named constant, not magic number
- [ ] Route path is kebab-case, named exports only
- [ ] `context.userId` / `context.postId` guarded before use
- [ ] Request body parsed with `.catch(() => null)` and shape-validated
- [ ] Each input field checked for type and length/range bounds
- [ ] No raw user input in Redis keys
- [ ] Identity from `context.userId`, never from request body
- [ ] Response contains only client-necessary fields
- [ ] `bun run test` passes with zero failures
