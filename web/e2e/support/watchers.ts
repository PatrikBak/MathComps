import type { Page } from '@playwright/test'

declare global {
  interface Window {
    /** Hands a notice's text to the test run as the notice reaches the screen. */
    reportNotice: (text: string) => void
    /** Whether this document is already being watched for notices. */
    isWatchingNotices?: boolean
    /** Tells the test run that a dialog has reached the page. */
    reportDialog: () => void
  }
}

/**
 * Watches a document for notices and hands each one over as it becomes readable.
 *
 * Written to be installed twice over a page's life, once into the document that is already open and
 * once ahead of every document after it, so it refuses to watch a document it is already watching:
 * two watchers would hand the same notice over twice, and a test counting them would read that as
 * the app having said it twice.
 */
function watchForNotices(): void {
  // This document is already accounted for
  if (window.isWatchingNotices) return

  // This document is watched from here on
  window.isWatchingNotices = true

  // The notices already handed over, held by node so that two saying the same thing both count
  const reported = new WeakSet<Element>()

  // A function which hands over every notice on screen that has not been handed over yet
  const reportNewNotices = () => {
    document.querySelectorAll('[data-sonner-toast]').forEach((notice) => {
      // Already accounted for
      if (reported.has(notice)) return

      // The message itself, which the notice's own actions sit beside rather than inside
      const message = notice.querySelector('[data-title]')?.textContent?.trim() ?? ''

      // The node is on screen a moment before its text is, so it is worth another mutation
      if (message === '') return

      // Remember the notice, so it is handed over once
      reported.add(notice)

      // Hand the message to the test run
      window.reportNotice(message)
    })
  }

  // The document itself is what there is to watch: installed ahead of a page, this runs before that
  // page has been parsed, so its root element does not exist yet. Text arriving counts as much as a
  // node arriving, since a notice is only readable once it has both.
  new MutationObserver(reportNewNotices).observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
  })
}

/**
 * Records every notice the page raises, for as long as the test runs.
 *
 * A notice takes itself back down after a few seconds, so looking for one at a chosen moment cannot
 * tell one that was never raised from one that has already expired: the check passes either way, and
 * an assertion that a reader was NOT told something is exactly the kind that then proves nothing.
 * Watching for them as they arrive answers whether, and how many times, rather than whether now.
 *
 * @param page - The page to watch.
 *
 * @returns Every notice raised so far, oldest first, repeats included.
 */
export async function recordNotices(page: Page): Promise<() => string[]> {
  // Every notice that reached the screen, in the order it got there
  const notices: string[] = []

  // The channel the page hands each notice back through, each one recorded as it arrives
  await page.exposeFunction('reportNotice', (text: string) => {
    notices.push(text)
  })

  // Every document from the next one on, since the first notice of a page can be up and gone before
  // the first assertion of a test is reached
  await page.addInitScript(watchForNotices)

  // And the document already open, so a call after a page has loaded still records that page.
  // Recording nothing there would let every "nothing was said" assertion pass unchecked
  await page.evaluate(watchForNotices)

  // Hand back a snapshot on each read, so a list cannot grow underneath an assertion mid-check
  return () => [...notices]
}

/**
 * Counts every dialog that reaches the page.
 *
 * A dialog opened and closed again before an assertion is reached leaves the page looking as if it never
 * opened, so a check taken afterwards passes either way. Watching for them as they arrive is what tells a
 * page that opened nothing from one that opened a dialog and took it back down.
 *
 * @param page - The page to watch, before it loads anything.
 *
 * @returns How many dialogs have reached the page so far.
 */
export async function countDialogs(page: Page): Promise<() => number> {
  // Every dialog that reached the page
  let dialogs = 0

  // The channel the page reports each dialog through, each one counted as it arrives
  await page.exposeFunction('reportDialog', () => {
    dialogs += 1
  })

  // Every document from the next one on, since the one under test is about to load
  await page.addInitScript(() => {
    // The dialogs already reported, so one that stays up counts once
    const reported = new WeakSet<Element>()

    // A function which reports every dialog on the page not reported yet
    const reportNewDialogs = () => {
      document.querySelectorAll('[role="dialog"]').forEach((dialog) => {
        // Already counted
        if (reported.has(dialog)) return

        // Remembered, so it counts once
        reported.add(dialog)

        // And counted
        window.reportDialog()
      })
    }

    // The document itself, whose root does not exist yet this early
    new MutationObserver(reportNewDialogs).observe(document, { childList: true, subtree: true })
  })

  // Hand back the count on each read
  return () => dialogs
}
