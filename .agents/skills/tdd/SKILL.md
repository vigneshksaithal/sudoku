---
name: tdd
description: Test-Driven Development workflow using Vitest + @devvit/test. Use when writing any new feature, fixing bugs, or refactoring existing code.
---

# Test-Driven Development (TDD)

> All code must follow the **Coding Principles** in AGENTS.md (functional, minimal, readable, modular).

## The cycle: Red → Green → Refactor

1. **Red** — Write a failing test that describes the desired behavior
2. **Green** — Write the minimal code to make the test pass
3. **Refactor** — Clean up while keeping tests green

Never write implementation code without a failing test first.

## Test runner: Vitest + @devvit/test

```bash
bun run test              # run all tests once
bun run test:watch        # watch mode (dev only)
```

`@devvit/test` provides a miniature Devvit backend per test — in-memory Redis, Reddit API mocks, Scheduler, Realtime, and per-test isolation. No manual mock setup needed.

## File placement

```
src/
├── server/
│   ├── __tests__/          # Server + Devvit integration tests
│   │   ├── post.test.ts
│   │   ├── index.test.ts
│   │   └── redis-integration.test.ts
│   ├── lib/
│   │   └── __tests__/      # Helper/utility tests
│   └── routes/
│       └── __tests__/      # Route-specific tests
└── shared/
    └── __tests__/          # Pure function tests
```

Test files: `*.test.ts` — colocated in `__tests__/` directories next to the code they test.

## Imports

```typescript
import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis, reddit, context } from '@devvit/web/server'
import { expect, vi } from 'vitest'
```

## Test setup with @devvit/test

Each test gets an isolated Devvit world — fresh Redis, fresh context, no state bleed:

```typescript
const test = createDevvitTest()

test('stores and retrieves data', async () => {
  await redis.set('key', 'value')
  const result = await redis.get('key')
  expect(result).toBe('value')
})

test('isolated — previous test state is gone', async () => {
  const result = await redis.get('key')
  expect(result).toBeUndefined()
})
```

## Configuration

```typescript
const test = createDevvitTest({
  username: 'testuser',
  userId: 't2_testuser',
  subredditName: 'testsub',
  settings: { 'my-setting': 'value' },
})
```

## Testing Hono routes

Use `app.request()` — no server startup needed:

```typescript
import { app } from '../index'

const test = createDevvitTest()

test('POST /api/my-route returns success', async () => {
  const res = await app.request('/api/my-route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'value' }),
  })
  expect(res.status).toBe(200)
})
```

## Testing Redis patterns

In-memory Redis supports strings, hashes, sorted sets, counters, and transactions:

```typescript
test('leaderboard sorted set', async () => {
  await redis.zAdd('leaderboard', { member: 'alice', score: 100 })
  await redis.zAdd('leaderboard', { member: 'bob', score: 200 })
  const top = await redis.zRange('leaderboard', 0, 1, { by: 'rank', reverse: true })
  expect(top.map((e) => e.member)).toEqual(['bob', 'alice'])
})
```

## Mocking Reddit API

Use `vi.spyOn` for Reddit API calls:

```typescript
test('submits a post', async ({ subredditName }) => {
  vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_abc' } as never)
  const result = await myFunction()
  expect(reddit.submitCustomPost).toHaveBeenCalledWith({
    subredditName, title: 'My Post', entry: 'default',
  })
})
```

## Seeding test data

```typescript
test('fetches a user', async ({ mocks }) => {
  mocks.reddit.users.addUser({ id: 't2_bob', name: 'bob' })
  const user = await reddit.getUserByUsername('bob')
  expect(user.id).toBe('t2_bob')
})
```

## What to test

| Layer | What to test | Mocking approach |
|-------|-------------|-----------------|
| `shared/` | Pure logic, validators, parsers | None needed |
| `server/lib/` | Business logic, Redis patterns | In-memory Redis (automatic) |
| `server/routes/` | HTTP status, response shape, errors | `app.request()` + `vi.spyOn` |
| `client/*.ts` | Extracted logic (not .svelte) | Standard Vitest mocks |

## TDD rules

1. Write the test first
2. One assertion per behavior
3. Descriptive test names — `'returns 400 when guess exceeds max length'`
4. Test behavior, not internals
5. Use @devvit/test isolation — no beforeEach cleanup needed
6. `bun run test` must pass before committing

## Checklist before finishing
- [ ] Tests written BEFORE implementation code
- [ ] All edge cases covered (undefined, empty, invalid input)
- [ ] Error paths tested (throws, rejects, error responses)
- [ ] Test names describe behavior, not implementation
- [ ] `bun run test` passes with zero failures
