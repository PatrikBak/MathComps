import type { Locator, Page } from '@playwright/test'

import { expect } from './test'

/**
 * The image the full-screen viewer shows, of the several it keeps drawn on either side for the swipe.
 *
 * @param page - The page the viewer is open on.
 *
 * @returns The image shown.
 */
export function shownPhoto(page: Page): Locator {
  // The viewer marks the slide in view by its class alone, the ones beside it being the same image elements
  return page.locator('.yarl__slide_current img')
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
