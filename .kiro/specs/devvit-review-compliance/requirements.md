# Requirements Document

## Introduction

The Sudoku Devvit app was rejected during app review for two compliance issues: (1) user-generated content (community puzzle submissions) is posted as the app account instead of the user, and (2) game score comments are not supported. This spec addresses both issues to bring the app into compliance with Devvit's app review policies.

**Issue 1 — User-Generated Content (UGC):** Community puzzle posts must be submitted as the user (not the app) with proper UGC attribution, so content is reportable and traceable to the authoring user.

**Issue 2 — Game Scoring:** When a user completes a puzzle, they must be able to explicitly share their score as a Reddit comment posted as the user, replying to a sticky comment on the game post (not as a top-level comment).

## Glossary

- **App**: The Sudoku Devvit application running server-side, identified as the app account when posting to Reddit.
- **User**: The logged-in Reddit user interacting with the Sudoku app inside a post.
- **Community_Post**: A custom post created via `reddit.submitCustomPost()` for a user-submitted puzzle.
- **Sticky_Comment**: A distinguished, stickied comment posted by the App on a game post, serving as the parent thread for score replies.
- **Score_Comment**: A Reddit comment posted as the User, replying to the Sticky_Comment, containing the user's solve time and stats.
- **Devvit_Config**: The `devvit.json` configuration file that declares app permissions, entrypoints, and server settings.
- **Completion_Screen**: The UI shown in `App.svelte` after a user successfully solves a puzzle.
- **Post_Creation**: The server-side function in `src/server/post.ts` that generates daily puzzle posts.
- **Community_Submit_Endpoint**: The `POST /api/community/submit` Hono route that handles community puzzle submissions.
- **Score_Comment_Endpoint**: A new `POST /api/score/comment` Hono route that handles posting score comments.
- **Puzzle_Hash**: The Redis hash at key `puzzle:{postId}` storing puzzle data, metadata, and the Sticky_Comment ID.

## Requirements

### Requirement 1: Devvit Permissions for User Actions

**User Story:** As a developer, I want the Devvit_Config to declare user-action permissions, so that the app can submit posts and comments on behalf of users.

#### Acceptance Criteria

1. THE Devvit_Config SHALL include a `permissions.reddit.asUser` array containing `"SUBMIT_POST"` and `"SUBMIT_COMMENT"`.
2. WHEN the Devvit_Config is loaded by the Devvit platform, THE Devvit_Config SHALL remain valid against the Devvit JSON schema.

### Requirement 2: Community Puzzle Posts Submitted as User

**User Story:** As a user, I want my community puzzle submission to be posted under my Reddit account, so that the content is properly attributed to me and reportable.

#### Acceptance Criteria

1. WHEN a user submits a community puzzle via the Community_Submit_Endpoint, THE Community_Submit_Endpoint SHALL call `reddit.submitCustomPost()` with `runAs: 'USER'`.
2. WHEN a user submits a community puzzle via the Community_Submit_Endpoint, THE Community_Submit_Endpoint SHALL include a `userGeneratedContent` field containing the puzzle string in the `text` property.
3. WHEN a community puzzle post is created, THE Community_Submit_Endpoint SHALL post the attribution comment as the App account (without `runAs: 'USER'`).

### Requirement 3: Sticky Comment on Game Posts

**User Story:** As a developer, I want each game post to have a stickied comment from the app, so that user score comments have a designated parent thread to reply to.

#### Acceptance Criteria

1. WHEN a daily puzzle post is created by Post_Creation, THE Post_Creation SHALL submit a comment as the App account with text indicating it is the score thread.
2. WHEN the App submits the score thread comment, THE Post_Creation SHALL distinguish and sticky that comment.
3. WHEN the Sticky_Comment is created, THE Post_Creation SHALL store the comment ID in the Puzzle_Hash under the field `stickyCommentId`.
4. IF the Sticky_Comment creation fails, THEN THE Post_Creation SHALL log the error and continue without blocking post creation.

### Requirement 4: Sticky Comment on Community Posts

**User Story:** As a developer, I want community puzzle posts to also have a stickied score thread, so that users who solve community puzzles can share their scores.

#### Acceptance Criteria

1. WHEN a community puzzle post is created via the Community_Submit_Endpoint, THE Community_Submit_Endpoint SHALL submit a Sticky_Comment as the App account.
2. WHEN the App submits the Sticky_Comment on a community post, THE Community_Submit_Endpoint SHALL distinguish and sticky that comment.
3. WHEN the Sticky_Comment is created on a community post, THE Community_Submit_Endpoint SHALL store the comment ID in the Puzzle_Hash under the field `stickyCommentId`.
4. IF the Sticky_Comment creation on a community post fails, THEN THE Community_Submit_Endpoint SHALL log the error and continue without blocking post creation.

### Requirement 5: Score Comment Endpoint

**User Story:** As a user, I want to post my solve score as a Reddit comment replying to the score thread, so that my achievement is visible to other users on the post.

#### Acceptance Criteria

1. THE Score_Comment_Endpoint SHALL accept a POST request with `difficulty`, `completionTime`, `hintsUsed`, and `mistakesCount` fields in the JSON body.
2. WHEN a valid request is received, THE Score_Comment_Endpoint SHALL retrieve the `stickyCommentId` from the Puzzle_Hash for the current post.
3. WHEN the `stickyCommentId` is available, THE Score_Comment_Endpoint SHALL submit a comment as the User (`runAs: 'USER'`) replying to the Sticky_Comment.
4. THE Score_Comment_Endpoint SHALL format the Score_Comment text to include the difficulty, solve time, hints used, and mistakes count.
5. IF the user is not logged in, THEN THE Score_Comment_Endpoint SHALL return HTTP 401 with an error message.
6. IF the `stickyCommentId` is not found in the Puzzle_Hash, THEN THE Score_Comment_Endpoint SHALL return HTTP 400 with an error message indicating the score thread is unavailable.
7. IF the comment submission fails, THEN THE Score_Comment_Endpoint SHALL return HTTP 500 with a descriptive error message.

### Requirement 6: Comment My Score Button on Completion Screen

**User Story:** As a user, I want a "Comment My Score" button on the completion screen, so that I can explicitly choose to share my score as a Reddit comment.

#### Acceptance Criteria

1. WHEN the Completion_Screen is displayed, THE Completion_Screen SHALL render a "Comment My Score" button.
2. WHEN the user clicks the "Comment My Score" button, THE Completion_Screen SHALL send a POST request to the Score_Comment_Endpoint with the current solve data.
3. WHILE the score comment request is in progress, THE Completion_Screen SHALL disable the button and display a loading indicator.
4. WHEN the score comment is posted successfully, THE Completion_Screen SHALL replace the button with a success confirmation message.
5. IF the score comment request fails, THEN THE Completion_Screen SHALL display the error message and re-enable the button for retry.
6. WHEN the score comment has been posted successfully, THE Completion_Screen SHALL prevent the user from posting a duplicate score comment by keeping the button in the success state.

### Requirement 7: Score Comment Format

**User Story:** As a user, I want my score comment to be clearly formatted, so that other users can easily read my solve stats.

#### Acceptance Criteria

1. THE Score_Comment_Endpoint SHALL format the comment text to include the difficulty level, formatted solve time (minutes:seconds), number of hints used, and number of mistakes.
2. WHEN hints used is zero and mistakes count is zero, THE Score_Comment_Endpoint SHALL include a "Perfect solve!" indicator in the comment text.
