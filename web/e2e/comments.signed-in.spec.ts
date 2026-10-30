import type { Page, Request } from '@playwright/test'
import { createTranslator } from 'next-intl'

import type { CommentReactionPress } from '@/components/features/comments/hooks/use-press-comment-reaction'
import type {
  CommentDto,
  CommentReactionDto,
} from '@/components/features/comments/services/comment-api-types'
import { PENDING_COMMENT_REACTION_STORAGE_KEY } from '@/constants/local-storage-constants'

import messages from '../messages/en.json'
import { gateReads } from './support/answer-gate'
import { BACKEND_ORIGIN, returnToTab } from './support/backend-routes'
import {
  commentBy,
  commentFrom,
  READER_ID,
  READER_NAME,
  sendComment,
  stubChangingPageThread,
  stubNamedReader,
  stubPageThread,
  threadPage,
  THREADS_PATH,
} from './support/comments'
import { editorCopy } from './support/competitions'
import { expect, test } from './support/test'

/** The copy a thread reads under. */
const commentsCopy = messages.comments

/** A function which fills counted nouns, the way the page does. */
const pluralText = createTranslator({ locale: 'en', messages, namespace: 'plurals' })

/** How long the page has to show the thread before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 30_000

/** What a comment by somebody other than the reader says. */
const THEIR_TEXT = 'The third problem falls to induction.'

/** What the comment saying {@link THEIR_TEXT} says once its author edits it. */
const THEIR_EDITED_TEXT = 'The third problem falls to a parity argument.'

/** What the reader's own comment says. */
const OWN_TEXT = 'Strong induction is needed here.'

/** What the reader's own comment says once they edit it. */
const EDITED_TEXT = 'Plain induction is enough.'

/** What the reader replies. */
const REPLY_TEXT = 'Which induction, though?'

/** What Martin's reply says. */
const MARTIN_TEXT = 'A parity argument is shorter.'

/** What the reader replies to Martin. */
const MARTIN_REPLY_TEXT = 'Shorter, but does it cover the odd case?'

/** How long a press gets to go out before a test is willing to say none did. */
const LANDING_WINDOW_MS = 1_000

/** Martin's thumbs up. */
const MARTIN_AGREES: CommentReactionDto = {
  userId: 'user_martin',
  name: 'Martin',
  kind: 'thumbsUp',
}

/**
 * A reaction pressed while signed out and left for after the sign-in, which pressing then would get wrong.
 */
type UnreplayedPress = {
  /** What the test is about. */
  title: string
  /** The comment the reaction was pressed on. */
  comment: CommentDto
}

/**
 * A comment by somebody other than the reader.
 *
 * @returns The comment, Zuzana's.
 */
function theirComment(): CommentDto {
  // Written by Zuzana
  return commentFrom('user_zuzana', 'Zuzana', THEIR_TEXT)
}

/**
 * The reader's own comment.
 *
 * @returns The comment, signed with {@link READER_NAME}.
 */
function ownComment(): CommentDto {
  // Written by the reader
  return commentFrom(READER_ID, READER_NAME, OWN_TEXT)
}

/**
 * A comment as its author's edit leaves it: a new version under an id of its own, posted when the comment was.
 *
 * @param edited - The comment.
 * @param content - What it says now.
 *
 * @returns The new version.
 */
function rewritten(edited: CommentDto, content: string): CommentDto {
  // The comment under a new id, saying what it says now, edited just now
  return { ...edited, id: crypto.randomUUID(), content, editedAt: new Date().toISOString() }
}

/**
 * Leaves a reaction pressed while signed out in the browser, as a visitor pressing it before signing in would.
 *
 * @param page - The page, not yet opened.
 * @param pending - The reaction pressed.
 */
async function leavePendingPress(page: Page, pending: CommentReactionPress): Promise<void> {
  // Waiting in the browser before the page loads
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: PENDING_COMMENT_REACTION_STORAGE_KEY,
    value: JSON.stringify(pending),
  })
}

/**
 * Opens the thread's page and waits for the thread to show.
 *
 * @param page - The page.
 * @param shown - Something the thread says, which marks it as read.
 */
async function openThread(page: Page, shown: string): Promise<void> {
  // The page holding the thread
  await page.goto(threadPage())

  // Once the thread is read
  await expect(page.getByText(shown)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })
}

/**
 * The button pressing one of a comment's reactions.
 *
 * @param page - The page.
 * @param label - The reaction's name.
 * @param pressed - Whether the reader holds it, left out to find it either way.
 *
 * @returns The button on Zuzana's comment.
 */
