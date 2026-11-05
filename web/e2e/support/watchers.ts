import type { Page } from '@playwright/test'

declare global {
  interface Window {
    /** Hands a notice's text to the test run as the notice reaches the screen. */
    reportNotice: (text: string) => void
    /** Whether this document is already being watched for notices. */
    isWatchingNotices?: boolean
    /** Tells the test run that a dialog has reached the page. */
    reportDialog: () => void
    /** Hands the test run one call the page made that can scroll it, or the scroll that took it off the top. */
    reportScroll: (entry: string) => void
    /** Hands the test run each text a status region on the page announces. */
    reportAnnouncement: (text: string) => void
    /** Whether this document's status regions are already being watched. */
    isWatchingAnnouncements?: boolean
  }
}

/**
 * A function on the page's window that a watcher hands each text back to the test run through.
 */
type TextChannel = 'reportNotice' | 'reportAnnouncement'

/**
 * Records every text a watcher run in the page hands back, for as long as the test runs.
 *
 * The watcher goes in twice over a page's life, once into the document that is already open and once ahead of every
 * document after it, so it has to refuse a document it already watches: two watchers would hand the same text over
 * twice, and a test counting them would read that as the page having said it twice. Recording nothing in the document
 * already open would let every "nothing was said" assertion pass unchecked.
 *
 * @param page - The page to watch.
 * @param channel - The function the watcher hands each text back through.
 * @param watch - The watcher, run in each document.
 *
 * @returns Every text handed back so far, oldest first, repeats included.
 */
async function recordHandedBack(
  page: Page,
  channel: TextChannel,
  watch: () => void
): Promise<() => string[]> {
  // Every text handed back, in the order it arrived
  const texts: string[] = []

  // The channel the page hands each text back through, each recorded as it arrives
  await page.exposeFunction(channel, (text: string) => {
    texts.push(text)
  })

  // Every document from the next one on
  await page.addInitScript(watch)

  // And the document already open, so a call after a page has loaded still records that page
  await page.evaluate(watch)

  // A snapshot on each read, so a list cannot grow underneath an assertion mid-check
  return () => [...texts]
}

/**
 * Watches a document for notices and hands each one over as it becomes readable, once per document, as
 * {@link recordHandedBack} installs it.
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
  return recordHandedBack(page, 'reportNotice', watchForNotices)
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

/**
 * Records every call the page's own code makes that can scroll it, and the first scroll that takes it off the top,
 * in every document from the next one on.
 *
 * A page found off the top says only where it ended up, never what moved it. Written down as they happen, the calls
 * do: a page that moved with none of them recorded was moved by the browser, or by a hash the code set.
 *
 * @param page - The page to watch, before the document under test loads.
 *
 * @returns Everything recorded so far, oldest first, each with when it happened.
 */
