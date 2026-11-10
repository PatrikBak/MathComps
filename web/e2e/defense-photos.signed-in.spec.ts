import type { Locator, Page, Request } from '@playwright/test'

import { TURN_ID_ATTRIBUTE } from '@/components/features/defense/hooks/use-reveal-pointed-turn'

import { answerJson, BACKEND_ORIGIN, fileLinkTo, ONE_PIXEL_PNG } from './support/backend-routes'
import {
  actionsCopy,
  areaCopy,
  chatCopy,
  closeChat,
  LIST_PATH,
  openExistingDefense,
  photosText,
  transcriptOf,
} from './support/competitions'
import type { SentTurnBody } from './support/hosted-backend'
import { installHostedBackend, pageTextOf } from './support/hosted-backend'
import { pickFile } from './support/interaction'
import { expectViewerShut, shownPhoto } from './support/photo-viewer'
import { expect, SETTLE_TIMEOUT_MS, test } from './support/test'

/**
 * Opens a conversation about the first problem of the practice run, where nothing has been argued yet, and where a
 * turn can be taken back since the run grades nobody.
 *
 * @param page - The page to open it on.
 *
 * @returns The composer the conversation is written in, once it takes text.
 */
async function openPracticeConversation(page: Page): Promise<Locator> {
  // A student with an entry still to spend
  await installHostedBackend(page, 'ready')

  // The list, where the practice run is taken
  await page.goto(LIST_PATH)

  // Tried
  await page.getByRole('button', { name: areaCopy.try }).first().click()

  // And confirmed in its dialog
  await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

  // A conversation held about the first problem
  await page.getByRole('button', { name: areaCopy.startDefense }).first().click()

  // The composer
  const composer = page.locator('textarea')

  // Live once it takes text
  await expect(composer).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

  // Handed back for the turn to be written in
  return composer
}

/**
 * Picks pages of handwritten work for the message through the composer's photo button, the way a student picks
 * them off their phone, which opens the review on the first of them.
 *
 * @param page - The page the chat is open on.
 * @param count - How many pages.
 */
async function pickPages(page: Page, count: number): Promise<void> {
  // Each page an image of its own
  const pages = Array.from({ length: count }, (_unused, index) => ({
    name: `page-${index + 1}.png`,
    mimeType: 'image/png',
    buffer: ONE_PIXEL_PNG,
  }))

  // Picked through the composer's photo button
  await pickFile(page.getByRole('button', { name: chatCopy.photos.add, exact: true }), pages)

  // The review, once it is up
  await expect(
    page
      .getByRole('dialog', { name: chatCopy.photos.reviewTitle })
      .getByText(chatCopy.photos.reviewHint)
  ).toBeVisible()
}

/**
 * Puts the text read off every picked page into the message, once each page is read, and goes back to the
 * composer.
 *
 * @param page - The page the review is open on.
 * @param count - How many pages are waiting to go in.
 */
async function insertPages(page: Page, count: number): Promise<void> {
  // The review the pages are checked in
  const review = page.getByRole('dialog', { name: chatCopy.photos.reviewTitle })

  // The insert button, pressed once every page is read
  await review
    .getByRole('button', { name: photosText('insert', { count }) })
    .click({ timeout: SETTLE_TIMEOUT_MS })

  // Back in the composer
  await expect(review).toHaveCount(0)
}

/**
 * Waits for the next turn the chat sends the backend, opening a conversation or continuing one.
 *
 * @param page - The page the chat is open on.
 *
 * @returns The request carrying the turn.
 */
function nextTurnSent(page: Page): Promise<Request> {
  // The opening of a conversation, or a further turn in one
  return page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      (request.url() === `${BACKEND_ORIGIN}/defense/sessions` || request.url().endsWith('/turns'))
  )
}

/**
 * The photos a turn went out with, as the request carrying it names them.
 *
 * @param request - The request.
 *
 * @returns The photos' ids, in the order sent.
 */
function photoIdsOf(request: Request): string[] {
  // Read off the request's body
  return (request.postDataJSON() as SentTurnBody).photoIds
}

