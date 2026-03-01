import { context, reddit } from '@devvit/web/server'

export const createPost = async () => {
  const { subredditName } = context
  if (!subredditName) {
    throw new Error('subredditName is required')
  }

  return await reddit.submitCustomPost({
    subredditName,
    // TODO: Add a title
    title: '{{ name }}',
    entry: 'default'
  })
}
