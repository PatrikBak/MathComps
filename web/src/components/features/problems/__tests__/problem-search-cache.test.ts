// Editing the searches the library has already been answered: which of them a reader's own edit
// reaches, what it leaves behind for a rollback, and which of them it makes stale.

import type { InfiniteData } from '@tanstack/react-query'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { problemQueryKeys, type ProblemSearchInfiniteData } from '../hooks/use-problem-search-query'
import { userListQueryKeys } from '../hooks/use-user-lists'
import type { SearchFiltersState } from '../types/problem-library-types'
import {
  hideProblemFromSearches,
  invalidateAffectedSearches,
  restoreSearches,
  withoutProblem,
} from '../utils/problem-search-cache'
import { filtersOnState } from '../utils/problem-view-membership'
import { noFilters, problemWith } from './support/problem-fixtures'

/** The language every search here was sent in. */
const LOCALE = 'en'

/** The reader every search here was sent for. */
const READER = 'reader'

/** The problem the reader edits, which every search below holds. */
const EDITED = 'problem'

/**
 * Builds a search's pages out of the slugs each page carries.
 *
 * @param pages - The slugs, one array per page the library has scrolled into.
 *
 * @returns The search as the cache holds it.
 */
function searchOf(pages: string[][]): InfiniteData<ProblemSearchInfiniteData> {
  // One page per answer, each carrying its slugs and the totals they were counted under
  return {
    pages: pages.map((slugs, index) => ({
      problems: { slugs, page: index + 1, pageSize: 10, totalCount: 42 },
      updatedOptions: null,
      listName: null,
    })),
    pageParams: pages.map((_, index) => index + 1),
  }
}

/**
 * Answers a search and parks the answer in the cache, the way a screen drawn under those filters
 * leaves it there.
 *
 * @param queryClient - The cache to park it in.
 * @param filters - The filters the search was sent under.
 * @param slugs - The problems it came back with.
 *
 * @returns The key it is now held under.
 */
function cacheSearch(
  queryClient: QueryClient,
  filters: SearchFiltersState,
  slugs: string[]
): readonly unknown[] {
  // The key a search under these filters is cached at
  const key = problemQueryKeys.search(LOCALE, filters, READER)

  // Answered with one page of those problems
  queryClient.setQueryData(key, searchOf([slugs]))

  // The key, which is how a case reads the search back
  return key
}

/**
 * Reads back the problems a cached search now names.
 *
 * @param queryClient - The cache holding it.
 * @param key - The key it is held under.
 *
 * @returns The slugs, across every page it holds.
 */
function slugsIn(queryClient: QueryClient, key: readonly unknown[]): string[] {
  // The search as it now stands
  const data = queryClient.getQueryData<InfiniteData<ProblemSearchInfiniteData>>(key)

  // Every page's slugs, run together the way the screen reads them
  return (data?.pages ?? []).flatMap((page) => page.problems.slugs)
}

describe('taking a problem out of a search', () => {
  it('takes it off the page that named it', () => {
    // One page of three problems
    const search = searchOf([['first', 'second', 'third']])

    // The middle one taken out
    const edited = withoutProblem(search, 'second')

    // The page reads without it, in the order it read before
    expect(edited.pages[0].problems.slugs).toEqual(['first', 'third'])
  })

  it('reaches whichever page named it', () => {
    // Three pages, with the problem on the last of them
    const search = searchOf([['first'], ['second'], ['third']])

    // Taken out
    const edited = withoutProblem(search, 'third')

    // The page it was on is the one that moved
    expect(edited.pages.map((page) => page.problems.slugs)).toEqual([['first'], ['second'], []])
  })

  it('counts it out of the total the archive gave', () => {
    // A page of two, counted as part of a much longer search
    const search = searchOf([['first', 'second']])

    // One of them taken out
    const edited = withoutProblem(search, 'first')

    // The count the screen reads has to agree with the rows under it, or the two disagree for as
    // long as the archive takes to answer again
    expect(edited.pages[0].problems.totalCount).toBe(41)
  })

  it('counts it out of every page’s total, not just the page that named it', () => {
    // Two pages scrolled into, with the problem on the second
    const search = searchOf([['first'], ['second']])

    // Taken out
    const edited = withoutProblem(search, 'second')

    // Each page carries the whole search's total, and the screen reads whichever it happens to hold:
    // the header goes off the first, the last page's is what says another page is waiting
    expect(edited.pages.map((page) => page.problems.totalCount)).toEqual([41, 41])
  })

  it('hands back the very same search when it never named the problem', () => {
    // A search about other problems entirely
    const search = searchOf([['first', 'second']])

    // A problem it never held
    const edited = withoutProblem(search, 'stranger')

    // Nothing to edit means nothing to redraw, which the same object says
    expect(edited).toBe(search)
  })
})

