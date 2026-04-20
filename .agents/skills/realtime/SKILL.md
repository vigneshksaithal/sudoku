---
name: realtime
description: Add live, event-driven updates to posts using Devvit Realtime. Use when building multiplayer features, live scoreboards, chat, or any feature where users need to see each other's changes in real time.
---

# Add Realtime

> All code must follow the **Coding Principles** in AGENTS.md (functional, minimal, readable, modular).

## Architecture

- **Server-side** (`realtime.send`): Send messages to channels
- **Client-side** (`connectRealtime`): Subscribe to channels and receive messages

Messages flow server → client. Clients subscribe; servers publish.

## Server-side: sending messages

```typescript
import { realtime } from '@devvit/web/server'

// Send a simple message
await realtime.send('notifications', 'New user joined!')

// Send a structured message
await realtime.send('game-updates', {
  type: 'score-update',
  playerId: 'user123',
  score: 1500,
  timestamp: Date.now(),
})
```

### Common patterns

Send from an API route after a user action:

```typescript
app.post('/api/submit-move', async (c) => {
  const body = await c.req.json()
  // ... process move, update Redis ...

  // Broadcast to all connected clients
  await realtime.send(`game:${context.postId}`, {
    type: 'move',
    player: context.userId,
    position: body.position,
  })

  return c.json({ status: 'success', data: {} })
})
```

Send from a scheduler task:

```typescript
app.post('/internal/cron/update-scores', async (c) => {
  const scores = await redis.zRange('leaderboard', 0, 9, { by: 'rank', reverse: true })
  await realtime.send('live-scores', { scores })
  return c.json({ status: 'ok' })
})
```

## Client-side: receiving messages

```typescript
import { connectRealtime } from '@devvit/web/client'

const connection = await connectRealtime({
  channel: 'game-updates',
  onMessage: (data) => {
    console.log('Received:', data)
  },
  onConnect: (channel) => {
    console.log(`Connected to ${channel}`)
  },
  onDisconnect: (channel) => {
    console.log(`Disconnected from ${channel}`)
  },
})

// Disconnect when done
await connection.disconnect()
```

### Svelte integration

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { connectRealtime } from '@devvit/web/client'

  type GameUpdate = { type: string; score: number }

  let updates = $state<GameUpdate[]>([])
  let connected = $state(false)

  onMount(async () => {
    const connection = await connectRealtime({
      channel: 'game-updates',
      onMessage: (data) => {
        updates = [...updates, data as GameUpdate]
      },
      onConnect: () => { connected = true },
      onDisconnect: () => { connected = false },
    })

    return () => {
      connection.disconnect()
    }
  })
</script>
```

## Limits

| Limit | Value |
|---|---|
| Max message payload | 1 MB |
| Max messages/second per installation | 100 |
| Channel name | No `:` character allowed |

## Testing

```typescript
import { createDevvitTest } from '@devvit/test/server/vitest'
import { realtime } from '@devvit/web/server'
import { expect } from 'vitest'

const test = createDevvitTest()

test('emits realtime events', async ({ mocks }) => {
  await realtime.send('scores', { latest: 42 })
  const messages = mocks.realtime.getSentMessagesForChannel('scores')
  expect(messages).toHaveLength(1)
  expect(messages[0].data?.msg).toStrictEqual({ latest: 42 })
})
```

## Checklist before finishing
- [ ] Tests written FIRST for server-side realtime logic
- [ ] Server sends via `realtime.send(channel, data)`
- [ ] Client subscribes via `connectRealtime()` from `@devvit/web/client`
- [ ] Connection cleaned up on component unmount
- [ ] Channel names don't contain `:`
- [ ] Message payloads under 1 MB
- [ ] `bun run test` passes with zero failures
