import { expect, test } from '@playwright/test'

import {
  errorsCopy,
  filtersCopy,
  filtersInUrl,
  KEPT_FILTER,
  loginPromptFor,
  signInCopy,
} from './support/archive-filters'
import type { SearchCall } from './support/backend-routes'
import { PROBLEMS_PATH, recordNotices, stubProblemSearch } from './support/backend-routes'
import { endSessionInPlace, signInTestUser } from './support/session'

/**
 * How long the library needs to settle: read the URL, weigh whoever is reading, and send at most one
 * search off the back of the two. Generous, since a real sign-in rides in front of half of these.
 */
const SETTLE_TIMEOUT_MS = 15_000

/**
 * How long to sit on a settled page before calling it done: long enough for a request or a notice
 * the page still owed to arrive, and short enough that a notice which did arrive has not yet
 * expired. Every assertion that something did NOT happen needs a window like this, or it only
 * proves the thing was slow.
 */
const QUIET_MS = 1500

/** A list the reader owns and has not shared, which nobody else may open. */
const PRIVATE_LIST_ID = 'private-list'

/** A list its owner shared, which anybody may open, signed in or not. */
const SHARED_LIST_ID = 'shared-list'

/** A list that no longer exists. */
const DELETED_LIST_ID = 'deleted-list'

/**
 * The searches sent after a moment that is being tested, which is the only half that says anything.
 *
 * A session ending is a change to what the library may ask for, so what it asked for beforehand is
 * beside the point, and asserting over the lot would fail on the very request that set the scene.
 *
 * @param searches - Every search sent so far.
 * @param sentBefore - How many had been sent when the moment arrived.
 *
 * @returns The searches sent since.
 */
function sentSince(searches: SearchCall[], sentBefore: number): SearchCall[] {
  // Everything from the count taken at that moment onwards
  return searches.slice(sentBefore)
}

