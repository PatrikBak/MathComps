import type { Locator, Page } from '@playwright/test'

import messages from '../../messages/en.json'
import { expect } from './test'

/** The labels the header's user menu reads under. */
export const userMenuCopy = messages.ui.userMenu

/** How long sign-in has to settle before the header's user menu is called missing. */
const SIGN_IN_TIMEOUT_MS = 15_000

/**
 * Opens the header's user menu once the page is up.
 *
 * @param page - The page it is opened on.
 */
export async function openUserMenu(page: Page): Promise<void> {
  // The menu's button
  const userMenu = page.getByRole('button', { name: userMenuCopy.label })

  // Drawn once sign-in has settled
  await expect(userMenu).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

  // Opened
  await userMenu.click()
}

/**
 * Whether an element shows the ring a browser draws around focus it lets the reader see.
 *
 * @param element - The element.
 *
 * @returns Whether it does.
 */
export function showsFocusRing(element: Locator): Promise<boolean> {
  // Read off the element itself
  return element.evaluate((node) => node.matches(':focus-visible'))
}

/**
 * The selected tab of a strip of tabs.
 *
 * @param page - The page.
 * @param tabsLabel - What the strip of tabs is called.
 *
 * @returns The tab.
 */
export function selectedTab(page: Page, tabsLabel: string) {
  // The selected tab of the strip
  return page.getByRole('tablist', { name: tabsLabel }).getByRole('tab', { selected: true })
}

/**
 * How far down the window is scrolled.
 *
 * @param page - The page.
 *
 * @returns The scroll, in pixels from the top.
 */
export function windowScroll(page: Page): Promise<number> {
  // Read off the window itself
  return page.evaluate(() => window.scrollY)
}

/**
 * How far down the window could be scrolled at most, which is how much taller the page is than the window.
 *
 * @param page - The page.
 *
 * @returns The furthest scroll, in pixels from the top.
 */
export function furthestScroll(page: Page): Promise<number> {
  // The page's height past the window's
  return page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
}

/**
 * How far below the view's top an element stands.
 *
 * @param element - The element.
 *
 * @returns The distance, in pixels, negative for an element starting above the view.
 */
export function topInView(element: Locator): Promise<number> {
  // Read off the element itself
  return element.evaluate((node) => node.getBoundingClientRect().top)
}

/**
 * Scrolls the window to a spot, handing back once the scroll has been dispatched, as a reader's own scroll
 * always is before their next click.
 *
 * @param page - The page.
 * @param top - The spot, in pixels from the top.
 */
export async function scrollWindowTo(page: Page, top: number): Promise<void> {
  // Scrolled there, and waited on until the page has heard it
  await page.evaluate(
    (spot) =>
      new Promise<void>((resolve) => {
        // Where the window stands before the jump
        const from = window.scrollY

        // Handed back once the scroll is heard
        window.addEventListener('scroll', () => resolve(), { once: true })

        // Jumped there, since the site otherwise scrolls smoothly
        window.scrollTo({ top: spot, behavior: 'instant' })

        // Handed back at once by a window that stood there already, since staying put raises no scroll
        if (window.scrollY === from) resolve()
      }),
    top
  )

  // There, which a page too short for the spot would have cut short
  expect(await windowScroll(page)).toBe(top)
}

/**
 * Waits until the page is two frames on, by which time it has painted whatever the last step set off.
 *
 * @param page - The page.
 */
export async function twoFramesLater(page: Page): Promise<void> {
  // Waited out inside the page
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        // The next frame, and the one after it
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )
}

/**
 * Clicks a link where it sits. Playwright's own click scrolls its target into view first, which would move the
 * very spot a test is measuring.
 *
 * @param page - The page.
 * @param name - The link's accessible name, or a part of it.
 */
export async function clickInPlace(page: Page, name: string): Promise<void> {
  // A plain click, fired on the link itself
  await page.getByRole('link', { name }).evaluate((element: HTMLElement) => element.click())
}

/**
 * Clicks a link twice where it sits, the second click landing before the page has answered the first.
 *
 * @param link - The link.
 */
export async function clickTwiceAtOnce(link: Locator): Promise<void> {
  // Both clicks, fired on the link itself in one go
  await link.evaluate((element: HTMLElement) => {
    // The first click
    element.click()

    // And the second, before anything has rendered
    element.click()
  })
}

/** How long a long press is held down, with room to spare over the shortest hold the app counts as one. */
export const LONG_PRESS_MS = 800

/**
 * Holds a finger on an element long enough to count as a long press, then lifts it.
 *
 * @param page - The page.
 * @param target - What the finger lands on.
 */
export async function longPressByTouch(page: Page, target: Locator): Promise<void> {
  // Scrolled into view, since the finger has to land on it
  await target.scrollIntoViewIfNeeded()

  // Where the element sits
  const box = (await target.boundingBox())!

  // The browser's own touch input, the only way to hold a finger down rather than tap
  const touch = await page.context().newCDPSession(page)

  // A finger put down on its middle
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  })

  // Held there
  await page.waitForTimeout(LONG_PRESS_MS)

  // And lifted
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}
