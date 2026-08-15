import type { Page } from '@playwright/test'

import { URL_PARAMS } from '@/components/features/problems/utils/search-url-serialization'

import messages from '../../messages/en.json'

/**
 * The copy the assertions match on, taken from the app's own English messages: what each of them
 * means is that a particular message is on screen, not that a particular sentence is.
 */
const { problems: problemsCopy, auth: authCopy, ui: uiCopy } = messages

/** The copy the filter controls read under. */
export const filtersCopy = problemsCopy.filters

/** The copy a filter that could not be honoured is explained with. */
export const errorsCopy = problemsCopy.errors

/** The copy an offer to sign in reads under. */
export const signInCopy = authCopy

/** The copy every facet control reads under, whichever facet it belongs to. */
export const facetsCopy = uiCopy.filters

/**
 * The key {@link KEPT_FILTER} is written under, taken from the library's own spelling of it. A
 * literal here would go on asserting about a parameter nothing writes the day that spelling changes,
 * and the specs would keep passing while covering nothing.
 */
const KEY = URL_PARAMS.SEARCH_TEXT

/** What {@link KEPT_FILTER} is set to. */
const VALUE = 'inequality'

/**
 * A search of the reader's own, riding alongside every filter that turns out not to hold.
 *
 * It is the whole point of most of what these specs assert: losing a filter a reader may not have
 * is no reason to lose the ones they may, and a reader left to rebuild their search by hand has
 * been charged for somebody else's problem. It carries its own three readings because a test needs
 * all of them, and deriving the URL half rather than writing it twice is what keeps them agreeing.
 */
export const KEPT_FILTER = {
  /** The key to read it back under. */
  key: KEY,
  /** The value to hold the reading against. */
  value: VALUE,
  /** The pair as a URL asks for them. */
  param: `${KEY}=${VALUE}`,
}

/**
 * The filters a page is currently carrying.
 *
 * Read as parameters rather than matched as a whole URL, since what matters is which filters are
 * there and which are gone, never the order a rewrite happens to put them in.
 *
 * @param page - The page whose URL to read.
 *
 * @returns The URL's query parameters.
 */
export function filtersInUrl(page: Page): URLSearchParams {
  // The query half of wherever the reader currently is
  return new URL(page.url()).searchParams
}

declare global {
  interface Window {
    /** Hands one reading of a facet tree over to the test run. */
    reportTreeReading: (reading: string) => void
    /** Whether this document's tree is already being read. */
    isWatchingTree?: boolean
  }
}

/**
 * Reads the facet tree on every frame the browser paints, handing over each reading that differs
 * from the one before it.
 *
 * A row states its own count in the name it is given to anyone reading the page aloud, so the names
 * of the rows on show are the counts as the reader has them. Written to be installed twice over a
 * page's life, it refuses to watch a document it is already watching: two watchers would hand the
 * same reading over twice, and each would then read as a count that moved and came back.
 */
function watchTree(): void {
  // This document is already accounted for
  if (window.isWatchingTree) return

  // From here it is being watched
  window.isWatchingTree = true

  // The reading handed over last, which is what makes the next one worth handing over
  let previous = ''

  // A function which reads the rows as they stand and hands over anything that has moved
  const readTree = () => {
    // Every row on show, each named as it is read aloud, which is name and count together
    const reading = [...document.querySelectorAll('[data-facet-row-id]')]
      .map((row) => row.getAttribute('aria-label'))
      .join(', ')

    // A shut facet draws no rows, which is no reading of the counts rather than a reading of none
    if (reading !== '' && reading !== previous) {
      // Hand it over, once
      previous = reading
      window.reportTreeReading(reading)
    }

    // Read them again on the next frame, since a reading nobody painted is one nobody could see
    requestAnimationFrame(readTree)
  }

  // Take the first reading now, rather than a frame into the future
  readTree()
}

/**
 * Records every reading the facet tree's counts take, for as long as the test runs.
 *
 * The counts a facet shows are answers to a search, so a wrong one lives exactly as long as the
 * search that would replace it: looking at them once they have settled cannot tell a count that held
 * still from one that moved and moved back. Watching them frame by frame answers whether they ever
 * took a second value, which is the whole of what an invariant like this can be held to.
 *
 * @param page - The page to watch.
 *
 * @returns Every reading taken so far, oldest first.
 */
export async function recordTreeReadings(page: Page): Promise<() => string[]> {
  // Every reading the counts took, in the order they took it
  const readings: string[] = []

  // The channel the page hands each reading back through
  await page.exposeFunction('reportTreeReading', (reading: string) => {
    readings.push(reading)
  })

  // Every document from the next one on, since the counts are drawn long before a test can look
  await page.addInitScript(watchTree)

  // And the document already open, so that calling this after a page has loaded records that page
  await page.evaluate(watchTree)

  // Hand back a snapshot on each read, so a list cannot grow underneath an assertion mid-check
  return () => [...readings]
}

/**
 * The offer a reader gets when a filter they asked for only means something as their own.
 *
 * @param reason - What the account is needed for, as the control naming the filter puts it.
 *
 * @returns The sentence the offer reads.
 */
export function loginPromptFor(reason: string): string {
  // The reason is the only thing that varies between one offer and the next
  return authCopy.loginRequired.replace('{reason}', reason)
}
