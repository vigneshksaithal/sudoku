---
name: api-route
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
- Scheduler tasks: `/internal/cron/task-name`
- Form submissions: `/internal/forms/form-name`
- Payment handlers: `/internal/payments/fulfill` or `/internal/payments/refund`

## Available server imports

```typescript
import { Hono } from 'hono'
import type { Context } from 'hono'
import { context, redis, reddit, realtime, cache, settings } from '@devvit/web/server'
import { scheduler } from '@devvit/web/server'
import { media } from '@devvit/media'
import { notifications } from '@devvit/notifications'
import { payments } from '@devvit/web/server'
import type {
  MenuItemRequest,
  UiResponse,
  TriggerResponse,
  TaskRequest,
  TaskResponse,
  OnPostSubmitRequest,
  OnCommentCreateRequest,
  JsonObject,
} from '@devvit/web/shared'
```

## Route handler pattern

```typescript
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

type SuccessResponse<T> = { status: 'success'; data: T }
type ErrorResponse = { status: 'error'; message: string }
type ApiResponse<T> = SuccessResponse<T> | ErrorResponse
```

### Menu item responses (UiResponse)

Menu handlers return `UiResponse` from `@devvit/web/shared`:

```typescript
// Navigate
return c.json<UiResponse>({ navigateTo: 'https://reddit.com/...' })

// Toast
return c.json<UiResponse>({ showToast: 'Action completed!' })

// Show form (requires forms config in devvit.json)
return c.json<UiResponse>({
  showForm: {
    name: 'myForm',
    form: { fields: [{ type: 'string', name: 'input', label: 'Value' }] },
    data: { input: 'default' }
  }
})
```

### Trigger responses

```typescript
return c.json<TriggerResponse>({ status: 'ok' })
```

### Scheduler task responses

```typescript
return c.json<TaskResponse>({ status: 'ok' })
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

## Platform limits

| Limit | Value |
|---|---|
| Max request time | 30 seconds |
| Max request payload | 4 MB |
| Max response size | 10 MB |

## Constraints
- Functions ≤30 lines, single responsibility
- No `setInterval`, no long-running processes (30s request timeout)
- No filesystem access — use Redis or `media.upload()`
- No native Node modules (sharp, ffmpeg) — use external services
- All server endpoints must start with `/api/` (client-facing) or `/internal/` (platform)

## Checklist before finishing
- [ ] Tests written FIRST in `src/server/__tests__/` using `@devvit/test`
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
- [ ] Typed request/response types used for menu/trigger/scheduler handlers
- [ ] `bun run test` passes with zero failures