function reactionOn(page: Page, label: string, pressed?: boolean) {
  // The icon named after the reaction, the count beside it carrying a number in its name
  return commentBy(page, 'Zuzana', THEIR_TEXT).getByRole('button', {
    name: label,
    exact: true,
    pressed,
  })
}

/**
 * The count of one of a comment's reactions, a button naming who gave it, there only once somebody has.
 *
 * @param page - The page.
 * @param label - The reaction's name.
 * @param count - How many gave it.
 *
 * @returns The count on Zuzana's comment.
 */
function countOn(page: Page, label: string, count: number) {
  // Named after the reaction, then the count
  return commentBy(page, 'Zuzana', THEIR_TEXT).getByRole('button', {
    name: `${label} ${count}`,
    exact: true,
  })
}

/**
 * Whether a call the page makes reads a thread.
 *
 * @param request - The call.
 *
 * @returns True for a read of a thread.
 */
function isThreadRead(request: Request): boolean {
  // A read of the threads' own address, which the counts' and the presses' addresses only start with
  return request.method() === 'GET' && new URL(request.url()).pathname === THREADS_PATH
}

test.describe('a comment thread, read by a signed-in reader', () => {
  test.beforeEach(async ({ page }) => {
    // A reader with a username, which a thread asks for before it takes a comment
    await stubNamedReader(page)
  })

  test('writes a comment, and a reply under the comment it answers', async ({ page }) => {
    // Somebody else's comment
    const answered = theirComment()

    // The thread, and what reaches the backend
    const writes = await stubPageThread(page, [answered])

    // The thread's page, opened
    await openThread(page, THEIR_TEXT)

    // A comment, sent
    await sendComment(page.getByPlaceholder(commentsCopy.writePlaceholder), OWN_TEXT)

    // In the thread, signed by the reader
    await expect(commentBy(page, READER_NAME, OWN_TEXT)).toBeVisible()

    // A reply, opened under the other comment
    await commentBy(page, 'Zuzana', THEIR_TEXT)
      .getByRole('button', { name: commentsCopy.reply })
      .click()

    // The box it is written in
    const replyBox = page.getByPlaceholder(commentsCopy.replyPlaceholder)

    // Holding the cursor
    await expect(replyBox).toBeFocused()

    // Written
    await replyBox.fill(REPLY_TEXT)

    // And sent from the keyboard
    await replyBox.press('Meta+Enter')

    // Closed once the reply is taken
    await expect(replyBox).toHaveCount(0)

    // Which is in the thread
    await expect(page.getByText(REPLY_TEXT)).toBeVisible()

    // A reply, opened under the other comment again
    await commentBy(page, 'Zuzana', THEIR_TEXT)
      .getByRole('button', { name: commentsCopy.reply })
      .first()
      .click()

    // Empty, what was sent gone from it
    await expect(replyBox).toHaveValue('')

    // Each sent where it belongs, the reply naming what it answers
    expect(writes().map((write) => write.kind === 'sent' && write.parentCommentId)).toEqual([
      null,
      answered.id,
    ])

    // The replies under the other comment, hidden
    await page.getByRole('button', { name: commentsCopy.hideReplies }).click()

    // Taking the reply with them, since it hangs off that comment
    await expect(page.getByText(REPLY_TEXT)).toBeHidden()
  })

  test('keeps a comment in its box when sending it fails', async ({ page }) => {
    // A thread whose backend fails every comment sent into it
    await stubPageThread(page, [theirComment()], (write) => write.kind === 'sent')

    // The thread's page, opened
    await openThread(page, THEIR_TEXT)

    // The box a new comment is written in
    const box = page.getByPlaceholder(commentsCopy.writePlaceholder)

    // A comment, written
    await box.fill(OWN_TEXT)

    // And sent from the keyboard
    await box.press('Meta+Enter')

    // The failure, told
    await expect(page.getByText(commentsCopy.errors.addFailed)).toBeVisible()

    // The comment still in its box, to send again
    await expect(box).toHaveValue(OWN_TEXT)
  })

  test('keeps a reply open on its text when sending it fails', async ({ page }) => {
    // A thread whose backend fails every comment sent into it
    await stubPageThread(page, [theirComment()], (write) => write.kind === 'sent')

    // The thread's page, opened
    await openThread(page, THEIR_TEXT)

    // A reply, opened under the comment
    await commentBy(page, 'Zuzana', THEIR_TEXT)
      .getByRole('button', { name: commentsCopy.reply })
      .click()

    // The box it is written in
    const replyBox = page.getByPlaceholder(commentsCopy.replyPlaceholder)

    // Written
    await replyBox.fill(REPLY_TEXT)

    // And sent from the keyboard
    await replyBox.press('Meta+Enter')

    // The failure, told
    await expect(page.getByText(commentsCopy.errors.addFailed)).toBeVisible()

    // The reply still open on its text, to send again
    await expect(replyBox).toHaveValue(REPLY_TEXT)
  })

  test('sends a reply once, however the reader replies elsewhere and comes back to it while it is on its way', async ({
    page,
  }) => {
    // Zuzana's comment, which Martin answered
    const answered = {
      ...theirComment(),
      replies: [commentFrom('user_martin', 'Martin', MARTIN_TEXT)],
    }

    // The thread, and what reaches the backend
    const writes = await stubPageThread(page, [answered])

    // Every comment sent passing a gate, open to begin with
    const gate = await gateReads(page, `${BACKEND_ORIGIN}/comments`)

    // The thread's page, opened
    await openThread(page, THEIR_TEXT)

    // The box a reply is written in
    const replyBox = page.getByPlaceholder(commentsCopy.replyPlaceholder)

    // The gate, shut, and a function which opens it again
    const release = gate.hold()

    // A reply to Zuzana, opened under her comment
    await commentBy(page, 'Zuzana', THEIR_TEXT)
      .getByRole('button', { name: commentsCopy.reply })
      .first()
      .click()

    // Written
    await replyBox.fill(REPLY_TEXT)

    // And sent from the keyboard, to stop at the gate
    await replyBox.press('Meta+Enter')

    // A reply to Martin, opened under his
    await commentBy(page, 'Martin', MARTIN_TEXT)
      .getByRole('button', { name: commentsCopy.reply })
      .click()

    // Written
    await replyBox.fill(MARTIN_REPLY_TEXT)

    // And sent behind the reply to Zuzana
    await replyBox.press('Meta+Enter')

    // The reply to Zuzana, opened again while it is still on its way
    await commentBy(page, 'Zuzana', THEIR_TEXT)
      .getByRole('button', { name: commentsCopy.reply })
      .first()
      .click()

    // Holding what was sent
    await expect(replyBox).toHaveValue(REPLY_TEXT)

    // And sent from the keyboard once more
    await replyBox.press('Meta+Enter')

    // The gate let open
    release()

    // The reply to Martin in the thread
    await expect(page.getByText(MARTIN_REPLY_TEXT)).toBeVisible()

    // And the one to Zuzana
    await expect(page.getByText(REPLY_TEXT).first()).toBeVisible()

    // Long enough for a second send to have landed, had there been one
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // Each sent once
    expect(writes().map((write) => write.kind === 'sent' && write.content)).toEqual([
      REPLY_TEXT,
      MARTIN_REPLY_TEXT,
    ])
  })

  test('hides a reply open under a reply while its thread is folded, and brings it back on its text', async ({
    page,
  }) => {
    // Zuzana's comment, which Martin answered
    const answered = {
      ...theirComment(),
      replies: [commentFrom('user_martin', 'Martin', MARTIN_TEXT)],
    }

    // The thread
    await stubPageThread(page, [answered])

    // The thread's page, opened
    await openThread(page, THEIR_TEXT)

    // A reply, opened under Martin's
    await commentBy(page, 'Martin', MARTIN_TEXT)
      .getByRole('button', { name: commentsCopy.reply })
      .click()

    // The box it is written in
    const replyBox = page.getByPlaceholder(commentsCopy.replyPlaceholder)

    // Half written
    await replyBox.fill(REPLY_TEXT)

    // Zuzana's replies folded away
    await page.getByRole('button', { name: commentsCopy.hideReplies }).click()

    // Taking the reply being written with them
    await expect(replyBox).toHaveCount(0)

    // The box for a new comment still there to write in
    await expect(page.getByPlaceholder(commentsCopy.writePlaceholder)).toBeVisible()

    // Shown again
    await page
      .getByRole('button', {
        name: `${commentsCopy.show} ${pluralText('replies', { count: 1 })}`,
      })
      .click()

    // The reply open again on what was written in it
    await expect(replyBox).toHaveValue(REPLY_TEXT)
  })

  test("edits the reader's own comment in place, which its author can't react to", async ({
    page,
  }) => {
    // The reader's comment, which Martin agrees with
    const own = { ...ownComment(), reactions: [MARTIN_AGREES] }

    // The thread, and what reaches the backend
    const writes = await stubPageThread(page, [own])

    // The thread's page, opened
    await openThread(page, OWN_TEXT)

    // The comment
    const comment = commentBy(page, READER_NAME, OWN_TEXT)

    // Counting Martin's thumbs up
    await expect(comment.getByRole('button', { name: `${commentsCopy.thumbsUp} 1` })).toBeVisible()

    // Offering its author no thumbs up to press
    await expect(
      comment.getByRole('button', { name: commentsCopy.thumbsUp, exact: true })
    ).toHaveCount(0)

    // Nor a thumbs down
    await expect(
      comment.getByRole('button', { name: commentsCopy.thumbsDown, exact: true })
    ).toHaveCount(0)

    // Opened for editing
    await comment.getByRole('button', { name: commentsCopy.edit }).click()

    // The box it is edited in
    const box = page.getByPlaceholder(commentsCopy.editPlaceholder)

    // Holding what it says
    await expect(box).toHaveValue(OWN_TEXT)

    // Rewritten
    await box.fill(EDITED_TEXT)

    // And saved from the keyboard
    await box.press('Meta+Enter')

    // Saying what it says now, marked as edited
    await expect(commentBy(page, READER_NAME, EDITED_TEXT)).toContainText(commentsCopy.edited)

    // Saved
    await expect.poll(writes).toEqual([{ kind: 'edited', commentId: own.id, content: EDITED_TEXT }])

    // Long enough for the answer to the save to have landed
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // No reply opened by the save
    await expect(page.getByPlaceholder(commentsCopy.replyPlaceholder)).toHaveCount(0)
  })

  test("keeps a reply open on its text under the reader's own comment through an edit of the comment", async ({
    page,
  }) => {
    // The reader's comment, alone in the thread
    await stubPageThread(page, [ownComment()])

    // The thread's page, opened
    await openThread(page, OWN_TEXT)

    // A reply, opened under the reader's comment
    await commentBy(page, READER_NAME, OWN_TEXT)
      .getByRole('button', { name: commentsCopy.reply })
      .click()

    // Half written
    await page.getByPlaceholder(commentsCopy.replyPlaceholder).fill(REPLY_TEXT)

    // The reader's comment, opened for editing
    await commentBy(page, READER_NAME, OWN_TEXT)
      .getByRole('button', { name: commentsCopy.edit })
      .click()

    // The box it is edited in
    const box = page.getByPlaceholder(commentsCopy.editPlaceholder)

    // Rewritten
    await box.fill(EDITED_TEXT)

    // And saved from the keyboard, which gives it a new id
    await box.press('Meta+Enter')

    // Saying what it says now, marked as edited
    await expect(commentBy(page, READER_NAME, EDITED_TEXT)).toContainText(commentsCopy.edited)

    // The reply still open under the comment, on what was written in it
    await expect(page.getByPlaceholder(commentsCopy.replyPlaceholder)).toHaveValue(REPLY_TEXT)

    // The page read afresh
    await page.reload()

    // The reply opened again under the comment as it reads now
    await commentBy(page, READER_NAME, EDITED_TEXT)
      .getByRole('button', { name: commentsCopy.reply })
      .click()

    // On the draft kept for the comment's new version
    await expect(page.getByPlaceholder(commentsCopy.replyPlaceholder)).toHaveValue(REPLY_TEXT)
  })

  test("keeps a reply open on its text, the cursor in it, under somebody else's comment they edit meanwhile", async ({
    page,
  }) => {
    // The clock under the test's hand, so the next read comes when the test says
    await page.clock.install()

    // Zuzana's comment, alone in the thread, which she edits midway
    const changeThread = await stubChangingPageThread(page, [theirComment()])

    // The thread's page, opened
    await openThread(page, THEIR_TEXT)

    // A reply, opened under Zuzana's comment
    await commentBy(page, 'Zuzana', THEIR_TEXT)
      .getByRole('button', { name: commentsCopy.reply })
      .click()

    // The box the reply is written in
    const replyBox = page.getByPlaceholder(commentsCopy.replyPlaceholder)

    // Half written
    await replyBox.fill(REPLY_TEXT)

    // Zuzana's comment edited meanwhile, which gives it a new id
    changeThread((comments) => comments.map((posted) => rewritten(posted, THEIR_EDITED_TEXT)))

    // Long enough for the open thread to be read again
    await page.clock.fastForward('00:31')

    // Zuzana's comment as it reads now, marked as edited
    await expect(commentBy(page, 'Zuzana', THEIR_EDITED_TEXT)).toContainText(commentsCopy.edited)

    // The reply still open on what was written in it, the cursor still in it
    await expect(replyBox).toHaveValue(REPLY_TEXT)
    await expect(replyBox).toBeFocused()

    // The page read afresh
    await page.reload()

    // The reply opened again under Zuzana's comment as it reads now
    await commentBy(page, 'Zuzana', THEIR_EDITED_TEXT)
      .getByRole('button', { name: commentsCopy.reply })
      .click()

    // On the draft kept for the comment
    await expect(replyBox).toHaveValue(REPLY_TEXT)
  })

  test("keeps the replies of somebody else's comment folded through their edit of it", async ({
    page,
  }) => {
    // The clock under the test's hand, so the next read comes when the test says
    await page.clock.install()

    // Zuzana's comment, which Martin answered, and which she edits midway
    const changeThread = await stubChangingPageThread(page, [
      { ...theirComment(), replies: [commentFrom('user_martin', 'Martin', MARTIN_TEXT)] },
    ])

    // The thread's page, opened
    await openThread(page, THEIR_TEXT)

    // The comment's replies folded away
    await page.getByRole('button', { name: commentsCopy.hideReplies }).click()

    // Martin's reply out of sight
    await expect(page.getByText(MARTIN_TEXT)).toBeHidden()

    // Zuzana's comment edited meanwhile, which gives it a new id
    changeThread((comments) => comments.map((posted) => rewritten(posted, THEIR_EDITED_TEXT)))

    // Long enough for the open thread to be read again
    await page.clock.fastForward('00:31')

    // Zuzana's comment as it reads now
    await expect(page.getByText(THEIR_EDITED_TEXT)).toBeVisible()

    // Martin's reply still folded away
    await expect(page.getByText(MARTIN_TEXT)).toBeHidden()
  })

  test("keeps the replies of the reader's own comment folded through an edit of it", async ({
    page,
  }) => {
    // The reader's comment, which Zuzana answered
    await stubPageThread(page, [{ ...ownComment(), replies: [theirComment()] }])

    // The thread's page, opened
    await openThread(page, OWN_TEXT)

    // The comment's replies folded away
    await page.getByRole('button', { name: commentsCopy.hideReplies }).click()

    // Zuzana's reply out of sight
    await expect(page.getByText(THEIR_TEXT)).toBeHidden()

    // The reader's comment, opened for editing
    await commentBy(page, READER_NAME, OWN_TEXT)
      .getByRole('button', { name: commentsCopy.edit })
      .click()

    // The box it is edited in
    const box = page.getByPlaceholder(commentsCopy.editPlaceholder)

    // Rewritten
    await box.fill(EDITED_TEXT)

    // And saved from the keyboard, which gives it a new id
    await box.press('Meta+Enter')

    // Saying what it says now, marked as edited
    await expect(commentBy(page, READER_NAME, EDITED_TEXT)).toContainText(commentsCopy.edited)

    // The box gone once the backend took the edit, its new id in the thread by then
    await expect(box).toHaveCount(0)

    // Long enough for the new id to have reached the screen
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // Zuzana's reply still folded away
    await expect(page.getByText(THEIR_TEXT)).toBeHidden()
  })

  test('keeps an edit open when saving it fails', async ({ page }) => {
    // A thread whose backend fails every edit
    await stubPageThread(page, [ownComment()], (write) => write.kind === 'edited')

    // The thread's page, opened
    await openThread(page, OWN_TEXT)

    // The reader's comment, opened for editing
    await commentBy(page, READER_NAME, OWN_TEXT)
      .getByRole('button', { name: commentsCopy.edit })
      .click()

    // The box it is edited in
    const box = page.getByPlaceholder(commentsCopy.editPlaceholder)

    // Rewritten
    await box.fill(EDITED_TEXT)

    // And saved from the keyboard
    await box.press('Meta+Enter')

    // The failure, told
    await expect(page.getByText(commentsCopy.errors.editFailed)).toBeVisible()

    // The edit still open on the new text, to save again
    await expect(box).toHaveValue(EDITED_TEXT)
  })

  test("deletes the reader's own comment once they confirm, its place kept while a reply hangs off it", async ({
    page,
  }) => {
    // The reader's comment, which Zuzana answered
    const own = { ...ownComment(), replies: [theirComment()] }

    // The thread, and what reaches the backend
    const writes = await stubPageThread(page, [own])

    // The thread's page, opened
    await openThread(page, OWN_TEXT)

    // A reply, opened under the reader's comment
    await commentBy(page, READER_NAME, OWN_TEXT)
      .getByRole('button', { name: commentsCopy.reply })
      .click()

    // The reply's box showing
    await expect(page.getByPlaceholder(commentsCopy.replyPlaceholder)).toBeVisible()

    // The reader's comment, deleted
    await commentBy(page, READER_NAME, OWN_TEXT)
      .getByRole('button', { name: commentsCopy.delete })
      .click()

    // Once they confirm
    await page.getByRole('dialog').getByRole('button', { name: commentsCopy.delete }).click()

    // Gone from the thread
    await expect(page.getByText(OWN_TEXT)).toBeHidden()

    // Its place kept, marked as deleted
    await expect(page.getByText(`[${commentsCopy.deleted}]`)).toBeVisible()

    // With the reply still under it
    await expect(page.getByText(THEIR_TEXT)).toBeVisible()

    // The reply the reader opened, closed
    await expect(page.getByPlaceholder(commentsCopy.replyPlaceholder)).toHaveCount(0)

    // The box for a new comment still there to write in
    await expect(page.getByPlaceholder(commentsCopy.writePlaceholder)).toBeVisible()

    // Deleted
    await expect.poll(writes).toEqual([{ kind: 'deleted', commentId: own.id }])
  })

  test('deletes a comment just edited, under the id its edit gave it', async ({ page }) => {
    // The reader's own comment
    const own = ownComment()

    // The thread, and what reaches the backend
    const writes = await stubPageThread(page, [own])

    // The thread's page, opened
    await openThread(page, OWN_TEXT)

    // The reader's comment, opened for editing
    await commentBy(page, READER_NAME, OWN_TEXT)
      .getByRole('button', { name: commentsCopy.edit })
      .click()

    // The box it is edited in
    const box = page.getByPlaceholder(commentsCopy.editPlaceholder)

    // Rewritten
    await box.fill(EDITED_TEXT)

    // And saved from the keyboard
    await box.press('Meta+Enter')

    // Closed once the save is answered
    await expect(box).toHaveCount(0)

    // The comment, deleted
    await commentBy(page, READER_NAME, EDITED_TEXT)
      .getByRole('button', { name: commentsCopy.delete })
      .click()

    // Once they confirm
    await page.getByRole('dialog').getByRole('button', { name: commentsCopy.delete }).click()

    // Both sent to the backend
    await expect.poll(() => writes().map((write) => write.kind)).toEqual(['edited', 'deleted'])

    // The delete naming the id the edit gave the comment, the one it was posted under being gone
    expect(writes()[1]).not.toEqual({ kind: 'deleted', commentId: own.id })
  })

  test("puts the reader's comment back when deleting it fails", async ({ page }) => {
    // A thread whose backend fails every delete
    await stubPageThread(page, [ownComment()], (write) => write.kind === 'deleted')

    // The thread's page, opened
    await openThread(page, OWN_TEXT)

    // The reader's comment, deleted
    await commentBy(page, READER_NAME, OWN_TEXT)
      .getByRole('button', { name: commentsCopy.delete })
      .click()

    // Once they confirm
    await page.getByRole('dialog').getByRole('button', { name: commentsCopy.delete }).click()

    // The failure, told
    await expect(page.getByText(commentsCopy.errors.deleteFailed)).toBeVisible()

    // The comment back in the thread, as it was
    await expect(commentBy(page, READER_NAME, OWN_TEXT)).toBeVisible()
  })

  test('presses a reaction, swaps it for the other one, and takes that back', async ({ page }) => {
    // A comment Martin agrees with
    const comment = { ...theirComment(), reactions: [MARTIN_AGREES] }

    // The thread, and what reaches the backend
    const writes = await stubPageThread(page, [comment])

    // The thread's page, opened
    await openThread(page, THEIR_TEXT)

    // A thumbs up, pressed
    await reactionOn(page, commentsCopy.thumbsUp).click()

    // Held by the reader
    await expect(reactionOn(page, commentsCopy.thumbsUp, true)).toBeVisible()

    // Counted beside Martin's
    await expect(countOn(page, commentsCopy.thumbsUp, 2)).toBeVisible()

    // The count, pointed at
    await countOn(page, commentsCopy.thumbsUp, 2).hover()

    // Naming the reader after Martin
    await expect(page.getByRole('tooltip').getByRole('listitem')).toHaveText([
      'Martin',
      READER_NAME,
    ])

    // The thumbs down, pressed instead
    await reactionOn(page, commentsCopy.thumbsDown).click()

    // Held by the reader
    await expect(reactionOn(page, commentsCopy.thumbsDown, true)).toBeVisible()

    // Counted
    await expect(countOn(page, commentsCopy.thumbsDown, 1)).toBeVisible()

    // In the thumbs up's place, which the reader no longer holds
    await expect(reactionOn(page, commentsCopy.thumbsUp, false)).toBeVisible()

    // Leaving Martin's alone in its count
    await expect(countOn(page, commentsCopy.thumbsUp, 1)).toBeVisible()

    // The thumbs down, pressed again
    await reactionOn(page, commentsCopy.thumbsDown).click()

    // Taken back
    await expect(reactionOn(page, commentsCopy.thumbsDown, false)).toBeVisible()

    // Leaving nobody to count
    await expect(countOn(page, commentsCopy.thumbsDown, 1)).toHaveCount(0)

    // And the reader holding neither
    await expect(reactionOn(page, commentsCopy.thumbsUp, false)).toBeVisible()

    // Each press sent as the reaction pressed
    await expect
      .poll(() => writes().map((write) => write.kind === 'pressed' && write.reaction))
      .toEqual(['thumbsUp', 'thumbsDown', 'thumbsDown'])
  })

  test('sends one press at a time, and shows what the backend holds when one fails with another waiting behind it', async ({
    page,
  }) => {
    // A comment nobody has reacted to
    const comment = theirComment()

    // The thread, whose backend fails every thumbs up, and what reaches the backend
    const writes = await stubPageThread(
      page,
      [comment],
      (write) => write.kind === 'pressed' && write.reaction === 'thumbsUp'
    )

    // A gate every press waits at, open until the test holds it
    const presses = await gateReads(page, `${BACKEND_ORIGIN}/comments/*/reaction`)

    // Every press as it leaves the browser, before the gate
    const sent: string[] = []

    // Each call the page makes, watched as it leaves
    page.on('request', (request) => {
      // Kept when it presses a reaction
      if (request.url().endsWith('/reaction')) sent.push(request.url())
    })

    // The thread's page, opened
    await openThread(page, THEIR_TEXT)

    // The gate, shut, and a function which opens it again
    const release = presses.hold()

    // A thumbs up, pressed, and stopped at the gate
    await reactionOn(page, commentsCopy.thumbsUp).click()

    // Shown as held meanwhile
    await expect(reactionOn(page, commentsCopy.thumbsUp, true)).toBeVisible()

    // A thumbs down, pressed behind it
    await reactionOn(page, commentsCopy.thumbsDown).click()

    // Shown as held in its place
    await expect(reactionOn(page, commentsCopy.thumbsDown, true)).toBeVisible()

    // Long enough for the thumbs down to have gone out, had it not waited its turn
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // Only the thumbs up on its way, the thumbs down waiting until it is answered
    expect(sent).toHaveLength(1)

    // Both let through, the thumbs up failing first
    release()

    // The failure, told
    await expect(page.getByText(commentsCopy.errors.reactionFailed)).toBeVisible()

    // Both reached the backend
    await expect
      .poll(() => writes().map((write) => write.kind === 'pressed' && write.reaction))
      .toEqual(['thumbsUp', 'thumbsDown'])

    // The thumbs down the backend took, held by the reader, rather than the nothing the failure rolled back to
    await expect(reactionOn(page, commentsCopy.thumbsDown, true)).toBeVisible()

    // And counted
    await expect(countOn(page, commentsCopy.thumbsDown, 1)).toBeVisible()
  })

  test('reads the open thread again every little while, but never while a press is still out', async ({
    page,
  }) => {
    // The clock under the test's hand, so the next read comes when the test says
    await page.clock.install()

    // A comment nobody has reacted to, and its thread
    await stubPageThread(page, [theirComment()])

    // A gate every press waits at, open until the test holds it
    const presses = await gateReads(page, `${BACKEND_ORIGIN}/comments/*/reaction`)

    // The thread's page, opened
    await openThread(page, THEIR_TEXT)

    // How many reads of the thread have gone out since
    let reads = 0

    // Each call the page makes, watched as it leaves
    page.on('request', (request) => {
      // Counted when it reads the thread
      if (isThreadRead(request)) reads++
    })

    // Long enough for the open thread to be read again
    await page.clock.fastForward('00:31')

    // One read of the thread goes out
    await expect.poll(() => reads).toBe(1)

    // The gate, shut, and a function which opens it again
    const release = presses.hold()

    // A thumbs up, pressed, and stopped at the gate
    await reactionOn(page, commentsCopy.thumbsUp).click()

    // Shown as held meanwhile
    await expect(reactionOn(page, commentsCopy.thumbsUp, true)).toBeVisible()

    // Long enough for another read
    await page.clock.fastForward('00:31')

    // And a return from another tab, which reads an open thread again too
    await returnToTab(page)

    // Time for a read the clock or the return to the tab set off to go out
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // None did, which could have landed the thread from before the press over it
    expect(reads).toBe(1)

    // The press let through
    release()

    // Counted once it lands
    await expect(countOn(page, commentsCopy.thumbsUp, 1)).toBeVisible()
  })

  // Presses left from before the sign-in that the page drops
  const unreplayed: UnreplayedPress[] = [
    {
      title:
        "drops a reaction pressed while signed out on what turns out to be the reader's own comment",
      comment: ownComment(),
    },
    {
      title: 'drops a reaction pressed while signed out that the reader already holds',
      comment: {
        ...theirComment(),
        reactions: [{ userId: READER_ID, name: READER_NAME, kind: 'thumbsDown' }],
      },
    },
  ]

  // One test per press
  for (const { title, comment } of unreplayed) {
    test(title, async ({ page }) => {
      // The thread, and what reaches the backend
      const writes = await stubPageThread(page, [comment])

      // The thumbs down pressed while signed out, left for after the sign-in
      await leavePendingPress(page, { commentId: comment.id, kind: 'thumbsDown' })

      // The thread's page, opened
      await openThread(page, comment.content)

      // The waiting reaction, cleared from the browser
      await expect
        .poll(() =>
          page.evaluate(
            (key) => JSON.parse(window.localStorage.getItem(key) ?? 'null'),
            PENDING_COMMENT_REACTION_STORAGE_KEY
          )
        )
        .toBeNull()

      // Long enough for a press to have gone out, had one been made
      await page.waitForTimeout(LANDING_WINDOW_MS)

      // Without being pressed again
      expect(writes()).toEqual([])
    })
  }

  test('presses a reaction left from before the sign-in, swapping the one the reader held', async ({
    page,
  }) => {
    // Martin's reply, which the reader gave a thumbs up
    const reply = {
      ...commentFrom('user_martin', 'Martin', MARTIN_TEXT),
      reactions: [{ userId: READER_ID, name: READER_NAME, kind: 'thumbsUp' as const }],
    }

    // The thread, the reply under Zuzana's comment, and what reaches the backend
    const writes = await stubPageThread(page, [{ ...theirComment(), replies: [reply] }])

    // A thumbs down pressed on the reply while signed out, left for after the sign-in
    await leavePendingPress(page, { commentId: reply.id, kind: 'thumbsDown' })

    // The thread's page, opened
    await openThread(page, MARTIN_TEXT)

    // The thumbs down, pressed
    await expect
      .poll(writes)
      .toEqual([{ kind: 'pressed', commentId: reply.id, reaction: 'thumbsDown' }])

    // Held by the reader in the thumbs up's place
    await expect(
      commentBy(page, 'Martin', MARTIN_TEXT).getByRole('button', {
        name: commentsCopy.thumbsDown,
        exact: true,
        pressed: true,
      })
    ).toBeVisible()
  })
})