export async function recordScrolls(page: Page): Promise<() => string[]> {
  // Everything recorded, in the order it happened
  const scrolls: string[] = []

  // The channel the page hands each one back through, each recorded as it arrives
  await page.exposeFunction('reportScroll', (entry: string) => {
    scrolls.push(entry)
  })

  // Every document from the next one on, set up before any of its own scripts run
  await page.addInitScript(() => {
    // A function which hands over one call the page's code made, with when and the stack that made it
    const report = (call: string) =>
      window.reportScroll(`${call} at ${Math.round(performance.now())}ms\n${new Error().stack}`)

    // A function which has one of an object's methods hand itself over before it runs
    const watch = (owner: object, method: string, call: string) => {
      // The method as the browser gives it
      const original = Reflect.get(owner, method) as (...args: unknown[]) => unknown

      // The same method, handed over first
      Reflect.set(owner, method, function (this: unknown, ...args: unknown[]) {
        // The call, handed over
        report(call)

        // And run as asked
        return Reflect.apply(original, this, args)
      })
    }

    // The window's and the elements' scrolling methods, and the focus, which scrolls to what it lands on
    watch(window, 'scroll', 'window.scroll')
    watch(window, 'scrollTo', 'window.scrollTo')
    watch(window, 'scrollBy', 'window.scrollBy')
    watch(Element.prototype, 'scroll', 'element.scroll')
    watch(Element.prototype, 'scrollTo', 'element.scrollTo')
    watch(Element.prototype, 'scrollBy', 'element.scrollBy')
    watch(Element.prototype, 'scrollIntoView', 'scrollIntoView')
    watch(HTMLElement.prototype, 'focus', 'focus')

    // The browser's own scroll offset of an element, read and set
    const scrollTop = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop')!

    // The page's own offset, handed over whenever the page's code sets it
    Object.defineProperty(Element.prototype, 'scrollTop', {
      ...scrollTop,
      set(this: Element, value: number) {
        // Only the page's own offset moves the page
        if (this === document.scrollingElement) report(`scrollTop = ${value}`)

        // And set as asked
        scrollTop.set!.call(this, value)
      },
    })

    // A function which hands over the first scroll that takes the page off the top, however it came about
    const reportLeavingTop = () => {
      // Still at the top
      if (window.scrollY === 0) return

      // Only the first one away from it
      window.removeEventListener('scroll', reportLeavingTop)

      // The element the hash names, as the page holds it at that moment
      const target = document.getElementById(window.location.hash.slice(1))

      // Where that element stood: nowhere, out of sight in the page's hidden placeholder, or on the page
      const targetState =
        target === null
          ? 'missing'
          : target.checkVisibility()
            ? `showing at ${Math.round(target.getBoundingClientRect().top + window.scrollY)}px`
            : 'hidden'

      // How the document was reached
      const [navigation] = performance.getEntriesByType(
        'navigation'
      ) as PerformanceNavigationTiming[]

      // Where the page went, when, how it stood, and how it was reached
      window.reportScroll(
        `off the top to ${window.scrollY}px at ${Math.round(performance.now())}ms, ` +
          `the page ${document.documentElement.scrollHeight}px tall and ${document.readyState}, ` +
          `the target ${targetState}, after a ${navigation?.type} with ${window.history.scrollRestoration} ` +
          'scroll restoration'
      )
    }

    // Every scroll the page makes, listened to until one leaves the top
    window.addEventListener('scroll', reportLeavingTop, { passive: true })
  })

  // Hand back a snapshot on each read
  return () => [...scrolls]
}

/**
 * Watches every status region of the document and hands over each text it says, once per document, as
 * {@link recordHandedBack} installs it.
 */
function watchForAnnouncements(): void {
  // This document is already accounted for
  if (window.isWatchingAnnouncements) return

  // This document is watched from here on
  window.isWatchingAnnouncements = true

  // What each status region said when last looked at
  const lastSaid = new WeakMap<Element, string>()

  // A function which hands over what each status region says, wherever it says something new
  const reportNewAnnouncements = () => {
    document.querySelectorAll('[role="status"]').forEach((region) => {
      // What the region says now
      const text = region.textContent?.trim() ?? ''

      // Nothing new said there
      if (lastSaid.get(region) === text) return

      // Remembered, so the same words are handed over once each time they arrive
      lastSaid.set(region, text)

      // Handed to the test run, where the region says anything
      if (text !== '') window.reportAnnouncement(text)
    })
  }

  // Whatever the regions already say
  reportNewAnnouncements()

  // And everything the regions say from here on, text arriving counting as much as a node arriving. The document
  // itself is what there is to watch: installed ahead of a page, this runs before that page has been parsed
  new MutationObserver(reportNewAnnouncements).observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
  })
}

/**
 * Records every text the page's status regions announce, for as long as the test runs. A region says a thing and falls
 * silent again, so looking at it at a chosen moment cannot tell one that never spoke from one that already stopped;
 * watching it as it speaks answers whether it ever did.
 *
 * @param page - The page to watch.
 *
 * @returns Every text announced so far, oldest first, repeats included.
 */
export async function recordStatusAnnouncements(page: Page): Promise<() => string[]> {
  // Every text announced, in the order it was said
  return recordHandedBack(page, 'reportAnnouncement', watchForAnnouncements)
}
