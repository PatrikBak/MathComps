import type { Locator, Page } from '@playwright/test'

import { HARNESS_COPY, HARNESS_PHOTOS } from '@/app/[locale]/dev/photo-viewer/photo-viewer-harness'
import { SECOND_MS } from '@/components/shared/utils/time-units'

import messages from '../messages/en.json'
import { holdClock } from './support/emulation'
import { dragPhotoDown, expectViewerShut, shownPhoto, tapBesidePhoto } from './support/photo-viewer'
import { expect, test } from './support/test'

/** The viewer's own copy, its buttons' names among it. */
const viewerCopy = messages.ui.photoViewer

/** A step on from the first photo and one back to it, each with the photo it lands on, from 1. */
const ON_AND_BACK = [
  ['ArrowRight', 2],
  ['ArrowLeft', 1],
] as const

/**
 * How many times the viewer steps on and back under a redraw, since a redraw landing just after a step sends it back
 * to the photo before only about every other time.
 */
const REDRAW_ROUNDS = 4

/** The dev page showing the viewer with nothing around it, in English. */
const HARNESS_PATH = '/en/dev/photo-viewer'

/**
 * What a photo is called once it is shown large.
 *
 * @param number - Where the photo stands among the photos, from 1.
 *
 * @returns The photo's alternative text.
 */
function altOf(number: number): string {
  // The photo at that place
  const photo = HARNESS_PHOTOS[number - 1]

  // A place past the last photo names none
  if (photo === undefined) throw new Error(`The harness holds no photo ${number}`)

  // What it is called
  return photo.alt
}

/**
 * A photo's tile, which opens the viewer on that photo.
 *
 * @param scope - Where the tile sits: the page's own photos, or the dialog's.
 * @param number - Where the photo stands among the photos, from 1.
 *
 * @returns The tile.
 */
function tileOf(scope: Locator, number: number): Locator {
  // The tile named after its photo
  return scope.getByRole('button', { name: HARNESS_COPY.openPhoto(number) })
}

/**
 * The photos opened straight from the page, with no dialog around them.
 *
 * @param page - The page the harness is open on.
 *
 * @returns The section holding them.
 */
function pagePhotos(page: Page): Locator {
  // The section named by its heading
  return page.getByRole('region', { name: HARNESS_COPY.pageSection })
}

/**
 * The dialog holding photos of its own.
 *
 * @param page - The page the harness is open on.
 *
 * @returns The dialog.
 */
function photosDialog(page: Page): Locator {
  // The dialog named by its title
  return page.getByRole('dialog', { name: HARNESS_COPY.dialogTitle })
}

/**
 * Checks the dialog holding photos of its own is open, by its title on screen, since the dialog's own element takes up
 * no room of its own.
 *
 * @param page - The page the harness is open on.
 */
async function expectDialogOpen(page: Page): Promise<void> {
  // The title, shown in the dialog
  await expect(
    photosDialog(page).getByRole('heading', { name: HARNESS_COPY.dialogTitle })
  ).toBeVisible()
}

