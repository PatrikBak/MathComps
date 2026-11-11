import type { Locator, Page } from '@playwright/test'

import { expect } from './test'

/** The slide the viewer has in view, which it marks by this class alone, the ones beside it being the same elements. */
const CURRENT_SLIDE = '.yarl__slide_current'

/** How far above the slide's bottom edge a tap beside the photo lands, inside the margin the slide keeps round it. */
const BESIDE_PHOTO_INSET_PX = 8

/** How far a drag down pulls the photo, well past what the viewer takes for a swipe that shuts it. */
const PULL_DOWN_PX = 300

/** How many moves the drag down is made of, since the viewer reads a swipe off the moves between press and release. */
const PULL_DOWN_STEPS = 10

/**
 * The image the full-screen viewer shows, of the several it keeps drawn on either side for the swipe.
 *
 * @param page - The page the viewer is open on.
 *
 * @returns The image shown.
 */
export function shownPhoto(page: Page): Locator {
  // The image in the slide in view
  return page.locator(`${CURRENT_SLIDE} img`)
}

/**
 * Taps the open viewer beside the photo it shows, under the photo at the bottom of the screen.
 *
 * @param page - The page the viewer is open on.
 */
export async function tapBesidePhoto(page: Page): Promise<void> {
  // The slide in view, the photo sitting in its middle
  const slide = page.locator(CURRENT_SLIDE)

  // Where the slide sits on screen
  const box = await slide.boundingBox()

  // A viewer with no slide in view has nothing to tap beside
  if (box === null) throw new Error('The viewer shows no slide to tap beside')

  // A tap at the middle of the slide's bottom edge
  await slide.click({ position: { x: box.width / 2, y: box.height - BESIDE_PHOTO_INSET_PX } })
}

/**
 * Drags the photo the open viewer shows down the screen, the swipe down a phone makes to put it away.
 *
 * @param page - The page the viewer is open on.
 */
export async function dragPhotoDown(page: Page): Promise<void> {
  // Where the slide in view sits on screen
  const box = await page.locator(CURRENT_SLIDE).boundingBox()

  // A viewer with no slide in view has nothing to drag
  if (box === null) throw new Error('The viewer shows no slide to drag')

  // Over the middle of the slide
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

  // Pressed there
  await page.mouse.down()

  // Moved straight down, a step at a time
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + PULL_DOWN_PX, {
    steps: PULL_DOWN_STEPS,
  })

  // Let go
  await page.mouse.up()
}

/**
 * Checks the full-screen viewer has gone, all of it rather than only the image it showed.
 *
 * @param page - The page the viewer was open on.
 */
export async function expectViewerShut(page: Page): Promise<void> {
  // The viewer's own root, gone once its fade-out has run
  await expect(page.locator('.yarl__root')).toHaveCount(0)
}
