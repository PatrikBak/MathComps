import { actionsCopy, apiErrorsCopy, chatCopy, photosText } from './support/competitions'
import { blankPng, pickFile } from './support/interaction'
import {
  HANDOFF_CODE,
  HANDOFF_PAGE_PATH,
  HANDOFF_TARGET,
  installPhotoHandoffBackend,
} from './support/photo-handoff-backend'
import { expect, SETTLE_TIMEOUT_MS, test } from './support/test'

/** What the first photo's tile is called. */
const FIRST_PHOTO = photosText('photo', { number: 1 })

/** What the second photo is called. */
const SECOND_PHOTO = photosText('photo', { number: 2 })

// What a photo whose reading failed says, and the way on it offers, hosted on the phone's page of a photo
// handoff, which needs no account
test.describe('a photo whose reading failed', () => {
  test('says why, and reads the photo again on another go', async ({ page }) => {
    // A code the page holds
    const backend = await installPhotoHandoffBackend(page, HANDOFF_CODE, HANDOFF_TARGET)

    // The first photo it sends failed, naming no reason
    backend.refuseNextSend({ status: 500, errorCode: undefined })

    // Opened from the QR
    await page.goto(HANDOFF_PAGE_PATH)

    // A page photographed
    await pickFile(page.getByRole('button', { name: chatCopy.photos.addPage }), {
      name: 'page-1.png',
      mimeType: 'image/png',
      buffer: await blankPng(page, 40, 60),
    })

    // The generic reason
    await expect(page.getByText(chatCopy.photos.readError)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Another go taken
    await page.getByRole('button', { name: actionsCopy.retry }).click()

    // Read this time
    await expect.poll(() => backend.readCount(), { timeout: SETTLE_TIMEOUT_MS }).toBe(1)

    // The section of the problem photos go to now
    const currentProblem = page.locator('section', { has: page.getByRole('heading', { level: 1 }) })

    // Nothing still being read
    await expect(currentProblem.getByRole('status')).toBeEmpty()

    // No note left on the photo
    await expect(page.getByText(chatCopy.photos.readError)).toHaveCount(0)

    // The photo still there
    await expect(page.getByRole('group', { name: FIRST_PHOTO })).toBeVisible()
  })

  test('offers a photo that can never be read only its removal', async ({ page }) => {
    // A code the page holds
    const backend = await installPhotoHandoffBackend(page, HANDOFF_CODE, HANDOFF_TARGET)

    // The first photo it sends refused as no image the API reads
    backend.refuseNextSend({ status: 400, errorCode: 'UnreadablePhoto' })

    // Opened from the QR
    await page.goto(HANDOFF_PAGE_PATH)

    // A page photographed
    await pickFile(page.getByRole('button', { name: chatCopy.photos.addPage }), {
      name: 'page-1.png',
      mimeType: 'image/png',
      buffer: await blankPng(page, 40, 60),
    })

    // Said why
    await expect(page.getByText(apiErrorsCopy.UnreadablePhoto)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // With no other go on offer
    await expect(page.getByRole('button', { name: actionsCopy.retry })).toHaveCount(0)

    // Removed
    await page.getByRole('button', { name: chatCopy.photos.remove }).click()

    // The photo gone
    await expect(page.getByRole('group', { name: FIRST_PHOTO })).toHaveCount(0)
  })

  test('names the photo it failed on by its place among the photos', async ({ page }) => {
    // A code the page holds
    const backend = await installPhotoHandoffBackend(page, HANDOFF_CODE, HANDOFF_TARGET)

    // Opened from the QR
    await page.goto(HANDOFF_PAGE_PATH)

    // The button pages are photographed with
    const addPage = page.getByRole('button', { name: chatCopy.photos.addPage })

    // A first page photographed
    await pickFile(addPage, {
      name: 'page-1.png',
      mimeType: 'image/png',
      buffer: await blankPng(page, 40, 60),
    })

    // Read
    await expect.poll(() => backend.readCount(), { timeout: SETTLE_TIMEOUT_MS }).toBe(1)

    // The next photo failed, naming no reason
    backend.refuseNextSend({ status: 500, errorCode: undefined })

    // A second page photographed
    await pickFile(addPage, {
      name: 'page-2.png',
      mimeType: 'image/png',
      buffer: await blankPng(page, 40, 60),
    })

    // The note on the photo that failed
    const note = page.getByRole('alert').filter({ hasText: chatCopy.photos.readError })

    // Naming it as the second of the photos
    await expect(note).toContainText(SECOND_PHOTO, { timeout: SETTLE_TIMEOUT_MS })
  })
})
