import { expect, test } from '@playwright/test'

import {
  errorsCopy,
  filtersCopy,
  filtersInUrl,
  KEPT_FILTER,
  loginPromptFor,
} from './support/archive-filters'
import { PROBLEMS_PATH, recordNotices, stubProblemSearch } from './support/backend-routes'

/**
 * How long the library needs to settle: boot Clerk, resolve who is reading, and send its first
 * search off the back of that.
 */
const SETTLE_TIMEOUT_MS = 15_000

/**
 * How long to sit on a settled page before calling its traffic finished. Each test below turns on
 * exactly one search having gone out, and only a window like this tells one search from the first
 * of two.
 */
const QUIET_MS = 2000

/** A list belonging to somebody else, which its owner has not shared. */
const SOMEBODY_ELSES_LIST_ID = 'somebody-elses-list'

/** A list the reader owns and has not shared. */
const PRIVATE_LIST_ID = 'private-list'

test.describe('problem library filters for a reader who is already signed in', () => {
  test('keeps the rest of the search when the list belongs to somebody else', async ({ page }) => {
    // Everything the reader is told from here
    const notices = await recordNotices(page)

    // A list this reader may not have, which being signed in does nothing to change. Only the search
    // naming it is refused, so the library left behind can actually load.
    await stubProblemSearch(page, (call) =>
      call.query.listContentId === SOMEBODY_ELSES_LIST_ID ? 'ListAccessDenied' : null
    )

    // Open it, with a search of the reader's own alongside
    await page.goto(`${PROBLEMS_PATH}?${KEPT_FILTER.param}&list=${SOMEBODY_ELSES_LIST_ID}`)

    // The filter they cannot use comes out of the URL
    await expect
      .poll(() => filtersInUrl(page).get('list'), { timeout: SETTLE_TIMEOUT_MS })
      .toBeNull()

    // And nothing else goes with it
    expect(filtersInUrl(page).get(KEPT_FILTER.key)).toBe(KEPT_FILTER.value)

    // Let anything else that moment raised reach the screen
    await page.waitForTimeout(QUIET_MS)

    // The reader is told whose list it is not, which is the one thing they could act on. Once:
    // taking the filter out of the URL brings the same refusal round again.
    expect(notices().filter((notice) => notice === errorsCopy.listAccessDenied)).toHaveLength(1)
  })

  test('opens a private list on one search, and that search knows who is asking', async ({
    page,
  }) => {
    // The ownership rule itself: a private list is its owner's, and the token is who the owner is
    const searches = await stubProblemSearch(page, (call) =>
      call.query.listContentId === PRIVATE_LIST_ID && !call.isAuthenticated
        ? 'ListAccessDenied'
        : null
    )

    // Land on the list cold, which is the case where the reader is resolved and the URL read at once
    await page.goto(`${PROBLEMS_PATH}?list=${PRIVATE_LIST_ID}`)

    // The list opens
    await expect.poll(() => searches().length, { timeout: SETTLE_TIMEOUT_MS }).toBeGreaterThan(0)

    // Let any second search the boot might have raced out arrive
    await page.waitForTimeout(QUIET_MS)

    // Exactly one search went out. A second would mean the library asked before it knew who was
    // reading, and spent the first attempt being refused for it.
    expect(searches()).toHaveLength(1)

    // And the one search that went out carried the reader with it
    expect(searches()[0]?.isAuthenticated).toBe(true)
  })

  test('keeps the rest of the search when the archive refuses a filter that needs an account', async ({
    page,
  }) => {
    // Everything the reader is told from here
    const notices = await recordNotices(page)

    // The archive answering as though nobody had asked, which is what a session expiring between
    // the library weighing the reader and the search reaching the backend looks like from here.
    // Nothing the library does on its own produces this, which is exactly why it is worth pinning.
    await stubProblemSearch(page, (call) =>
      call.query.favoritesOnly ? 'FavoritesRequireAuthentication' : null
    )

    // Read the reader's own favorites, with a search of their own narrowing them
    await page.goto(`${PROBLEMS_PATH}?${KEPT_FILTER.param}&favoritesOnly=true`)

    // The filter the archive will not serve comes out of the URL
    await expect
      .poll(() => filtersInUrl(page).get('favoritesOnly'), { timeout: SETTLE_TIMEOUT_MS })
      .toBeNull()

    // Their own search outlives it
    expect(filtersInUrl(page).get(KEPT_FILTER.key)).toBe(KEPT_FILTER.value)

    // And the reader is left reading rather than sent off mid-page
    await expect(page).toHaveURL(/\/en\/problems/)

    // Let the notice reach the screen
    await page.waitForTimeout(QUIET_MS)

    // The way back is offered, naming the filter that needs the account
    expect(notices()).toContain(loginPromptFor(filtersCopy.viewFavoritesAuthReason))

    // And nothing is also said about a list, which this refusal was never about
    expect(notices()).not.toContain(errorsCopy.listAccessDenied)

    // Nor about one that is missing
    expect(notices()).not.toContain(errorsCopy.listNotFound)
  })

  test('opens favorites on one search, and that search knows who is asking', async ({ page }) => {
    // Favorites belong to whoever asked for them, and nobody is who nobody's are
    const searches = await stubProblemSearch(page, (call) =>
      call.query.favoritesOnly && !call.isAuthenticated ? 'FavoritesRequireAuthentication' : null
    )

    // Land on the reader's own favorites cold
    await page.goto(`${PROBLEMS_PATH}?favoritesOnly=true`)

    // The favorites open
    await expect.poll(() => searches().length, { timeout: SETTLE_TIMEOUT_MS }).toBeGreaterThan(0)

    // Let any second search the boot might have raced out arrive
    await page.waitForTimeout(QUIET_MS)

    // Exactly one search went out. A second would mean the library asked before it knew who was
    // reading, and spent the first attempt being refused for it.
    expect(searches()).toHaveLength(1)

    // The one that went out carried the reader with it
    expect(searches()[0]?.isAuthenticated).toBe(true)

    // And still asked for the filter, which a reader read as nobody would have lost
    expect(searches()[0]?.query.favoritesOnly).toBe(true)
  })

  test('opens marked problems on one search, and that search knows who is asking', async ({
    page,
  }) => {
    // Marks belong to whoever made them, and nobody has made none
    const searches = await stubProblemSearch(page, (call) =>
      call.query.markStatus !== null && !call.isAuthenticated
        ? 'MarkStatusRequiresAuthentication'
        : null
    )

    // Land on the reader's own marked problems cold
    await page.goto(`${PROBLEMS_PATH}?markStatus=marked`)

    // The marked problems open
    await expect.poll(() => searches().length, { timeout: SETTLE_TIMEOUT_MS }).toBeGreaterThan(0)

    // Let any second search the boot might have raced out arrive
    await page.waitForTimeout(QUIET_MS)

    // Exactly one search went out. A second would mean the library asked before it knew who was
    // reading, and spent the first attempt being refused for it.
    expect(searches()).toHaveLength(1)

    // The one that went out carried the reader with it
    expect(searches()[0]?.isAuthenticated).toBe(true)

    // And still asked for the filter, which a reader read as nobody would have lost
    expect(searches()[0]?.query.markStatus).toBe('marked')
  })
})
