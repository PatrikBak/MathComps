import type { Locator, Page } from '@playwright/test'

import { TURN_ID_ATTRIBUTE } from '@/components/features/defense/hooks/use-reveal-pointed-turn'

import { answerJson, BACKEND_ORIGIN, fileLinkTo, ONE_PIXEL_PNG } from './support/backend-routes'
import {
  actionsCopy,
  areaCopy,
  chatCopy,
  closeChat,
  LIST_PATH,
  modalCopy,
  openExistingDefense,
  photosText,
  transcriptOf,
} from './support/competitions'
import {
  answerPhotoLinks,
  installHostedBackend,
  namedProblemOf,
  nextTurnSent,
  pageTextOf,
  photoIdsOf,
} from './support/hosted-backend'
import { isKeptInStorage, pickFile } from './support/interaction'
import { HANDOFF_CODE, installPhotoHandoffBackend } from './support/photo-handoff-backend'
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
 * Finds a page's tile in the review while it is the one looked at, which a press shows large.
 *
 * @param review - The review.
 * @param number - The page's place among the pages, from 1.
 *
 * @returns The page's tile.
 */
function lookedAtTile(review: Locator, number: number): Locator {
  // The strip's tile, ahead of the page shown beside its text, which carries the same name
  return review.getByRole('button', { name: photosText('enlarge', { number }) }).first()
}

