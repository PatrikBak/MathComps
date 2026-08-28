import { facetsCopy, filtersCopy, KEPT_FILTER, recordTreeReadings } from './support/archive-filters'
import {
  BACKEND_ORIGIN,
  PROBLEMS_PATH,
  SEARCH_PATH,
  stubProblemSearch,
} from './support/backend-routes'
import { expect, test } from './support/test'

/** How long the library needs to read the URL and send the one search off the back of it. */
const SETTLE_TIMEOUT_MS = 15_000

/**
 * How long to watch a settled tree before calling its counts final: long enough for a reading the
 * page still owed to arrive, since a count that moves and moves back is exactly what this is about.
 */
const QUIET_MS = 1500

/**
 * How long the archive is made to think about a search before answering it.
 *
 * A stub answering the instant it is asked leaves the moment this test is about too short to reach
 * the screen at all: a count only has somewhere wrong to fall back to while a search is in flight,
 * and a wrong reading nobody painted is one the test could never have caught.
 */
const SEARCH_DELAY_MS = 400

/** The competition the fixture's one problem comes from, which is the one a reader would pick. */
const FOUND_COMPETITION = 'tst-d3'

/** What the button opening the competition facet is called, in the words the reader is given. */
const COMPETITION_FACET_BUTTON = facetsCopy.openPopover.replace(
  '{name}',
  filtersCopy.facets.competition.toLowerCase()
)

test.describe('the competition facet', () => {
  test('holds its counts still while a competition is picked', async ({ page }) => {
    // Every search answered with one and the same page of the archive, so a number seen to move here
    // moved inside the app rather than on the wire
    const searches = await stubProblemSearch(page, () => null)

    // The archive, made slow enough that anything drawn while it thinks gets painted
    await page.route(`${BACKEND_ORIGIN}${SEARCH_PATH}`, async (route) => {
      // Think about it
      await new Promise((resolve) => setTimeout(resolve, SEARCH_DELAY_MS))

      // Then hand it on to the stub standing in for the archive
      await route.fallback()
    })

    // Every reading the counts take, since a wrong one is over before an assertion could look
    const readings = await recordTreeReadings(page)

    // Open the archive on a search of the reader's own, which is what the counts are counted under
    await page.goto(`${PROBLEMS_PATH}?${KEPT_FILTER.param}`)

    // That search is answered before the facet is opened, so the counts start out settled
    await expect.poll(() => searches().length, { timeout: SETTLE_TIMEOUT_MS }).toBeGreaterThan(0)

    // Open the facet
    await page.getByRole('button', { name: COMPETITION_FACET_BUTTON }).click()

    // Wait for the tree to draw, since until it has there are no counts to hold anything to
    await expect.poll(() => readings().length, { timeout: SETTLE_TIMEOUT_MS }).toBeGreaterThan(0)

    // How many readings the counts had taken before anything was picked
    const readingsBeforePick = readings().length

    // Pick the competition the search found, which is a filter the archive counts this facet without
    await page.locator(`[data-facet-row-id="${FOUND_COMPETITION}"]`).click()

    // The pick reaches the archive
    await expect
      .poll(
        () =>
          searches().some((call) =>
            call.query.parameters.competitionPaths.includes(FOUND_COMPETITION)
          ),
        { timeout: SETTLE_TIMEOUT_MS }
      )
      .toBe(true)

    // Let the answer land and the tree settle on it
    await page.waitForTimeout(SEARCH_DELAY_MS + QUIET_MS)

    // The heart of it: not one count moved. The archive counts this facet without the filter the
    // facet itself sets, so picking a competition can only leave every number where it was, and a
    // number that flickers is the library reading its counts off something that is not this search.
    expect(readings().slice(readingsBeforePick)).toEqual([])
  })
})