test.describe('a message written from photos', () => {
  test('goes out with its pages, and shows them under what it says', async ({ page }) => {
    // A conversation, and the composer to write it in
    const composer = await openPracticeConversation(page)

    // Two pages picked
    await pickPages(page, 2)

    // Read and put into the message
    await insertPages(page, 2)

    // Which says what both pages say, in their order
    await expect(composer).toHaveValue(`${pageTextOf(1)}\n\n${pageTextOf(2)}`)

    // The turn, as it goes out
    const sent = nextTurnSent(page)

    // Sent
    await composer.press('Meta+Enter')

    // Carrying both kept photos, in page order
    expect(photoIdsOf(await sent)).toEqual(['photo-1', 'photo-2'])

    // The transcript the turn lands in
    const transcript = transcriptOf(page)

    // The turn's second page
    const secondPage = transcript.getByRole('button', {
      name: photosText('enlarge', { number: 2 }),
    })

    // Shown once answered, from where the backend keeps it
    await expect(secondPage.locator('img')).toHaveAttribute('src', fileLinkTo('photo-2'), {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // No label for drawings cut out of the pages, which the student sent as part of them
    await expect(transcript.getByText(chatCopy.photos.drawingsCutOut)).toHaveCount(0)

    // Nor any drawing's tile
    await expect(
      transcript.getByRole('button', { name: photosText('enlargeDrawing', { number: 1 }) })
    ).toHaveCount(0)

    // And no page left waiting in the composer
    await expect(page.getByRole('button', { name: photosText('open', { number: 1 }) })).toHaveCount(
      0
    )

    // The second page, pressed
    await secondPage.click()

    // Shown large
    await expect(shownPhoto(page)).toHaveAttribute('alt', photosText('photo', { number: 2 }))

    // Put away again
    await page.keyboard.press('Escape')

    // The viewer gone
    await expectViewerShut(page)

    // Leaving the chat open
    await expect(transcript).toBeVisible()

    // The focus back on the page it was shown from
    await expect(secondPage).toBeFocused()

    // The chat left
    await closeChat(page)

    // The conversation opened again, read back from the backend
    await openExistingDefense(page)

    // With its pages still under the turn
    await expect(
      transcript.getByRole('button', { name: photosText('enlarge', { number: 2 }) })
    ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })
  })

  test('comes back into the composer with its pages when it fails to go out', async ({ page }) => {
    // A conversation, and the composer to write it in
    const composer = await openPracticeConversation(page)

    // A page picked
    await pickPages(page, 1)

    // Read and put into the message
    await insertPages(page, 1)

    // The backend failing the turn opening the conversation, with nothing to say why
    await page.route(`${BACKEND_ORIGIN}/defense/sessions`, (route) => answerJson(route, 500, {}), {
      times: 1,
    })

    // Sent
    await composer.press('Meta+Enter')

    // Failed, which the student is told
    await expect(page.getByText(chatCopy.sendError)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // The message back to send again
    await expect(composer).toHaveValue(pageTextOf(1))

    // With its page waiting beside it
    await expect(
      page.getByRole('button', { name: photosText('open', { number: 1 }) })
    ).toBeVisible()

    // The turn, as it goes out again
    const resent = nextTurnSent(page)

    // Sent again
    await composer.press('Meta+Enter')

    // With the same kept photo
    expect(photoIdsOf(await resent)).toEqual(['photo-1'])
  })

  test('comes back into the composer with its pages when taken back', async ({ page }) => {
    // A conversation, and the composer to write it in
    const composer = await openPracticeConversation(page)

    // A page picked
    await pickPages(page, 1)

    // Read and put into the message
    await insertPages(page, 1)

    // Sent
    await composer.press('Meta+Enter')

    // The student's turn, once the backend holds it
    const turn = transcriptOf(page)
      .locator(TURN_ID_ATTRIBUTE.anySelector)
      .filter({ hasText: pageTextOf(1) })

    // Answered, its page stored with it
    await expect(
      turn.getByRole('button', { name: photosText('enlarge', { number: 1 }) }).locator('img')
    ).toHaveAttribute('src', fileLinkTo('photo-1'), { timeout: SETTLE_TIMEOUT_MS })

    // Taken back
    await turn.getByRole('button', { name: chatCopy.rewind }).click()

    // And confirmed in its dialog
    await page.getByRole('button', { name: actionsCopy.confirm }).click()

    // Gone from the conversation
    await expect(turn).toHaveCount(0, { timeout: SETTLE_TIMEOUT_MS })

    // Back in the composer, what it said
    await expect(composer).toHaveValue(pageTextOf(1))

    // And the page it was written from, shown from where it is kept
    await expect(
      page.getByRole('button', { name: photosText('open', { number: 1 }) }).locator('img')
    ).toHaveAttribute('src', fileLinkTo('photo-1'))

    // The turn, as it goes out again
    const resent = nextTurnSent(page)

    // Sent again
    await composer.press('Meta+Enter')

    // With the same kept photo
    expect(photoIdsOf(await resent)).toEqual(['photo-1'])
  })
})

test.describe('the review of the picked pages', () => {
  test('shows the page looked at large, and looks at the one swiped to', async ({ page }) => {
    // A conversation to write
    await openPracticeConversation(page)

    // Two pages picked, the review opening on the first
    await pickPages(page, 2)

    // The review
    const review = page.getByRole('dialog', { name: chatCopy.photos.reviewTitle })

    // A function which finds a page's tile while it is the one looked at, which a press shows large
    const lookedAt = (number: number) =>
      review.getByRole('button', { name: photosText('enlarge', { number }) }).first()

    // Looking at the first page
    await expect(lookedAt(1)).toHaveAttribute('aria-current', 'true')

    // The second page opened
    await review.getByRole('button', { name: photosText('open', { number: 2 }) }).click()

    // Looked at now
    await expect(lookedAt(2)).toHaveAttribute('aria-current', 'true')

    // Pressed there
    await lookedAt(2).click()

    // Shown large
    await expect(shownPhoto(page)).toHaveAttribute('alt', photosText('photo', { number: 2 }))

    // Swiped back to the first
    await page.keyboard.press('ArrowLeft')

    // Shown large in its place
    await expect(shownPhoto(page)).toHaveAttribute('alt', photosText('photo', { number: 1 }))

    // Put away
    await page.keyboard.press('Escape')

    // The viewer gone
    await expectViewerShut(page)

    // Leaving the review open, now on the page swiped to
    await expect(lookedAt(1)).toHaveAttribute('aria-current', 'true')
  })
})
