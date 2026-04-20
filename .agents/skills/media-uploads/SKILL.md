---
name: media-uploads
description: Upload images to Reddit at runtime. Use when users need to share screenshots, generated images, or any dynamic image content.
---

# Media Uploads

> All code must follow the **Coding Principles** in AGENTS.md (functional, minimal, readable, modular).

Apps can only display images hosted on Reddit. Use `media.upload()` to upload images at runtime.

## Setup

Enable the `media` permission in devvit.json:

```json
{
  "permissions": {
    "media": true
  }
}
```

## Server-side upload

```typescript
import { media } from '@devvit/media'

app.post('/api/upload-screenshot', async (c) => {
  const { image } = await c.req.json<{ image: string }>()

  const response = await media.upload({
    url: image,       // HTTP URL or data URL
    type: 'png',      // 'image' | 'gif' | 'png' | 'jpg'
  })

  return c.json({
    status: 'success',
    data: {
      mediaId: response.mediaId,
      mediaUrl: response.mediaUrl,  // Reddit-hosted URL
    },
  })
})
```

## Client-side: canvas screenshot

```typescript
// Capture canvas as data URL
const canvas = document.querySelector('canvas')
const dataUrl = canvas.toDataURL('image/png')

// Send to server for upload
const res = await fetch('/api/upload-screenshot', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image: dataUrl }),
})
```

## Limits

- GIF uploads: max 20 MB
- Only Reddit-hosted URLs can be displayed in posts

## Testing

```typescript
import { createDevvitTest } from '@devvit/test/server/vitest'
import { media } from '@devvit/media'
import { expect } from 'vitest'

const test = createDevvitTest()

test('uploads media assets', async ({ mocks }) => {
  const response = await media.upload({
    url: 'https://example.com/image.png',
    type: 'image',
  })
  expect(response.mediaId).toBe('media-1')
  expect(response.mediaUrl).toContain('https://i.redd.it/')
  expect(mocks.media.uploads).toHaveLength(1)
})
```

Note: In tests, uploads don't hit the network. The mock records the payload and returns synthetic IDs/URLs.

## Checklist before finishing
- [ ] Tests written FIRST for upload handlers
- [ ] `permissions.media: true` added to devvit.json
- [ ] Upload happens server-side only (not from client)
- [ ] Response returns Reddit-hosted URL to client
- [ ] `bun run test` passes with zero failures
