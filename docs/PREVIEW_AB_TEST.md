# Preview Screen A/B Test System

## Overview

The preview screen (the first thing users see in the Reddit feed before clicking play) uses a **5-variant A/B test** to determine which design converts best. Each time a user sees the post, one variant is randomly selected. When they click "Play", the variant is tracked in Redis so we can compare conversion rates.

## The 5 Variants

| Variant | Name | Philosophy | Key Elements |
|---------|------|-----------|--------------|
| **A** | Minimal | Less is more. Maximum whitespace, pure intrigue. | Title (36px) + subtitle + date pill + CTA + solve count |
| **B** | Grid Hero | Show don't tell. The puzzle IS the hook. | Date pill + large 9x9 grid (56vw) + title + CTA |
| **C** | Competitive | Trigger competitive instinct. | Title + "Can you make the leaderboard?" + fake top-3 entries + CTA |
| **D** | Choice | Agency = investment. Choosing difficulty increases follow-through. | "Pick your challenge" + 4 difficulty cards with descriptions + CTA |
| **E** | Social Proof | FOMO + social validation. Everyone is playing. | "LIVE" pill + smaller grid (48vw) + stats row (solves + avg time) + CTA |

## How It Works

### Client Side (`src/client/preview/main.ts`)

1. On render, `pickVariant()` selects A-E uniformly at random
2. The corresponding `renderVariantX()` function builds the screen
3. When the user clicks the CTA (or the grid in variants B/E), two things happen:
   - `trackClick(variant)` fires a `POST /api/preview/track` request (fire-and-forget)
   - `requestExpandedMode(event, 'game')` launches the game

### Server Side (`src/server/index.ts`)

Two new endpoints:

#### `POST /api/preview/track`
Records a click for the given variant.

**Request body:**
```json
{ "variant": "A" }
```

**Redis operations:**
- `HINCRBY preview:clicks:{postId} {variant} 1` — per-post tracking
- `HINCRBY preview:clicks:all {variant} 1` — global aggregate

**Response:** `{ "status": "success", "data": {} }`

#### `GET /api/preview/stats`
Returns global click counts for all variants.

**Response:**
```json
{
  "status": "success",
  "data": { "A": "142", "B": "287", "C": "95", "D": "163", "E": "221" }
}
```

## Redis Schema

| Key | Type | Fields | Purpose |
|-----|------|--------|---------|
| `preview:clicks:all` | Hash | `A`, `B`, `C`, `D`, `E` (string integers) | Global aggregate across all posts |
| `preview:clicks:{postId}` | Hash | `A`, `B`, `C`, `D`, `E` (string integers) | Per-post breakdown |

## How to Check Results

Call the stats endpoint from any post context:
```
GET /api/preview/stats
```

Or check Redis directly:
```
HGETALL preview:clicks:all
```

The variant with the highest click count relative to impressions is the winner. Since impressions are uniformly distributed (1/5 each), raw click counts directly indicate conversion rate.

## Design Decisions

1. **No impression tracking** — We only track clicks, not views. Since the random distribution is uniform (1/5 each), higher clicks = higher conversion. Adding impression tracking would require a second fire-and-forget on render, which adds load without much value at this scale.

2. **Fire-and-forget tracking** — The `fetch()` call uses `.catch(() => {})`. If tracking fails, the game still launches. Analytics should never block UX.

3. **Per-post + global** — Per-post data shows if a variant works better for certain puzzle types (e.g., community vs generated). Global gives the aggregate winner.

4. **No user-level persistence** — Each page load gets a fresh random variant. We don't sticky a variant per user because Reddit post previews are stateless inline renders.

5. **Dark theme only** — All variants use a dark background (`#0f0f1a`). Reddit's feed is predominantly dark-mode, and the dark background creates the most contrast/attention in the feed.

6. **Overflow prevention** — All variants use `height: 100%; overflow: hidden` on the scene container with carefully sized elements to fit within Devvit's "tall" post height (~512px) without scrolling.

## When to Retire the Test

After collecting ~1,000+ total clicks (roughly 200 per variant), compare:
- If one variant has >30% more clicks than the average, it's a clear winner
- If results are within 10% of each other, they're equivalent — pick based on brand preference
- Once decided, replace `pickVariant()` with a hardcoded return of the winner

## File Locations

| File | Role |
|------|------|
| `src/client/preview/main.ts` | All 5 variant renderers + random selection + click tracking |
| `src/server/index.ts` | `POST /api/preview/track` + `GET /api/preview/stats` endpoints |
| `docs/PREVIEW_AB_TEST.md` | This documentation |