describe('taking a problem off the screens it has just left', () => {
  it('takes an unliked problem off the screen of the reader’s own likes', () => {
    // A cache holding the reader's likes, drawn while they still liked it
    const queryClient = new QueryClient()
    const favorites = cacheSearch(queryClient, { ...noFilters, favoritesOnly: true }, [EDITED])

    // The like taken off
    hideProblemFromSearches(
      queryClient,
      problemWith({ slug: EDITED, liked: true }),
      problemWith({ slug: EDITED, liked: false })
    )

    // A screen of what the reader likes is no place for one they have stopped liking
    expect(slugsIn(queryClient, favorites)).toEqual([])
  })

  it('leaves it on the screens that asked nothing about likes', () => {
    // The whole library and one list, both drawn before the reader touched anything
    const queryClient = new QueryClient()
    const everything = cacheSearch(queryClient, noFilters, [EDITED])
    const list = cacheSearch(queryClient, { ...noFilters, listContentId: 'list-a' }, [EDITED])

    // The same like taken off, from wherever the reader happened to be
    hideProblemFromSearches(
      queryClient,
      problemWith({ slug: EDITED, liked: true, listContentIds: ['list-a'] }),
      problemWith({ slug: EDITED, liked: false, listContentIds: ['list-a'] })
    )

    // An unliked problem is still a problem, and still in the list the reader put it in
    expect(slugsIn(queryClient, everything)).toEqual([EDITED])
    expect(slugsIn(queryClient, list)).toEqual([EDITED])
  })

  it('takes a problem the reader has just marked off the screen of unmarked ones', () => {
    // The mark filter read the other way round, drawn while the problem was still unmarked
    const queryClient = new QueryClient()
    const unmarked = cacheSearch(queryClient, { ...noFilters, markStatus: 'unmarked' }, [EDITED])

    // Marked
    hideProblemFromSearches(
      queryClient,
      problemWith({ slug: EDITED, marked: false }),
      problemWith({ slug: EDITED, marked: true })
    )

    // A screen of what the reader has yet to do is no place for one they have just done
    expect(slugsIn(queryClient, unmarked)).toEqual([])
  })

  it('takes a problem dropped from a list off that list’s screen alone', () => {
    // Two of the reader's lists, both drawn while the problem was in both
    const queryClient = new QueryClient()
    const dropped = cacheSearch(queryClient, { ...noFilters, listContentId: 'list-a' }, [EDITED])
    const kept = cacheSearch(queryClient, { ...noFilters, listContentId: 'list-b' }, [EDITED])

    // Taken out of the first of them
    hideProblemFromSearches(
      queryClient,
      problemWith({ slug: EDITED, listContentIds: ['list-a', 'list-b'] }),
      problemWith({ slug: EDITED, listContentIds: ['list-b'] })
    )

    // A list holds what the reader put in it, and this was taken out of one of the two
    expect(slugsIn(queryClient, dropped)).toEqual([])
    expect(slugsIn(queryClient, kept)).toEqual([EDITED])
  })

  it('leaves a shared list holding a problem the reader has just liked', () => {
    // A list someone else shared, which the reader is reading but does not own. The archive names
    // only the reader's own lists on a problem, so every row of this one reads as being in no list.
    const queryClient = new QueryClient()
    const shared = cacheSearch(queryClient, { ...noFilters, listContentId: 'shared-list' }, [
      EDITED,
    ])

    // One of its problems liked, which says nothing at all about any list
    hideProblemFromSearches(
      queryClient,
      problemWith({ slug: EDITED, liked: false, listContentIds: [] }),
      problemWith({ slug: EDITED, liked: true, listContentIds: [] })
    )

    // The row stays. The list filter cannot account for it either way, and a like is no reason to
    // take a problem off a list.
    expect(slugsIn(queryClient, shared)).toEqual([EDITED])
  })

  it('leaves a stale screen stale, when the edit has nothing to say to it', () => {
    // A screen of the reader's likes about other problems entirely, which something else has already
    // marked stale and nothing has refetched
    const queryClient = new QueryClient()
    const favorites = cacheSearch(queryClient, { ...noFilters, favoritesOnly: true }, ['other'])
    queryClient.invalidateQueries({ queryKey: favorites })

    // A problem that screen never named, unliked from somewhere else
    hideProblemFromSearches(
      queryClient,
      problemWith({ slug: EDITED, liked: true }),
      problemWith({ slug: EDITED, liked: false })
    )

    // Writing back pages the edit did not move would still pass for a fresh answer, and the reader
    // would then be served, for as long as an answer stays fresh, the very pages already disowned
    expect(queryClient.getQueryState(favorites)?.isInvalidated).toBe(true)
  })

  it('puts every screen it reached back as it was, when the edit is taken back', () => {
    // Three screens, one of which the edit reaches
    const queryClient = new QueryClient()
    const everything = cacheSearch(queryClient, noFilters, [EDITED, 'other'])
    const favorites = cacheSearch(queryClient, { ...noFilters, favoritesOnly: true }, [EDITED])
    const marked = cacheSearch(queryClient, { ...noFilters, markStatus: 'marked' }, [EDITED])

    // What they held before anything was touched, copied rather than pointed at: the cache hands back
    // the very objects the edit is about to work on, and a comparison against those would hold even
    // if the edit had written straight through them
    const before = [everything, favorites, marked].map((key) =>
      structuredClone(queryClient.getQueryData(key))
    )

    // The like taken off
    const snapshots = hideProblemFromSearches(
      queryClient,
      problemWith({ slug: EDITED, liked: true, marked: true }),
      problemWith({ slug: EDITED, liked: false, marked: true })
    )

    // And the archive turning the whole thing down
    restoreSearches(queryClient, snapshots)

    // Every screen reads as it did, down to the totals, since the reader's edit never stuck
    expect([everything, favorites, marked].map((key) => queryClient.getQueryData(key))).toEqual(
      before
    )
  })

  it('leaves a screen the archive has answered again alone', () => {
    // A screen of the reader's likes, holding the problem they are about to edit
    const queryClient = new QueryClient()
    const favorites = cacheSearch(queryClient, { ...noFilters, favoritesOnly: true }, [EDITED])

    // The like taken off, which takes the row out of the pages the screen holds
    const snapshots = hideProblemFromSearches(
      queryClient,
      problemWith({ slug: EDITED, liked: true }),
      problemWith({ slug: EDITED, liked: false })
    )

    // The archive answering that same search again while the first edit is still in flight, which is
    // what a second edit landing sets off
    queryClient.setQueryData(favorites, searchOf([['later']]))

    // And only then the first edit being turned down
    restoreSearches(queryClient, snapshots)

    // The newer answer stands. It knows everything the snapshot knew and whatever happened since, so
    // writing the older pages back over it would put back rows that have gone for good.
    expect(slugsIn(queryClient, favorites)).toEqual(['later'])
  })

  it('leaves every screen it put back owing the archive a question', () => {
    // A screen of the reader's likes, holding the problem they are about to edit
    const queryClient = new QueryClient()
    const favorites = cacheSearch(queryClient, { ...noFilters, favoritesOnly: true }, [EDITED])

    // The like taken off
    const snapshots = hideProblemFromSearches(
      queryClient,
      problemWith({ slug: EDITED, liked: true }),
      problemWith({ slug: EDITED, liked: false })
    )

    // And the archive turning it down
    restoreSearches(queryClient, snapshots)

    // A refusal reaching the reader is not proof the edit never landed, so the pages put back are
    // not to be served as though the archive had just vouched for them
    expect(queryClient.getQueryState(favorites)?.isInvalidated).toBe(true)
  })
})

