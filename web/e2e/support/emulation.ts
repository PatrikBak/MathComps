import type { Page } from '@playwright/test'

declare global {
  interface Window {
    /** Brings on screen a page the test put out of sight. */
    showPage: () => void
    /** Puts out of sight a page the test keeps on screen, as the reader does switching to another browser tab. */
    hidePage: () => void
  }
}

/**
 * How far ahead of the page's own clock a pause is set, so the instant it names is still ahead when the pause
 * arrives: one already gone by is refused outright.
 */
const PAUSE_CUSHION_MS = 500

/**
 * Pauses the page's clock a moment ahead of where it stands, so anything timed on it from then on waits until the
 * spec walks it forward.
 *
 * @param page - The page whose clock to hold.
 */
export async function holdClock(page: Page): Promise<void> {
  // Where the page's own clock currently is
  const at = await page.evaluate(() => Date.now())

  // Held a cushion ahead of the page's clock
  await page.clock.pauseAt(at + PAUSE_CUSHION_MS)
}

/**
 * Slows the page's processor down as a slow phone runs it, so the work the page puts off is still pending when the
 * reader's next step comes.
 *
 * @param page - The page.
 * @param rate - How many times slower than the machine the page runs.
 */
export async function slowDown(page: Page, rate: number): Promise<void> {
  // A line to the browser itself
  const session = await page.context().newCDPSession(page)

  // The page's processor slowed, for the rest of the test
  await session.send('Emulation.setCPUThrottlingRate', { rate })
}

/**
 * Simulates leaving the tab and coming back, which React Query watches to decide whether to read a query
 * again.
 *
 * @param page - The page to switch away from and back to.
 */
export async function returnToTab(page: Page): Promise<void> {
  // React Query reads document.visibilityState and listens for the event on window, so overriding
  // the one and dispatching the other is the whole of a tab switch as far as it is concerned
  await page.evaluate(() => {
    // A function which puts the document into a visibility state and announces it
    const setVisibility = (state: string) => {
      // The document reporting the state
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })

      // The change announced
      window.dispatchEvent(new Event('visibilitychange'))
    }

    // Leave the tab
    setVisibility('hidden')

    // Come back to it
    setVisibility('visible')
  })
}

/**
 * Puts whether the page is on screen in the test's hands, through {@link Window.showPage} and {@link Window.hidePage},
 * as the reader brings a browser tab up or puts it behind another.
 *
 * @param page - The page.
 * @param initially - Whether the page opens on screen or out of sight.
 */
export async function stubPageVisibility(
  page: Page,
  initially: DocumentVisibilityState
): Promise<void> {
  // The page's visibility, as the test sets it
  await page.addInitScript((startsAs: DocumentVisibilityState) => {
    // Whether the page is on screen
    let visibility = startsAs

    // What the page says about being on screen
    Object.defineProperty(document, 'visibilityState', { get: () => visibility })

    // A function which brings the page on screen or puts it out of sight, saying so up to the window as a browser does
    const turnTo = (next: DocumentVisibilityState) => {
      // On screen or out of sight
      visibility = next

      // Said so
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
    }

    // The ways to bring the page on screen and to put it out of sight
    window.showPage = () => turnTo('visible')
    window.hidePage = () => turnTo('hidden')
  }, initially)
}

/**
 * Cuts the browser's own offline signal, which is what tells React Query to hold requests back.
 *
 * Taking the network itself away would also take the page's own server with it, so a step that
 * navigates could not be fetched and would leave the browser on its error page with no app left to
 * assert against.
 *
 * @param page - The page to take offline.
 */
export async function goOffline(page: Page): Promise<void> {
  // Both React Query and the app-wide banner read the property and listen for the event on window
  await page.evaluate(() => {
    // The browser saying it is offline
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })

    // And announcing it
    window.dispatchEvent(new Event('offline'))
  })
}
