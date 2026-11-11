import type { NamedProposalTarget } from '@/components/features/defense/model/defense-types'

import { actionsCopy, apiErrorsCopy, chatCopy, photosText } from './support/competitions'
import { blankPng, pickFile } from './support/interaction'
import {
  HANDOFF_CODE,
  HANDOFF_PAGE_PATH,
  HANDOFF_TARGET,
  installPhotoHandoffBackend,
} from './support/photo-handoff-backend'
import { expectViewerShut, shownPhoto } from './support/photo-viewer'
import { expect, SETTLE_TIMEOUT_MS, test } from './support/test'

/** The problem the computer moves the code to. */
const SECOND_TARGET: NamedProposalTarget = {
  ...HANDOFF_TARGET,
  problemId: 'p-2',
  slug: 'p-2',
  number: 8,
  title: 'Ten coins',
}

// A phone's screen
test.use({ viewport: { width: 390, height: 844 } })

test.describe('the phone page of a photo handoff', () => {
  test('follows the computer to another problem, leaving the photos sent before under theirs', async ({
    page,
  }) => {
    // A code pointing at the first problem
    const backend = await installPhotoHandoffBackend(page, HANDOFF_CODE, HANDOFF_TARGET)

    // Opened from the QR
    await page.goto(HANDOFF_PAGE_PATH)

    // The page's top
    const heading = page.getByRole('heading', { level: 1 })

    // Naming the first problem
    await expect(heading).toContainText(HANDOFF_TARGET.title, { timeout: SETTLE_TIMEOUT_MS })

    // A page photographed
    await pickFile(page.getByRole('button', { name: chatCopy.photos.addPage }), {
      name: 'page-1.png',
      mimeType: 'image/png',
      buffer: await blankPng(page, 40, 60),
    })

    // Read, the answer naming the first problem
    await expect.poll(() => backend.readCount(), { timeout: SETTLE_TIMEOUT_MS }).toBe(1)

    // The section of the problem photos go to now
    const current = page.locator('section', { has: heading })

    // Nothing still being read
    await expect(current.getByRole('status')).toBeEmpty()

    // The page under the first problem
    await expect(current.getByRole('group')).toHaveCount(1)

    // Nothing earlier yet
    await expect(page.getByRole('heading', { name: chatCopy.photoHandoff.earlier })).toHaveCount(0)

    // The computer moves the code on
    backend.pointAt(SECOND_TARGET)

    // The top follows within a few checks
    await expect(heading).toContainText(SECOND_TARGET.title, { timeout: SETTLE_TIMEOUT_MS })

    // The section of the problems the code pointed at before
    const earlier = page.locator('section', {
      has: page.getByRole('heading', { name: chatCopy.photoHandoff.earlier }),
    })

    // Naming the first problem
    await expect(earlier).toContainText(HANDOFF_TARGET.title)

    // With the page read for it
    await expect(earlier.getByRole('group')).toHaveCount(1)

    // While the current problem has no photo yet
    await expect(current.getByRole('group')).toHaveCount(0)
  })

  test('shows a page large on a press, and puts it away again', async ({ page }) => {
    // A code pointing at the first problem
    const backend = await installPhotoHandoffBackend(page, HANDOFF_CODE, HANDOFF_TARGET)

    // Opened from the QR
    await page.goto(HANDOFF_PAGE_PATH)

    // Two pages photographed together
    await pickFile(page.getByRole('button', { name: chatCopy.photos.addPage }), [
      { name: 'page-1.png', mimeType: 'image/png', buffer: await blankPng(page, 40, 60) },
      { name: 'page-2.png', mimeType: 'image/png', buffer: await blankPng(page, 60, 40) },
    ])

    // Both read
    await expect.poll(() => backend.readCount(), { timeout: SETTLE_TIMEOUT_MS }).toBe(2)

    // The second pressed
    await page.getByRole('button', { name: photosText('enlarge', { number: 2 }) }).click()

    // Shown large
    await expect(shownPhoto(page)).toHaveAttribute('alt', photosText('photo', { number: 2 }))

    // Put away
    await page.keyboard.press('Escape')

    // The viewer gone
    await expectViewerShut(page)
  })

  test('puts a page shown large away when the computer moves the code on', async ({ page }) => {
    // A code pointing at the first problem
    const backend = await installPhotoHandoffBackend(page, HANDOFF_CODE, HANDOFF_TARGET)

    // Opened from the QR
    await page.goto(HANDOFF_PAGE_PATH)

    // A page photographed
    await pickFile(page.getByRole('button', { name: chatCopy.photos.addPage }), {
      name: 'page-1.png',
      mimeType: 'image/png',
      buffer: await blankPng(page, 40, 60),
    })

    // Read
    await expect.poll(() => backend.readCount(), { timeout: SETTLE_TIMEOUT_MS }).toBe(1)

    // The page pressed
    await page.getByRole('button', { name: photosText('enlarge', { number: 1 }) }).click()

    // Shown large
    await expect(shownPhoto(page)).toHaveAttribute('alt', photosText('photo', { number: 1 }))

    // The computer moves the code on
    backend.pointAt(SECOND_TARGET)

    // The top following
    await expect(page.getByRole('heading', { level: 1 })).toContainText(SECOND_TARGET.title, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The large view gone with the problem it showed a page of
    await expectViewerShut(page)
  })

  test('keeps following the computer after a check is turned away for asking too often', async ({
    page,
  }) => {
    // A code pointing at the first problem
    const backend = await installPhotoHandoffBackend(page, HANDOFF_CODE, HANDOFF_TARGET)

    // Opened from the QR
    await page.goto(HANDOFF_PAGE_PATH)

    // The page's top
    const heading = page.getByRole('heading', { level: 1 })

    // Naming the first problem
    await expect(heading).toContainText(HANDOFF_TARGET.title, { timeout: SETTLE_TIMEOUT_MS })

    // The next check turned away for asking too often, as a whole classroom on one network can make it
    backend.refuseNextCheck({ status: 429, errorCode: 'RateLimited' })

    // The computer moving on
    backend.pointAt(SECOND_TARGET)

    // The check after it still goes out, and the top follows
    await expect(heading).toContainText(SECOND_TARGET.title, { timeout: SETTLE_TIMEOUT_MS })
  })

  test('says why the first check failed, and checks again on another go', async ({ page }) => {
    // A code the page holds
    const backend = await installPhotoHandoffBackend(page, HANDOFF_CODE, HANDOFF_TARGET)

    // The tries one check makes, its first and each retry the app gives it
    const attemptsPerCheck = 4

    // Every one of them failed, with nothing heard back
    Array.from({ length: attemptsPerCheck }).forEach(() =>
      backend.refuseNextCheck({ status: 500, errorCode: undefined })
    )

    // Opened from the QR
    await page.goto(HANDOFF_PAGE_PATH)

    // Said so
    await expect(page.getByText(chatCopy.photoHandoff.checkError)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Another go taken
    await page.getByRole('button', { name: actionsCopy.retry }).click()

    // Checked again, which names the problem
    await expect(page.getByRole('heading', { level: 1 })).toContainText(HANDOFF_TARGET.title, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('tells a page left open past its code to make a new one on the computer', async ({
    page,
  }) => {
    // A code that works when the page opens
    const backend = await installPhotoHandoffBackend(page, HANDOFF_CODE, HANDOFF_TARGET)

    // Opened from the QR
    await page.goto(HANDOFF_PAGE_PATH)

    // Naming the problem
    await expect(page.getByRole('heading', { level: 1 })).toContainText(HANDOFF_TARGET.title, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Run out while the page stays open
    backend.expire()

    // The page says so within a few checks
    await expect(page.getByText(apiErrorsCopy.DefensePhotoHandoffNotFound)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The way to more photos gone
    await expect(page.getByRole('button', { name: chatCopy.photos.addPage })).toHaveCount(0)
  })

  test('tells a code that never worked to make a new one on the computer', async ({ page }) => {
    // A backend that never made the code the page opens with
    await installPhotoHandoffBackend(page, 'f'.repeat(HANDOFF_CODE.length), HANDOFF_TARGET)

    // Opened from the QR
    await page.goto(HANDOFF_PAGE_PATH)

    // Said on the first check
    await expect(page.getByText(apiErrorsCopy.DefensePhotoHandoffNotFound)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // With no other go
    await expect(page.getByRole('button', { name: actionsCopy.retry })).toHaveCount(0)

    // And no way to photos
    await expect(page.getByRole('button', { name: chatCopy.photos.addPage })).toHaveCount(0)
  })
})
