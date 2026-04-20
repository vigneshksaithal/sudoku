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

`@devvit/test` provides a miniature Devvit backend per test — in-memory Redis, Reddit API mocks, Scheduler, Realtime, Media, Notifications, and per-test isolation. No manual mock setup needed.

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
import { redis } from '@devvit/redis'
import { reddit } from '@devvit/reddit'
import { realtime } from '@devvit/web/server'
import { expect, vi } from 'vitest'
```

**Important:** In test files, use `@devvit/redis` and `@devvit/reddit` for Redis and Reddit imports. The test harness resolves these correctly. For other capabilities, use `@devvit/web/server`.

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
  subredditId: 't5_testsub',
  settings: { 'my-setting': 'value' },
})
```

## Test fixtures and mocks

Each test receives Devvit-specific fixtures as arguments:

```typescript
test('uses fixtures', async ({ mocks, userId, subredditName }) => {
  // userId = 't2_testuser' (from config)
  // subredditName = 'testsub' (from config)
  // mocks = object with helpers for inspecting mock state
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

test('commits redis transactions', async () => {
  await redis.set('txn', '0')
  const txn = await redis.watch('txn')
  await txn.multi()
  await txn.incrBy('txn', 4)
  await txn.incrBy('txn', 1)
  const results = await txn.exec()
  expect(results).toStrictEqual([4, 5])
  expect(await redis.get('txn')).toBe('5')
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

## Testing Realtime

```typescript
import { realtime } from '@devvit/web/server'

test('emits realtime events', async ({ mocks }) => {
  await realtime.send('scores', { latest: 42 })
  const messages = mocks.realtime.getSentMessagesForChannel('scores')
  expect(messages).toHaveLength(1)
  expect(messages[0].data?.msg).toStrictEqual({ latest: 42 })
})
```

## Testing Media uploads

```typescript
import { media } from '@devvit/media'

test('uploads media assets', async ({ mocks }) => {
  const response = await media.upload({
    url: 'https://example.com/image.png',
    type: 'image',
  })
  expect(response.mediaId).toBe('media-1')
  expect(mocks.media.uploads).toHaveLength(1)
})
```

## Testing Notifications

```typescript
import { notifications } from '@devvit/notifications'

test('sends push notifications', async ({ mocks, userId }) => {
  await notifications.optInCurrentUser()
  await notifications.enqueue({
    title: 'Hello',
    body: 'World',
    recipients: [{ userId }],
  })
  const sent = mocks.notifications.getSentNotifications()
  expect(sent).toHaveLength(1)
  expect(sent[0].title).toBe('Hello')
})
```

## Testing HTTP (blocked by default)

HTTP requests throw by default in tests. Mock `globalThis.fetch` to test code that makes HTTP calls:

```typescript
test('mocks external HTTP', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ data: 'test' }), { status: 200 })
  )
  const res = await fetch('https://api.example.com/data')
  expect(res.status).toBe(200)
  vi.restoreAllMocks()
})
```

## Capability support matrix

| Capability | Status | Notes |
|---|---|---|
| Redis | ✅ Supported | Per-test isolation; transactions supported |
| Scheduler | ✅ Supported | Jobs listed immediately; time does not advance |
| Settings | ✅ Supported | Per-test isolation; configurable defaults |
| Realtime | ✅ Supported | In-memory recording of sent/received messages |
| Media | ✅ Supported | In-memory uploads with synthetic IDs/URLs |
| Notifications | ✅ Supported | In-memory recording |
| HTTP | ✅ Blocked by default | Mock `fetch` to allow |
| Reddit API | ⚠️ Partial | Helpful errors for unimplemented methods |
| Payments | ❌ Not yet | — |

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
- [ ] HTTP calls mocked with `vi.spyOn(globalThis, 'fetch')`
- [ ] `bun run test` passes with zero failures