describe('marking the searches a change reaches as stale', () => {
  it('marks the ones narrowed by what changed', () => {
    // A screen of the reader's likes, answered a moment ago
    const queryClient = new QueryClient()
    const favorites = cacheSearch(queryClient, { ...noFilters, favoritesOnly: true }, [EDITED])

    // A like moved, wherever the reader was standing when they moved it
    invalidateAffectedSearches(queryClient, (filters) => filtersOnState(filters, 'liked'))

    // It may not go on serving what it holds, or the filter answers a step behind
    expect(queryClient.getQueryState(favorites)?.isInvalidated).toBe(true)
  })

  it('leaves the ones the change cannot reach alone', () => {
    // The whole library, which a like narrows nothing of
    const queryClient = new QueryClient()
    const everything = cacheSearch(queryClient, noFilters, [EDITED])

    // The same like
    invalidateAffectedSearches(queryClient, (filters) => filtersOnState(filters, 'liked'))

    // Asking the archive again would earn the very same answer
    expect(queryClient.getQueryState(everything)?.isInvalidated).toBe(false)
  })

  it('never takes a query that is not a search for one', () => {
    // The reader's own lists, which are cached nowhere near a search
    const queryClient = new QueryClient()
    queryClient.setQueryData(userListQueryKeys.lists(READER), { likedCount: 1, lists: [] })

    // A change reaching every search there is
    invalidateAffectedSearches(queryClient, () => true)

    // And no other query at all
    expect(queryClient.getQueryState(userListQueryKeys.lists(READER))?.isInvalidated).toBe(false)
  })
})