test.describe('photo viewer', () => {
  test.beforeEach(async ({ page }) => {
    // The harness
    await page.goto(HARNESS_PATH)
  })

  test('moves between the photos with the arrow keys, and stops at the first and the last', async ({
    page,
  }) => {
    // The first photo pressed
    await tileOf(pagePhotos(page), 1).click()

    // Shown large
    await expect(shownPhoto(page)).toHaveAttribute('alt', altOf(1))

    // A step back from the first
    await page.keyboard.press('ArrowLeft')

    // A step on
    await page.keyboard.press('ArrowRight')

    // On the second, where a step back that went round to the last would have come forward onto the first
    await expect(shownPhoto(page)).toHaveAttribute('alt', altOf(2))

    // On again
    await page.keyboard.press('ArrowRight')

    // To the last
    await expect(shownPhoto(page)).toHaveAttribute('alt', altOf(3))

    // A step on from the last
    await page.keyboard.press('ArrowRight')

    // A step back
    await page.keyboard.press('ArrowLeft')

    // On the second, where a step on that went round to the first would have gone back onto the last
    await expect(shownPhoto(page)).toHaveAttribute('alt', altOf(2))
  })

  test('tells the page which photo it moved to', async ({ page }) => {
    // The first photo pressed
    await tileOf(pagePhotos(page), 1).click()

    // Shown large
    await expect(shownPhoto(page)).toHaveAttribute('alt', altOf(1))

    // A step on
    await page.keyboard.press('ArrowRight')

    // Shown large in its place
    await expect(shownPhoto(page)).toHaveAttribute('alt', altOf(2))

    // Marked on the page as the photo looked at, which the page learns only from the viewer
    await expect(tileOf(pagePhotos(page), 2)).toHaveAttribute('aria-current', 'true')
  })

  test('shuts on Escape, handing the focus back to the photo pressed', async ({ page }) => {
    // The second photo's tile
    const tile = tileOf(pagePhotos(page), 2)

    // Pressed
    await tile.click()

    // Shown large
    await expect(shownPhoto(page)).toHaveAttribute('alt', altOf(2))

    // Put away
    await page.keyboard.press('Escape')

    // The viewer gone
    await expectViewerShut(page)

    // The focus back on the tile it was opened from
    await expect(tile).toBeFocused()
  })

  test('shuts on a tap beside the photo, handing the focus back to the photo pressed', async ({
    page,
  }) => {
    // The last photo's tile
    const tile = tileOf(pagePhotos(page), 3)

    // Pressed
    await tile.click()

    // Shown large
    await expect(shownPhoto(page)).toHaveAttribute('alt', altOf(3))

    // A tap beside it
    await tapBesidePhoto(page)

    // The viewer gone
    await expectViewerShut(page)

    // The focus back on the tile it was opened from
    await expect(tile).toBeFocused()
  })

  test('shuts on a drag down', async ({ page }) => {
    // The second photo pressed
    await tileOf(pagePhotos(page), 2).click()

    // Shown large
    await expect(shownPhoto(page)).toHaveAttribute('alt', altOf(2))

    // Dragged down the screen
    await dragPhotoDown(page)

    // The viewer gone
    await expectViewerShut(page)
  })

  test('shuts the page behind it while open', async ({ page }) => {
    // The first photo pressed
    await tileOf(pagePhotos(page), 1).click()

    // Shown large
    await expect(shownPhoto(page)).toHaveAttribute('alt', altOf(1))

    // A tile on the page behind
    const behind = tileOf(pagePhotos(page), 2)

    // Asked for the focus
    await behind.focus()

    // Refused it, being shut while the viewer is open
    await expect(behind).not.toBeFocused()

    // Put away
    await page.keyboard.press('Escape')

    // The viewer gone
    await expectViewerShut(page)

    // Asked for the focus again
    await behind.focus()

    // Taking it now
    await expect(behind).toBeFocused()
  })

  test.describe('opened from a dialog', () => {
    test.beforeEach(async ({ page }) => {
      // The dialog opened
      await page.getByRole('button', { name: HARNESS_COPY.openDialog }).click()

      // On screen before anything in it is pressed
      await expectDialogOpen(page)
    })

    test('shuts on Escape, leaving the dialog open', async ({ page }) => {
      // The dialog's second photo's tile
      const tile = tileOf(photosDialog(page), 2)

      // Pressed
      await tile.click()

      // Shown large
      await expect(shownPhoto(page)).toHaveAttribute('alt', altOf(2))

      // Put away
      await page.keyboard.press('Escape')

      // The viewer gone
      await expectViewerShut(page)

      // The dialog still open, which shuts at once on an Escape of its own
      await expectDialogOpen(page)

      // The focus back on the tile in it
      await expect(tile).toBeFocused()
    })

    test('takes a press on its own buttons as a press inside the dialog', async ({ page }) => {
      // The dialog's first photo pressed
      await tileOf(photosDialog(page), 1).click()

      // Shown large
      await expect(shownPhoto(page)).toHaveAttribute('alt', altOf(1))

      // The viewer's own button to the next photo, pressed
      await page.getByRole('button', { name: viewerCopy.next }).click()

      // The next photo shown
      await expect(shownPhoto(page)).toHaveAttribute('alt', altOf(2))

      // The dialog still open, which shuts at once on a press outside it
      await expectDialogOpen(page)
    })

    test("shuts the dialog's own photos while open", async ({ page }) => {
      // The dialog's first photo pressed
      await tileOf(photosDialog(page), 1).click()

      // Shown large
      await expect(shownPhoto(page)).toHaveAttribute('alt', altOf(1))

      // Another tile in the dialog
      const behind = tileOf(photosDialog(page), 2)

      // Asked for the focus
      await behind.focus()

      // Refused it, being shut while the viewer is open
      await expect(behind).not.toBeFocused()
    })
  })
})

test.describe('photo viewer under a page that redraws', () => {
  test('stays on the photo moved to when the page redraws just after the move', async ({
    page,
  }) => {
    // The page's clock in the test's hands, so the page's next redraw can be made to come right after a move
    await page.clock.install()

    // The harness, redrawing on every tick of that clock
    await page.goto(HARNESS_PATH)

    // The first photo pressed
    await tileOf(pagePhotos(page), 1).click()

    // Shown large
    await expect(shownPhoto(page)).toHaveAttribute('alt', altOf(1))

    // Stepped on and back, round after round
    for (let round = 0; round < REDRAW_ROUNDS; round += 1) {
      // Each step of the round in turn
      for (const [key, photo] of ON_AND_BACK) {
        // The clock held, so the move and the page's next tick both wait on it
        await holdClock(page)

        // A step
        await page.keyboard.press(key)

        // The clock walked past the tick, the move then the redraw
        await page.clock.runFor(SECOND_MS)

        // The clock running again for the move's own animation
        await page.clock.resume()

        // On the photo moved to, where a redraw taken for the photo before would have put it back
        await expect(shownPhoto(page)).toHaveAttribute('alt', altOf(photo))
      }
    }
  })
})
