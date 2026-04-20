---
name: scheduler
description: Schedule recurring cron jobs or one-off delayed tasks. Use when building periodic cleanups, timed game events, delayed notifications, or any time-based server logic.
---

# Add Scheduler Tasks

> All code must follow the **Coding Principles** in AGENTS.md (functional, minimal, readable, modular).

## Setup

### 1. Declare tasks in devvit.json

```json
{
  "scheduler": {
    "tasks": {
      "daily-cleanup": {
        "endpoint": "/internal/cron/daily-cleanup",
        "cron": "0 2 * * *"
      },
      "game-timeout": "/internal/cron/game-timeout"
    }
  }
}
```

- Tasks with `cron` run automatically on schedule
- Tasks without `cron` are one-off — triggered at runtime via `scheduler.runJob()`
- `data` (optional): static data passed to cron tasks

### 2. Handle task events in server

```typescript
import { scheduler, redis } from '@devvit/web/server'
import type { TaskRequest, TaskResponse } from '@devvit/web/server'

// Recurring cron handler
app.post('/internal/cron/daily-cleanup', async (c) => {
  const _input = await c.req.json<TaskRequest>()
  // cleanup logic
  console.log(`Cleanup at ${new Date().toISOString()}`)
  return c.json<TaskResponse>({ status: 'ok' })
})

// One-off task handler
app.post('/internal/cron/game-timeout', async (c) => {
  const { data } = await c.req.json<TaskRequest<{ postId: string }>>()
  const { postId } = data!
  await redis.set(`game:${postId}:state`, 'expired')
  return c.json<TaskResponse>({ status: 'ok' })
})
```

### 3. Schedule one-off jobs at runtime

```typescript
import { scheduler } from '@devvit/web/server'
import type { ScheduledJob } from '@devvit/web/server'

app.post('/api/start-game', async (c) => {
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)

  const job: ScheduledJob = {
    id: `timeout-${context.postId}-${Date.now()}`,
    name: 'game-timeout',           // must match a task key in devvit.json
    data: { postId: context.postId },
    runAt: fiveMinutesFromNow,
  }

  const jobId = await scheduler.runJob(job)

  // Store job ID in Redis for later cancellation
  await redis.set(`job:${context.postId}`, jobId)

  return c.json({ status: 'success', data: { jobId } })
})
```

### 4. Cancel a scheduled job

```typescript
app.post('/api/cancel-game', async (c) => {
  const jobId = await redis.get(`job:${context.postId}`)
  if (jobId) {
    await scheduler.cancelJob(jobId)
    await redis.del(`job:${context.postId}`)
  }
  return c.json({ status: 'success', data: {} })
})
```

## Cron format

Standard 5-part or 6-part (with seconds):

```
# * * * * *
# | | | | |
# | | | | day of week (0-6, Sun-Sat)
# | | | month (1-12)
# | | day of month (1-31)
# | hour (0-23)
# minute (0-59)

# 6-part with seconds:
# */30 * * * * *  → every 30 seconds
```

## Limits

| Limit | Value |
|---|---|
| Max live recurring actions per installation | 10 |
| `runJob()` creation rate | 60 calls/minute |
| Delivery rate | 60 deliveries/minute |
| Minimum resolution | ~1 second (6-part cron) |

## Testing

```typescript
import { createDevvitTest } from '@devvit/test/server/vitest'
import { scheduler } from '@devvit/web/server'
import { expect } from 'vitest'

const test = createDevvitTest()

test('schedules a one-off job', async () => {
  const jobId = await scheduler.runJob({
    id: 'test-job',
    name: 'game-timeout',
    data: { postId: 't3_abc' },
    runAt: new Date(Date.now() + 60000),
  })
  expect(jobId).toBeDefined()

  const jobs = await scheduler.listJobs()
  expect(jobs.length).toBeGreaterThan(0)
})
```

Note: In tests, scheduled jobs don't actually wait for `runAt` or cron triggers. Use `scheduler.listJobs()` to verify they were scheduled.

## Checklist before finishing
- [ ] Tests written FIRST for scheduler handlers
- [ ] Task declared in `devvit.json` under `scheduler.tasks`
- [ ] Endpoint follows `/internal/cron/*` convention
- [ ] Handler uses `TaskRequest` / `TaskResponse` types
- [ ] One-off job IDs stored in Redis for cancellation
- [ ] Job name matches a key in `scheduler.tasks`
- [ ] `bun run test` passes with zero failures