/**
 * Picks pages of handwritten work for the message through the composer's photo button and its "From this computer"
 * row, which opens the review on the first of them.
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

  // The composer's photo button, which opens its menu on a computer
  await page.getByRole('button', { name: chatCopy.photos.add, exact: true }).click()

  // Picked from the computer
  await pickFile(page.getByRole('menuitem', { name: chatCopy.photos.fromComputer }), pages)

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

  test('keeps its pages through a reload, read ones with their text, and goes out with them', async ({
    page,
  }) => {
    // A conversation, and the composer to write it in
    const composer = await openPracticeConversation(page)

    // A page picked
    await pickPages(page, 1)

    // Read and put into the message
    await insertPages(page, 1)

    // Which now says what the page says
    await expect(composer).toHaveValue(pageTextOf(1))

    // A second page picked, the review opening on it
    await pickPages(page, 1)

    // The review
    const review = page.getByRole('dialog', { name: chatCopy.photos.reviewTitle })

    // The second page's text in it
    const pageText = review.locator('textarea')

    // Filled in once the page is read
    await expect(pageText).toHaveValue(pageTextOf(2), { timeout: SETTLE_TIMEOUT_MS })

    // The text the student corrects it to
    const corrected = 'Page 2: the residues repeat every six steps'

    // Corrected by the student
    await pageText.fill(corrected)

    // Kept as corrected
    await expect
      .poll(() => isKeptInStorage(page, corrected), { timeout: SETTLE_TIMEOUT_MS })
      .toBe(true)

    // The review shut with the page's text still beside it
    await review.getByRole('button', { name: modalCopy.close }).click()

    // Back in the composer
    await expect(review).toHaveCount(0)

    // Links the backend hands out from now on, unlike those the pages were kept with
    await answerPhotoLinks(page, (photoId) => fileLinkTo(`${photoId}-renewed`))

    // A stray reload, which takes the pages' copies on the student's device with it
    await page.reload()

    // Back into a conversation about the same problem
    await page.getByRole('button', { name: areaCopy.startDefense }).first().click()

    // Where the message is still waiting
    await expect(composer).toHaveValue(pageTextOf(1), { timeout: SETTLE_TIMEOUT_MS })

    // With its page beside it, shown from its stored page through a fresh link
    await expect(
      page.getByRole('button', { name: photosText('open', { number: 1 }) }).locator('img')
    ).toHaveAttribute('src', fileLinkTo('photo-1-renewed'))

    // The read page's tile, after the first
    const readPage = page.getByRole('button', { name: photosText('open', { number: 2 }) })

    // Previewing from its stored page through a fresh link too
    await expect(readPage.locator('img')).toHaveAttribute('src', fileLinkTo('photo-2-renewed'))

    // Opened
    await readPage.click()

    // Its text still as the student left it
    await expect(pageText).toHaveValue(corrected)

    // Put into the message
    await insertPages(page, 1)

    // Which now says both, in page order
    await expect(composer).toHaveValue(`${pageTextOf(1)}\n\n${corrected}`)

    // The turn, as it goes out
    const sent = nextTurnSent(page)

    // Sent
    await composer.press('Meta+Enter')

    // Carrying both kept photos, in page order
    expect(photoIdsOf(await sent)).toEqual(['photo-1', 'photo-2'])
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

    // Looking at the first page
    await expect(lookedAtTile(review, 1)).toHaveAttribute('aria-current', 'true')

    // The second page opened
    await review.getByRole('button', { name: photosText('open', { number: 2 }) }).click()

    // Looked at now
    await expect(lookedAtTile(review, 2)).toHaveAttribute('aria-current', 'true')

    // Pressed there
    await lookedAtTile(review, 2).click()

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
    await expect(lookedAtTile(review, 1)).toHaveAttribute('aria-current', 'true')
  })

  test("goes into the message with a page's text as the student left it", async ({ page }) => {
    // A conversation, and the composer to write it in
    const composer = await openPracticeConversation(page)

    // A page picked, the review opening on it
    await pickPages(page, 1)

    // The page's text in the review
    const pageText = page
      .getByRole('dialog', { name: chatCopy.photos.reviewTitle })
      .locator('textarea')

    // Filled in once the page is read
    await expect(pageText).toHaveValue(pageTextOf(1), { timeout: SETTLE_TIMEOUT_MS })

    // Corrected by the student
    await pageText.fill('Page 1: the residues repeat every six steps')

    // Put into the message
    await insertPages(page, 1)

    // Which says what the student left
    await expect(composer).toHaveValue('Page 1: the residues repeat every six steps')
  })

  test('drops a page from its corner, looking at the one left', async ({ page }) => {
    // A conversation to write
    await openPracticeConversation(page)

    // Two pages picked, the review opening on the first
    await pickPages(page, 2)

    // The review
    const review = page.getByRole('dialog', { name: chatCopy.photos.reviewTitle })

    // The first page dropped from its tile's corner
    await review
      .getByRole('group', { name: photosText('photo', { number: 1 }), exact: true })
      .getByRole('button', { name: chatCopy.photos.remove })
      .click()

    // No second page left
    await expect(
      review.getByRole('group', { name: photosText('photo', { number: 2 }), exact: true })
    ).toHaveCount(0)

    // The one left, now the first, looked at
    await expect(lookedAtTile(review, 1)).toHaveAttribute('aria-current', 'true')
  })
})

test.describe('the photo button on a phone', () => {
  // A touchscreen, where the main pointer is a finger
  test.use({ hasTouch: true })

  test('opens the picker straight away', async ({ page }) => {
    // A conversation, and the composer to write it in
    await openPracticeConversation(page)

    // A page picked through the photo button itself
    await pickFile(page.getByRole('button', { name: chatCopy.photos.add, exact: true }), {
      name: 'page-1.png',
      mimeType: 'image/png',
      buffer: ONE_PIXEL_PNG,
    })

    // The review, once it is up
    await expect(
      page
        .getByRole('dialog', { name: chatCopy.photos.reviewTitle })
        .getByText(chatCopy.photos.reviewHint)
    ).toBeVisible()
  })
})

test.describe('photos from a phone', () => {
  test('show a QR for a code pointed at the problem, and say in place when none could be made', async ({
    page,
  }) => {
    // A conversation, and the composer to write it in
    await openPracticeConversation(page)

    // The problem the conversation is about
    const problem = namedProblemOf('practice-set', 1, 'Practice competition')

    // A student with no code yet, the phone's backend pointing one at that problem
    const phone = await installPhotoHandoffBackend(page, HANDOFF_CODE, problem, {
      isLive: false,
      waiting: [],
    })

    // The first ask for a code refused, the next answered
    phone.refuseNextPoint({ status: 500, errorCode: undefined })

    // The composer's photo button, which opens its menu on a computer
    await page.getByRole('button', { name: chatCopy.photos.add, exact: true }).click()

    // The phone asked for
    await page.getByRole('menuitem', { name: chatCopy.photos.fromPhone }).click()

    // The dialog it opens
    const dialog = page.getByRole('dialog', { name: chatCopy.photos.phoneTitle })

    // Saying in place that no code came
    await expect(dialog.getByRole('alert')).toHaveText(chatCopy.photos.phoneError)

    // Asked again
    await dialog.getByRole('button', { name: actionsCopy.retry }).click()

    // The QR
    await expect(dialog.getByRole('img', { name: chatCopy.photos.phoneQr })).toBeVisible()

    // And how to use it
    await expect(dialog.getByText(chatCopy.photos.phoneScan)).toBeVisible()

    // The problem the conversation is about, as the API names it
    const target = { kind: 'problem', problemId: problem.problemId }

    // Both asks pointing the code at it
    expect(phone.pointedTargets()).toEqual([target, target])
  })
})
