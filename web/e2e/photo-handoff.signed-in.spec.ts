import type { Page } from '@playwright/test'

import { fileLinkTo } from './support/backend-routes'
import {
  areaPath,
  chatCopy,
  openExistingDefense,
  photosText,
  transcriptOf,
} from './support/competitions'
import {
  COMPETITION_SLUG,
  installHostedBackend,
  namedProblemOf,
  nextTurnSent,
  pageTextOf,
  photoIdsOf,
} from './support/hosted-backend'
import { blankPng, pickFile, readQrCode } from './support/interaction'
import type { PhotoHandoffBackend, PhotoHandoffOptions } from './support/photo-handoff-backend'
import { HANDOFF_CODE, installPhotoHandoffBackend } from './support/photo-handoff-backend'
import { expect, SETTLE_TIMEOUT_MS, test } from './support/test'

/** How long the composer waits between two takes of the waiting pages, on the page's clock. */
const TAKE_INTERVAL = '00:03'

/** Copy for the composer's photos. */
const photosCopy = chatCopy.photos

/** The problem the chat opens on, the competition's first, as the API names it. */
const FIRST_PROBLEM = namedProblemOf(COMPETITION_SLUG, 1, 'Intermediate')

/** The name every photo's tile goes by, whichever number it carries. */
const PHOTO_TILE_NAME = new RegExp(`^${photosCopy.photo.replace('{number}', '\\d+')}$`)

/**
 * Opens the chat on a competition's first problem, as an admin on a computer, the phone's pages taken from then on.
 *
 * @param page - The page.
 * @param handoff - Where the student's handoff stands as the composer opens.
 *
 * @returns The fake handoff, to send pages from the phone through.
 */
async function openComposer(
  page: Page,
  handoff: PhotoHandoffOptions
): Promise<PhotoHandoffBackend> {
  // A student inside a competition
  await installHostedBackend(page, 'running')

  // Whose phone can send pages to the composer, the code pointing at that problem whenever it works
  const phone = await installPhotoHandoffBackend(page, HANDOFF_CODE, FIRST_PROBLEM, handoff)

  // A clock the spec moves, so a take comes when the spec says
  await page.clock.install()

  // The competition's area
  await page.goto(areaPath(COMPETITION_SLUG))

  // The conversation already seeded on its first problem
  await openExistingDefense(page)

  // The composer, ready for the student's turn
  await expect(page.locator('textarea')).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

  // The phone
  return phone
}

/**
 * The composer's photos above its editor, in page order.
 *
 * @param page - The page the chat is open on.
 *
 * @returns Each photo's preview.
 */
function stripPreviews(page: Page) {
  // Every tile's image, in the order the tiles stand
  return page.getByRole('group', { name: PHOTO_TILE_NAME }).locator('img')
}

/**
 * Photographs a page on the phone, once the phone's page is up, and waits until the backend has read it.
 *
 * @param phone - The phone's page.
 * @param backend - The backend the photo goes to.
 * @param count - How many pages the backend will have read with this one.
 */
async function photographPage(
  phone: Page,
  backend: PhotoHandoffBackend,
  count: number
): Promise<void> {
  // The page, as the phone's camera hands it over
  await pickFile(phone.getByRole('button', { name: photosCopy.addPage }), {
    name: `page-${count}.png`,
    mimeType: 'image/png',
    buffer: await blankPng(phone, 40, 60),
  })

  // Read
  await expect.poll(backend.readCount, { timeout: SETTLE_TIMEOUT_MS }).toBe(count)
}

