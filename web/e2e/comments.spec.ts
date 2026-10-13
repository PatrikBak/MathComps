import { createTranslator } from 'next-intl'

import messages from '../messages/en.json'
import {
  commentBy,
  commentFrom,
  stubNamedReader,
  stubPageThread,
  threadPage,
} from './support/comments'
import { loginPromptFor, signInTestUser } from './support/session'
import { expect, test } from './support/test'

/** The copy a thread reads under. */
const commentsCopy = messages.comments

/** A function which declines a counted noun with the number in front of it, the way the page does. */
const pluralText = createTranslator({ locale: 'en', messages, namespace: 'plurals' })

/** How long the page gets to catch up before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 30_000

/** How long a press gets to go out before a test is willing to say none did. */
const LANDING_WINDOW_MS = 1_000

test.describe('a comment thread, read by a visitor', () => {
  test('shows each reply under the comment it answers, folds replies away and back, and keeps a deleted comment only while replies hang off it', async ({
    page,
  }) => {
    // A comment with a reply under it
    const answered = {
      ...commentFrom('user_zuzana', 'Zuzana', 'The third problem falls to induction.'),
      replies: [commentFrom('user_martin', 'Martin', 'A parity argument is shorter.')],
    }

    // A deleted comment a reply still hangs off
    const deletedWithReply = {
      ...commentFrom('user_peter', 'Peter', ''),
      isDeleted: true,
      replies: [commentFrom('user_zuzana', 'Zuzana', 'Which argument did you mean?')],
    }

    // And a deleted one with nothing under it
    const deletedAlone = { ...commentFrom('user_jana', 'Jana', ''), isDeleted: true }

    // The thread
    await stubPageThread(page, [answered, deletedWithReply, deletedAlone])

    // The page holding it
    await page.goto(threadPage())

    // The reply, shown
    await expect(page.getByText('A parity argument is shorter.')).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The reply hanging off the deleted comment, shown too
    await expect(page.getByText('Which argument did you mean?')).toBeVisible()

    // One deleted mark, kept for the comment a reply still hangs off, the one with nothing under it gone
    await expect(page.getByText(`[${commentsCopy.deleted}]`)).toHaveCount(1)

    // A reaction offered on each comment still standing, and none on the deleted one
    await expect(
      page.getByRole('button', { name: commentsCopy.thumbsUp, exact: true })
    ).toHaveCount(3)

    // The first comment's replies, hidden
    await page.getByRole('button', { name: commentsCopy.hideReplies }).first().click()

    // Gone from the thread
    await expect(page.getByText('A parity argument is shorter.')).toBeHidden()

    // Counted on the button that shows them again
    const showReplies = page.getByRole('button', {
      name: `${commentsCopy.show} ${pluralText('replies', { count: 1 })}`,
    })

    // Which shows them
    await showReplies.click()

    // Back in the thread
    await expect(page.getByText('A parity argument is shorter.')).toBeVisible()
  })

  test('names who gave each reaction, oldest first, counting the ones with no name', async ({
    page,
  }) => {
    // A comment three readers agree with, one of them nameless, and one disagrees with
    const comment = {
      ...commentFrom('user_zuzana', 'Zuzana', 'The third problem falls to induction.'),
      reactions: [
        { userId: 'user_martin', name: 'Martin', kind: 'thumbsUp' as const },
        { userId: 'user_peter', name: 'Peter', kind: 'thumbsDown' as const },
        { userId: 'user_nameless', name: null, kind: 'thumbsUp' as const },
        { userId: 'user_jana', name: 'Jana', kind: 'thumbsUp' as const },
      ],
    }

    // The thread
    await stubPageThread(page, [comment])

    // The page holding it
    await page.goto(threadPage())

    // The comment
    const shown = commentBy(page, 'Zuzana', comment.content)

    // Its count of thumbs up, pointed at
    await shown
      .getByRole('button', { name: `${commentsCopy.thumbsUp} 3`, exact: true })
      .hover({ timeout: SETTLE_TIMEOUT_MS })

    // Naming who gave it, the nameless one counted last
    await expect(page.getByRole('tooltip').getByRole('listitem')).toHaveText([
      'Martin',
      'Jana',
      pluralText('unnamedUsers', { count: 1 }),
    ])

    // Its count of thumbs down, pointed at
    await shown.getByRole('button', { name: `${commentsCopy.thumbsDown} 1`, exact: true }).hover()

    // Naming who gave that one
    await expect(page.getByRole('tooltip').getByRole('listitem')).toHaveText(['Peter'])
  })

  test('asks a visitor to sign in to react, and presses the reaction once they have', async ({
    page,
  }) => {
    // A comment somebody else agrees with
    const comment = {
      ...commentFrom('user_zuzana', 'Zuzana', 'The third problem falls to induction.'),
      reactions: [{ userId: 'user_martin', name: 'Martin', kind: 'thumbsUp' as const }],
    }

    // The thread, and what reaches the backend
    const writes = await stubPageThread(page, [comment])

    // The page holding it
    await page.goto(threadPage())

    // The comment's thumbs down
    const thumbsDown = commentBy(page, 'Zuzana', comment.content).getByRole('button', {
      name: commentsCopy.thumbsDown,
      exact: true,
    })

    // Pressed by a visitor
    await thumbsDown.click({ timeout: SETTLE_TIMEOUT_MS })

    // Who is asked to sign in first
    await expect(
      page.getByText(loginPromptFor(commentsCopy.authReasons.reactToComment))
    ).toBeVisible()

    // With nothing sent yet
    expect(writes()).toEqual([])

    // A username for the visitor once they sign in
    await stubNamedReader(page)

    // The visitor, signed in without leaving the page
    await signInTestUser(page)

    // The reaction they pressed, sent once they had
    await expect
      .poll(writes, { timeout: SETTLE_TIMEOUT_MS })
      .toEqual([{ kind: 'pressed', commentId: comment.id, reaction: 'thumbsDown' }])

    // And held by them now
    await expect(
      commentBy(page, 'Zuzana', comment.content).getByRole('button', {
        name: commentsCopy.thumbsDown,
        exact: true,
        pressed: true,
      })
    ).toBeVisible()
  })

  test('drops a reaction the visitor backed out of signing in for', async ({ page }) => {
    // A comment by somebody else
    const comment = commentFrom('user_zuzana', 'Zuzana', 'The third problem falls to induction.')

    // The thread, and what reaches the backend
    const writes = await stubPageThread(page, [comment])

    // The page holding it
    await page.goto(threadPage())

    // The comment's thumbs up, pressed by a visitor
    await commentBy(page, 'Zuzana', comment.content)
      .getByRole('button', { name: commentsCopy.thumbsUp, exact: true })
      .click({ timeout: SETTLE_TIMEOUT_MS })

    // The offer to sign in, closed
    await page.getByRole('button', { name: 'Close toast' }).click()

    // A username for the visitor once they sign in
    await stubNamedReader(page)

    // The visitor, signed in after all, without leaving the page
    await signInTestUser(page)

    // The thread, read as theirs now, with the box a comment is written in
    await expect(page.getByPlaceholder(commentsCopy.writePlaceholder)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Long enough for a press to have gone out, had one been made
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // Without the one they backed out of
    expect(writes()).toEqual([])
  })
})
