// ─── Types ────────────────────────────────────────────────────────────────────

export type ScoreCommentData = {
    difficulty: string
    completionTime: number // seconds
    hintsUsed: number
    mistakesCount: number
    notesUsed: boolean
    unranked: boolean
}

// ─── Pure Functions ───────────────────────────────────────────────────────────

/** Format seconds as m:ss (e.g. 154 → "2:34"). */
const formatTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const paddedSeconds = String(seconds).padStart(2, '0')
    return `${minutes}:${paddedSeconds}`
}

/**
 * Format a solve result into a markdown-formatted Reddit comment string.
 *
 * Includes a "Perfect solve!" line when hintsUsed === 0 and mistakesCount === 0.
 */
export const formatScoreComment = (data: ScoreCommentData): string => {
    const { difficulty, completionTime, hintsUsed, mistakesCount, notesUsed, unranked } = data
    const formattedTime = formatTime(completionTime)
    const isPerfect = hintsUsed === 0 && mistakesCount === 0

    const header = `🎯 **${difficulty}** — Solved in **${formattedTime}**`

    const rows = [
        `| Stat | Value |`,
        `|------|-------|`,
        `| ⏱️ Time | ${formattedTime} |`,
        `| 💡 Hints | ${hintsUsed} |`,
        `| ❌ Mistakes | ${mistakesCount} |`,
        `| 📝 Notes | ${notesUsed ? 'Yes' : 'No'} |`,
    ]

    if (unranked) {
        rows.push(`| 🏁 Unranked | Yes |`)
    }

    const table = rows.join('\n')

    const parts = [header, table]
    if (isPerfect) {
        parts.push('🌟 Perfect solve!')
    }

    return parts.join('\n\n')
}