test.describe('pages sent from the phone', () => {
  test('reach the message the student sends, from the QR the computer shows to the phone that scans it', async ({
    page,
    phone,
  }) => {
    // A student with the chat open on the computer and no code yet
    const backend = await openComposer(page, { isLive: false, waiting: [] })

    // Holding a phone the same backend answers
    await backend.answerOn(phone)

    // The photo button's menu
    await page.getByTitle(photosCopy.addTitle).click()

    // The phone asked for
    await page.getByRole('menuitem', { name: photosCopy.fromPhone }).click()

    // The QR the dialog shows, once the code has come
    const qr = page
      .getByRole('dialog', { name: photosCopy.phoneTitle })
      .getByRole('img', { name: photosCopy.phoneQr })

    // Up
    await expect(qr).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Scanned, the phone opening what it says
    await phone.goto(await readQrCode(qr))

    // A page photographed there
    await photographPage(phone, backend, 1)

    // And taken by the computer on its next go
    await page.clock.fastForward(TAKE_INTERVAL)

    // The review, open on that page in the QR's place
    const review = page.getByRole('dialog', { name: photosCopy.reviewTitle })

    // Showing what the page read as
    await expect(review.locator('textarea')).toHaveValue(pageTextOf(1), {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Another photographed while the student reads it
    await photographPage(phone, backend, 2)

    // Taken too
    await page.clock.fastForward(TAKE_INTERVAL)

    // Joining the review beside the first
    await expect(review.getByRole('group', { name: PHOTO_TILE_NAME })).toHaveCount(2, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Both put into the message
    await review.getByRole('button', { name: photosText('insert', { count: 2 }) }).click()

    // Back in the composer
    await expect(review).toHaveCount(0)

    // The composer
    const composer = page.locator('textarea')

    // Saying what both pages say, in the order they were photographed
    await expect(composer).toHaveValue(`${pageTextOf(1)}\n\n${pageTextOf(2)}`)

    // The turn, as it goes out
    const sent = nextTurnSent(page)

    // Sent
    await composer.press('Meta+Enter')

    // Carrying the photos the backend kept from the phone, in the order photographed
    expect(photoIdsOf(await sent)).toEqual(['photo-1', 'photo-2'])

    // The turn's second page, under what it says
    const secondPage = transcriptOf(page)
      .getByRole('button', { name: photosText('enlarge', { number: 2 }) })
      .locator('img')

    // Shown from where the backend keeps it
    await expect(secondPage).toHaveAttribute('src', fileLinkTo('photo-2'), {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('open the review on the first one while the code shows, and join it after that', async ({
    page,
  }) => {
    // A student with the chat open and no code yet
    const phone = await openComposer(page, { isLive: false, waiting: [] })

    // The photo button's menu
    await page.getByTitle(photosCopy.addTitle).click()

    // The phone asked for
    await page.getByRole('menuitem', { name: photosCopy.fromPhone }).click()

    // The dialog it opens
    const phoneDialog = page.getByRole('dialog', { name: photosCopy.phoneTitle })

    // Showing the code, once it has come
    await expect(phoneDialog.getByRole('img', { name: photosCopy.phoneQr })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The phone sends a page
    phone.sendFromPhone({
      photoId: 'first-page',
      text: 'First page of the proof.',
      capturedAt: '2026-11-10T09:00:00Z',
    })

    // And the composer takes it
    await page.clock.fastForward(TAKE_INTERVAL)

    // The review opens on that page in the code's place
    const review = page.getByRole('dialog', { name: photosCopy.reviewTitle })
    await expect(review.locator('textarea')).toHaveValue('First page of the proof.', {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And the code is gone
    await expect(phoneDialog).toHaveCount(0)

    // The phone sends another while the student reads the first
    phone.sendFromPhone({
      photoId: 'second-page',
      text: 'Second page of the proof.',
      capturedAt: '2026-11-10T09:01:00Z',
    })

    // And the composer takes that one too
    await page.clock.fastForward(TAKE_INTERVAL)

    // It joins the review as a tile of its own
    await expect(review.getByRole('group', { name: PHOTO_TILE_NAME })).toHaveCount(2, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // While the review stays on the page the student was reading
    await expect(review.locator('textarea')).toHaveValue('First page of the proof.')
  })

  test('keep arriving with every dialog shut, in the order they were taken', async ({ page }) => {
    // A student whose code still works from an earlier visit, the phone having sent the later page first while no
    // composer was open
    const phone = await openComposer(page, {
      isLive: true,
      waiting: [
        {
          photoId: 'later-page',
          text: 'The end of the proof.',
          capturedAt: '2026-11-10T09:05:00Z',
        },
      ],
    })

    // The composer takes it as it opens, joining it to the photos above the editor
    await expect(stripPreviews(page)).toHaveCount(1, { timeout: SETTLE_TIMEOUT_MS })

    // Then the page taken before it, whose reading took longer
    phone.sendFromPhone({
      photoId: 'earlier-page',
      text: 'The start of the proof.',
      capturedAt: '2026-11-10T09:04:00Z',
    })

    // Taken on the next go
    await page.clock.fastForward(TAKE_INTERVAL)

    // Both stand in the order they were photographed
    await expect(stripPreviews(page)).toHaveCount(2, { timeout: SETTLE_TIMEOUT_MS })
    await expect(stripPreviews(page).nth(0)).toHaveAttribute('src', /earlier-page/)
    await expect(stripPreviews(page).nth(1)).toHaveAttribute('src', /later-page/)

    // And no dialog came up for either
    await expect(page.getByRole('dialog', { name: photosCopy.reviewTitle })).toHaveCount(0)
  })

  test('are not asked for again while the student holds no working code', async ({ page }) => {
    // A student who never made a code
    const phone = await openComposer(page, { isLive: false, waiting: [] })

    // The one take the composer makes as it opens
    await expect.poll(phone.takes, { timeout: SETTLE_TIMEOUT_MS }).toBe(1)

    // Three of the composer's waits go by, and long enough after them for a take to have reached the fake
    await page.clock.fastForward(TAKE_INTERVAL)
    await page.clock.fastForward(TAKE_INTERVAL)
    await page.clock.fastForward(TAKE_INTERVAL)
    await page.waitForTimeout(1_000)

    // Not one more take
    expect(phone.takes()).toBe(1)
  })
})
