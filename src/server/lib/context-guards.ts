import { context } from '@devvit/web/server'

export const requirePostId = (): string => {
    if (!context.postId) {
        throw new Error('Missing postId')
    }
    return context.postId
}

export const requireSubredditName = (): string => {
    if (!context.subredditName) {
        throw new Error('subredditName is required')
    }
    return context.subredditName
}

export const requireUserId = (): string => {
    if (!context.userId) {
        throw new Error('User must be logged in')
    }
    return context.userId
}