test.describe('problem library filters across a sign-in change', () => {
  test('keeps the rest of the search when a session ending takes the reader out of their own list', async ({
    page,
  }) => {
    // Everything the reader is told from here, since what they are told is what this is about
    const notices = await recordNotices(page)

    // Clerk's client only exists once a page of the app has booted
    await page.goto('/')

    // A session of this test's own, which is the one it is about to end
    await signInTestUser(page)

    // The ownership rule itself: a private list is its owner's, and the token is who the owner is
    const searches = await stubProblemSearch(page, (call) =>
      call.query.listContentId === PRIVATE_LIST_ID && !call.isAuthenticated
        ? 'ListAccessDenied'
        : null
    )

    // Open the list, with a search of the reader's own narrowing it further
    await page.goto(`${PROBLEMS_PATH}?${KEPT_FILTER.param}&list=${PRIVATE_LIST_ID}`)

    // The list opens, on a search that carried the reader with it
    await expect
      .poll(() => searches().some((call) => call.isAuthenticated), {
        timeout: SETTLE_TIMEOUT_MS,
      })
      .toBe(true)

    // The session ends underneath them, with the reader still on the list
    await endSessionInPlace(page)

    // The list is no longer theirs to read, so it comes out of the URL
    await expect
      .poll(() => filtersInUrl(page).get('list'), { timeout: SETTLE_TIMEOUT_MS })
      .toBeNull()

    // The heart of it: their own search outlives the list. Losing a filter they may no longer have
    // is no reason to lose the ones they may.
    expect(filtersInUrl(page).get(KEPT_FILTER.key)).toBe(KEPT_FILTER.value)

    // And they are still reading, rather than sent somewhere they never asked to go
    await expect(page).toHaveURL(/\/en\/problems/)

    // Let the notice reach the screen
    await page.waitForTimeout(QUIET_MS)

    // They are told what actually happened
    expect(notices()).toContain(errorsCopy.listSignInExpired)

    // Rather than accused of opening somebody else's list, which is not what they did
    expect(notices()).not.toContain(errorsCopy.listAccessDenied)

    // Taking the offer up
    await page.getByRole('button', { name: signInCopy.login }).click()

    // Leads to signing in
    await expect(page).toHaveURL(/\/en\/sign-in\?/)

    // Carrying the list they were reading, so signing back in puts them where they left off
    expect(new URL(page.url()).searchParams.get('returnUrl')).toContain(`list=${PRIVATE_LIST_ID}`)
  })

  test('opens a shared list for a reader who is not signed in', async ({ page }) => {
    // A shared list is readable by anyone, which is what makes the token beside the point here
    const searches = await stubProblemSearch(page, () => null)

    // Open the shared list with nobody signed in
    await page.goto(`${PROBLEMS_PATH}?list=${SHARED_LIST_ID}`)

    // The search goes out naming the list, and carries no reader with it
    await expect
      .poll(() => searches(), { timeout: SETTLE_TIMEOUT_MS })
      .toContainEqual({
        query: expect.objectContaining({ listContentId: SHARED_LIST_ID }),
        isAuthenticated: false,
      })

    // The filter is still what the reader asked for, rather than a library they never asked to see
    await expect(page).toHaveURL(`${PROBLEMS_PATH}?list=${SHARED_LIST_ID}`)
  })

  test('holds a shared list open while the reader signs in behind it', async ({ page }) => {
    // The list is readable either way, so only who asked for it changes
    const searches = await stubProblemSearch(page, () => null)

    // Open the shared list with nobody signed in
    await page.goto(`${PROBLEMS_PATH}?list=${SHARED_LIST_ID}`)

    // Wait for it to open, so the sign-in below lands on a settled page
    await expect.poll(() => searches().length, { timeout: SETTLE_TIMEOUT_MS }).toBeGreaterThan(0)

    // The reader signs in without leaving the list
    await signInTestUser(page)

    // The list is asked for again, this time as somebody
    await expect
      .poll(
        () =>
          searches().some(
            (call) => call.isAuthenticated && call.query.listContentId === SHARED_LIST_ID
          ),
        { timeout: SETTLE_TIMEOUT_MS }
      )
      .toBe(true)

    // And the reader is still on the list they were reading, not back at the library
    await expect(page).toHaveURL(`${PROBLEMS_PATH}?list=${SHARED_LIST_ID}`)
  })

  test('keeps the rest of the search when the list has been deleted', async ({ page }) => {
    // Everything the reader is told from here
    const notices = await recordNotices(page)

    // A list nothing answers to, whoever asks. Only the search naming it is refused, so the library
    // left behind can actually load rather than failing the same way forever.
    await stubProblemSearch(page, (call) =>
      call.query.listContentId === DELETED_LIST_ID ? 'ListNotFound' : null
    )

    // Open it, with a search of the reader's own alongside
    await page.goto(`${PROBLEMS_PATH}?${KEPT_FILTER.param}&list=${DELETED_LIST_ID}`)

    // The dead filter comes out of the URL rather than sitting there failing
    await expect
      .poll(() => filtersInUrl(page).get('list'), { timeout: SETTLE_TIMEOUT_MS })
      .toBeNull()

    // And nothing else goes with it
    expect(filtersInUrl(page).get(KEPT_FILTER.key)).toBe(KEPT_FILTER.value)

    // Let anything else that moment raised reach the screen
    await page.waitForTimeout(QUIET_MS)

    // The reader is told the list is gone, which no amount of retrying would change. Once: taking
    // the filter out of the URL brings the same failure round again, and a reader told twice about
    // one dead list reads as two things having gone wrong.
    expect(notices().filter((notice) => notice === errorsCopy.listNotFound)).toHaveLength(1)
  })

  test('offers the account a URL asking for favorites needs, without moving the reader', async ({
    page,
  }) => {
    // Everything the reader is told from here
    const notices = await recordNotices(page)

    // Favorites are refused before they are asked for, so the rule here never gets a say
    await stubProblemSearch(page, () => null)

    // Ask for the reader's own favorites with nobody signed in, alongside a search anyone may have
    await page.goto(`${PROBLEMS_PATH}?${KEPT_FILTER.param}&favoritesOnly=true`)

    // The filter nobody can have comes out of the URL rather than sitting there unapplied
    await expect
      .poll(() => filtersInUrl(page).get('favoritesOnly'), { timeout: SETTLE_TIMEOUT_MS })
      .toBeNull()

    // The one anybody may have stays
    expect(filtersInUrl(page).get(KEPT_FILTER.key)).toBe(KEPT_FILTER.value)

    // And the reader is left reading, rather than thrown onto a page they never asked for
    await expect(page).toHaveURL(/\/en\/problems/)

    // Let the notice reach the screen
    await page.waitForTimeout(QUIET_MS)

    // They are told what the filter needs, once. Taking it out of the URL brings the reading round
    // again, and a reader told twice reads it as two things having gone wrong.
    const offer = loginPromptFor(filtersCopy.viewFavoritesAuthReason)
    expect(notices().filter((notice) => notice === offer)).toHaveLength(1)

    // Taking the offer up
    await page.getByRole('button', { name: signInCopy.login }).click()

    // Leads to signing in
    await expect(page).toHaveURL(/\/en\/sign-in\?/)

    // Carrying the filter they asked for, so signing in lands them on it
    expect(new URL(page.url()).searchParams.get('returnUrl')).toContain('favoritesOnly=true')
  })

  test('asks for no account over a favorites filter the URL already threw away', async ({
    page,
  }) => {
    // Everything the reader is told from here
    const notices = await recordNotices(page)

    // Nothing should reach the rule here either
    const searches = await stubProblemSearch(page, () => null)

    // A URL naming favorites beside a key the library does not know. The unknown key costs the
    // whole URL, favorites included, so by the time anyone is weighed there is no filter left to
    // refuse — and a reader sent to sign in for one would be signing in for nothing.
    await page.goto(`${PROBLEMS_PATH}?favoritesOnly=true&bogus=1`)

    // They are told the URL was not applied
    await expect
      .poll(() => notices(), { timeout: SETTLE_TIMEOUT_MS })
      .toContain(errorsCopy.urlFiltersIgnored)

    // Let anything else that moment raised reach the screen
    await page.waitForTimeout(QUIET_MS)

    // And nothing offers them an account for a filter that was already gone
    expect(notices()).not.toContain(loginPromptFor(filtersCopy.viewFavoritesAuthReason))

    // Nor is the offer taken on their behalf, which is the older shape of the same mistake
    await expect(page).toHaveURL(/\/en\/problems/)

    // The library they get is the whole one, since none of that URL survived
    expect(searches().every((call) => !call.query.favoritesOnly)).toBe(true)
  })

  test('keeps the rest of the search when a session ends under favorites', async ({ page }) => {
    // Everything the reader is told from here
    const notices = await recordNotices(page)

    // Clerk's client only exists once a page of the app has booted
    await page.goto('/')

    // A session of this test's own, which is the one it is about to end
    await signInTestUser(page)

    // Favorites belong to whoever asked for them, and nobody is who nobody's are
    const searches = await stubProblemSearch(page, (call) =>
      call.query.favoritesOnly && !call.isAuthenticated ? 'FavoritesRequireAuthentication' : null
    )

    // Read the reader's own favorites, with a search of their own narrowing them
    await page.goto(`${PROBLEMS_PATH}?${KEPT_FILTER.param}&favoritesOnly=true`)

    // The filter takes hold on a search that carried the reader with it
    await expect
      .poll(() => searches().some((call) => call.query.favoritesOnly && call.isAuthenticated), {
        timeout: SETTLE_TIMEOUT_MS,
      })
      .toBe(true)

    // How much traffic had gone out by the time the session ended
    const sentBefore = searches().length

    // The session ends underneath them
    await endSessionInPlace(page)

    // Favorites stop being anybody's, so they come out of the URL
    await expect
      .poll(() => filtersInUrl(page).get('favoritesOnly'), { timeout: SETTLE_TIMEOUT_MS })
      .toBeNull()

    // Their own search outlives them
    expect(filtersInUrl(page).get(KEPT_FILTER.key)).toBe(KEPT_FILTER.value)

    // And the reader is left reading rather than sent off mid-page
    await expect(page).toHaveURL(/\/en\/problems/)

    // Nothing was spent asking for favorites that had stopped being anybody's
    expect(sentSince(searches(), sentBefore).some((call) => call.query.favoritesOnly)).toBe(false)

    // Let the notice reach the screen
    await page.waitForTimeout(QUIET_MS)

    // And the way back is offered rather than taken on their behalf
    expect(notices()).toContain(loginPromptFor(filtersCopy.viewFavoritesAuthReason))
  })

  test('asks a signed-out reader picking favorites to sign in, rather than applying it', async ({
    page,
  }) => {
    // Nothing should reach the rule here, since the pick is refused in front of it
    const searches = await stubProblemSearch(page, () => null)

    // Open the library with nobody signed in
    await page.goto(PROBLEMS_PATH)

    // Open the control that picks which body of problems is showing
    await page
      .getByRole('button', { name: filtersCopy.allProblems, exact: true })
      .click({ timeout: SETTLE_TIMEOUT_MS })

    // Reach for favorites
    await page.getByRole('dialog').getByRole('button', { name: filtersCopy.myFavorites }).click()

    // The reader is asked to sign in, and told what for
    await expect(page.getByText(loginPromptFor(filtersCopy.viewFavoritesAuthReason))).toBeVisible()

    // The filter was never applied, so the URL still says what the reader is actually looking at
    await expect(page).toHaveURL(PROBLEMS_PATH)

    // Let a search the pick might have spent go out
    await page.waitForTimeout(QUIET_MS)

    // Nothing was spent on one that could only have been refused
    expect(searches().some((call) => call.query.favoritesOnly)).toBe(false)

    // Take the prompt up on its offer
    await page.getByRole('button', { name: signInCopy.login }).click()

    // Which leads to signing in
    await expect(page).toHaveURL(/\/en\/sign-in\?/)

    // Carrying the filter they were reaching for, so signing in lands them on it
    expect(new URL(page.url()).searchParams.get('returnUrl')).toContain('favoritesOnly=true')
  })

  test('offers the account a URL asking for marks needs, without moving the reader', async ({
    page,
  }) => {
    // Everything the reader is told from here
    const notices = await recordNotices(page)

    // Mark status is a reader's own, and nobody's marks are nobody's business
    const searches = await stubProblemSearch(page, (call) =>
      call.query.markStatus !== null && !call.isAuthenticated
        ? 'MarkStatusRequiresAuthentication'
        : null
    )

    // Ask for marked problems with nobody signed in, alongside a search anyone may have
    await page.goto(`${PROBLEMS_PATH}?${KEPT_FILTER.param}&markStatus=marked`)

    // The filter nobody can have comes out of the URL rather than sitting there claiming to be on
    await expect
      .poll(() => filtersInUrl(page).get('markStatus'), { timeout: SETTLE_TIMEOUT_MS })
      .toBeNull()

    // The one anybody may have stays
    expect(filtersInUrl(page).get(KEPT_FILTER.key)).toBe(KEPT_FILTER.value)

    // And the reader is left reading, rather than thrown onto a page they never asked for
    await expect(page).toHaveURL(/\/en\/problems/)

    // Let anything else the page still owed go out
    await page.waitForTimeout(QUIET_MS)

    // Nothing was ever asked of the backend that it would have had to refuse
    expect(searches().every((call) => call.query.markStatus === null)).toBe(true)

    // And the reader is told what the filter needs rather than left to wonder where it went
    expect(notices()).toContain(loginPromptFor(filtersCopy.markStatusAuthReason))
  })

  test('keeps the rest of the search when a session ends under the mark filter', async ({
    page,
  }) => {
    // Everything the reader is told from here
    const notices = await recordNotices(page)

    // Clerk's client only exists once a page of the app has booted
    await page.goto('/')

    // A session of this test's own, which is the one it is about to end
    await signInTestUser(page)

    // Marks belong to whoever made them, and nobody has made none
    const searches = await stubProblemSearch(page, (call) =>
      call.query.markStatus !== null && !call.isAuthenticated
        ? 'MarkStatusRequiresAuthentication'
        : null
    )

    // Read the reader's own marked problems, with a search of their own narrowing them
    await page.goto(`${PROBLEMS_PATH}?${KEPT_FILTER.param}&markStatus=marked`)

    // The filter takes hold on a search that carried the reader with it
    await expect
      .poll(
        () => searches().some((call) => call.query.markStatus === 'marked' && call.isAuthenticated),
        { timeout: SETTLE_TIMEOUT_MS }
      )
      .toBe(true)

    // How much traffic had gone out by the time the session ended
    const sentBefore = searches().length

    // The session ends underneath them
    await endSessionInPlace(page)

    // Marks stop being anybody's, so they come out of the URL
    await expect
      .poll(() => filtersInUrl(page).get('markStatus'), { timeout: SETTLE_TIMEOUT_MS })
      .toBeNull()

    // Their own search outlives them
    expect(filtersInUrl(page).get(KEPT_FILTER.key)).toBe(KEPT_FILTER.value)

    // And the reader is left reading, rather than sent off to sign in for what they just lost
    await expect(page).toHaveURL(/\/en\/problems/)

    // The library asks again, now that who is reading has changed
    await expect
      .poll(() => sentSince(searches(), sentBefore).length, { timeout: SETTLE_TIMEOUT_MS })
      .toBeGreaterThan(0)

    // And what it asks for no longer includes anybody's marks
    expect(sentSince(searches(), sentBefore).every((call) => call.query.markStatus === null)).toBe(
      true
    )

    // Let the notice reach the screen
    await page.waitForTimeout(QUIET_MS)

    // And the way back is offered rather than taken on their behalf
    expect(notices()).toContain(loginPromptFor(filtersCopy.markStatusAuthReason))
  })

  test('asks a signed-out reader picking a mark status to sign in, rather than applying it', async ({
    page,
  }) => {
    // Nothing should reach the rule here, since the pick is refused in front of it
    const searches = await stubProblemSearch(page, () => null)

    // Open the library with nobody signed in
    await page.goto(PROBLEMS_PATH)

    // Open the control that picks which marks are showing
    await page
      .getByRole('button', { name: filtersCopy.markStatus, exact: true })
      .click({ timeout: SETTLE_TIMEOUT_MS })

    // Reach for the problems the reader has marked
    await page.getByRole('menuitem', { name: filtersCopy.markStatusMarked, exact: true }).click()

    // The reader is asked to sign in, and told what for, instead of watching the filter undo itself
    await expect(page.getByText(loginPromptFor(filtersCopy.markStatusAuthReason))).toBeVisible()

    // The filter was never applied, so the URL is not left claiming one that is not in force
    await expect(page).toHaveURL(PROBLEMS_PATH)

    // Let a search the pick might have spent go out
    await page.waitForTimeout(QUIET_MS)

    // Nothing was spent on one that could only have been refused
    expect(searches().some((call) => call.query.markStatus !== null)).toBe(false)

    // Take the prompt up on its offer
    await page.getByRole('button', { name: signInCopy.login }).click()

    // Which leads to signing in
    await expect(page).toHaveURL(/\/en\/sign-in\?/)

    // Carrying the filter they were reaching for, so signing in lands them on it
    expect(new URL(page.url()).searchParams.get('returnUrl')).toContain('markStatus=marked')
  })
})