test.describe('a comment thread, read on a phone', () => {
  // A phone's width, where a reply opens over the whole screen
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    // A reader with a username, which a thread asks for before it takes a reply
    await stubNamedReader(page)
  })

  test('writes a reply in an editor over the whole screen, which closes once the reply is taken', async ({
    page,
  }) => {
    // Somebody else's comment
    const answered = theirComment()

    // The thread, and what reaches the backend
    const writes = await stubPageThread(page, [answered])

    // The thread's page, opened
    await openThread(page, THEIR_TEXT)

    // A reply, opened under the comment
    await commentBy(page, 'Zuzana', THEIR_TEXT)
      .getByRole('button', { name: commentsCopy.reply })
      .click()

    // The editor it is written in, over the whole screen
    const expanded = page.getByRole('dialog', { name: editorCopy.expandedEditor })

    // The editor showing its box
    await expect(expanded.locator('textarea')).toBeVisible()

    // The only box the reply has, none under the comment
    await expect(page.getByPlaceholder(commentsCopy.replyPlaceholder)).toHaveCount(1)

    // Written
    await expanded.locator('textarea').fill(REPLY_TEXT)

    // And sent from the keyboard
    await page.keyboard.press('ControlOrMeta+Enter')

    // Closed once the reply is taken
    await expect(expanded).toHaveCount(0)

    // Which is in the thread
    await expect(page.getByText(REPLY_TEXT)).toBeVisible()

    // Sent under the comment it answers
    expect(writes().map((write) => write.kind === 'sent' && write.parentCommentId)).toEqual([
      answered.id,
    ])
  })
})

test.describe('a comment thread, read by a signed-in reader with no username', () => {
  test('asks the reader to choose one before they comment or reply', async ({ page }) => {
    // The thread
    await stubPageThread(page, [theirComment()])

    // The thread's page, opened
    await openThread(page, THEIR_TEXT)

    // The reader, asked to choose a username
    await expect(page.getByText(messages.profile.usernameGateBody)).toBeVisible()

    // In place of the box a comment is written in
    await expect(page.getByPlaceholder(commentsCopy.writePlaceholder)).toHaveCount(0)

    // With no reply offered under the comment either
    await expect(
      commentBy(page, 'Zuzana', THEIR_TEXT).getByRole('button', { name: commentsCopy.reply })
    ).toHaveCount(0)
  })
})
