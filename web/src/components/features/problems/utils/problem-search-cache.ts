// Editing the searches the library has already been answered, so a problem the reader has just edited
// out of the view leaves the screen without waiting for the archive to be asked again.

import type { InfiniteData, QueryClient } from '@tanstack/react-query'

import { useProblemStore } from '@/stores/problem-store'

import {
  problemQueryKeys,
  type ProblemSearchInfiniteData,
  searchFiltersOf,
} from '../hooks/use-problem-search-query'
import type { Problem } from '../types/problem-api-types'
import type { SearchFiltersState } from '../types/problem-library-types'
import { belongsUnderFilters } from './problem-view-membership'

/** A search as the cache holds it, which is one page per answer the library has scrolled into. */
type SearchData = InfiniteData<ProblemSearchInfiniteData>

/** One search an edit reached: what it held, what it now reads, and whether anyone is looking. */
export type SearchSnapshot = {
  /** The key the search is cached under. */
  key: readonly unknown[]
  /** The pages it held. */
  data: SearchData
  /** The pages the edit left it holding. */
  editedData: SearchData
  /** Whether this is the search a screen is being drawn from, rather than one merely cached. */
  isOnScreen: boolean
}

/** What an edit moved: the searches it took the problem out of, and whether the reader saw it go. */
export type ProblemEditContext = {
  /** Every search the edit took the problem out of, per {@link SearchSnapshot}. */
  hiddenFrom: SearchSnapshot[]
  /** Whether the edit ruled the problem off the screen it was made on. */
  hasLeftView: boolean
}

/**
 * Reads a search's pages back without one problem in them.
 *
 * The total comes down with it. The archive's own word on how many problems a search matches arrives
 * with the next answer, and until it does, a count standing one above the rows beneath it is a
 * screen disagreeing with itself.
 *
 * @param data - The pages as they stand.
 * @param problemSlug - The problem to leave out.
 *
 * @returns The same pages without it, or the very same object when they never named it.
 */
export function withoutProblem(data: SearchData, problemSlug: string): SearchData {
  // A search that never named it has nothing to say about it
  if (!data.pages.some((page) => page.problems.slugs.includes(problemSlug))) return data

  // Every page, each without the problem and each counting one problem fewer, since every page
  // carries the same total and the screen reads it off whichever one it happens to hold
  const pages = data.pages.map((page) => ({
    ...page,
    problems: {
      ...page.problems,
      slugs: page.problems.slugs.filter((slug) => slug !== problemSlug),
      totalCount: page.problems.totalCount - 1,
    },
  }))

  // The search as it now reads
  return { ...data, pages }
}

/**
 * Calls off every answer the archive is still on its way back with.
 *
 * An answer already in flight was asked for before the edit and knows nothing of it, so letting it
 * land writes the problem back onto the screens it has just left. A search that has never been
 * answered is left running: cancelling it hands back nothing to fall back on, which is an empty
 * library rather than a stale one.
 *
 * @param queryClient - The cache the searches are held in.
 *
 * @returns Once every one of them has stopped.
 */
function cancelSearchFetches(queryClient: QueryClient): Promise<void> {
  // Every search that already has pages to fall back on
  return queryClient.cancelQueries({
    queryKey: problemQueryKeys.allSearches(),
    predicate: (query) => query.state.data !== undefined,
  })
}

/**
 * Takes a problem off every screen the edit has stopped it belonging on, and hands back what they
 * held.
 *
 * Each cached search is read against its own filters rather than against the reader's: an edit made
 * on one screen rules the problem off some of the others and leaves the rest untouched. Taking it out
 * of all of them would leave a search nothing marks stale serving a library with a problem missing
 * from it.
 *
 * The problem is read both ways round, and only a screen the edit itself pushed it off is touched. A
 * problem the filters already ruled out beforehand is on screen for a reason they cannot express: a
 * list the reader is reading but does not own is not one the archive names on a problem, so every row
 * of it reads as belonging to no list at all. Filters that cannot account for a row are in no
 * position to take it away.
 *
 * @param queryClient - The cache the searches are held in.
 * @param problemBefore - The problem as it stood before the edit.
 * @param problemAfter - The problem as the edit leaves it.
 *
 * @returns Every search it reached, per {@link SearchSnapshot}.
 */
export function hideProblemFromSearches(
  queryClient: QueryClient,
  problemBefore: Problem,
  problemAfter: Problem
): SearchSnapshot[] {
  // Every search the library has sent, whatever it filtered on
  const searches = queryClient.getQueryCache().findAll({
    queryKey: problemQueryKeys.allSearches(),
  })

  // The ones the edit has taken it off, each with what it holds, read before any of them is touched
  const left = searches.flatMap((search) => {
    // The pages it was answered with, and the filters it asked for them under
    const data = search.state.data as SearchData | undefined
    const filters = searchFiltersOf(search.queryKey)

    // Only a search the edit itself has dropped the problem out of: one still in flight holds
    // nothing to edit, and one the problem never answered to is not this edit's doing
    if (
      data === undefined ||
      !belongsUnderFilters(filters, problemBefore) ||
      belongsUnderFilters(filters, problemAfter)
    ) {
      // Left exactly as it is
      return []
    }

    // What it reads without the problem, which is the very object it already holds when it never
    // named it in the first place
    const editedData = withoutProblem(data, problemAfter.slug)

    // A search the edit leaves exactly as it was is one to walk past: writing to it would still
    // pass for a fresh answer and clear whatever had marked it stale
    if (editedData === data) return []

    // Whether a screen is being drawn from this search, which is what makes its edit one the reader
    // watches happen rather than one they will meet later
    const isOnScreen = search.isActive()

    // What it held, what it now reads, and whether anyone is looking
    return [{ key: search.queryKey, data, editedData, isOnScreen }]
  })

  // Each of them read back without the problem. The cache keeps the write in its own shape rather
  // than the one handed to it, and that shape is what says later whether it still stands.
  return left.map(({ key, data, editedData, isOnScreen }) => ({
    key,
    data,
    editedData: queryClient.setQueryData<SearchData>(key, editedData) ?? editedData,
    isOnScreen,
  }))
}

/**
 * Makes a reader's edit take effect everywhere it shows, before the archive has been told about it.
 *
 * The problem is read on both sides of the edit, since what a screen holds turns on what the edit
 * itself moved rather than on what happens to be true of the problem afterwards.
 *
 * @param queryClient - The cache the searches are held in.
 * @param problemSlug - The problem being edited.
 * @param applyToStore - Writes the edit to the store.
 *
 * @returns What the edit reached, per {@link ProblemEditContext}.
 */
export async function applyProblemEdit(
  queryClient: QueryClient,
  problemSlug: string,
  applyToStore: () => void
): Promise<ProblemEditContext> {
  // The problem as it stood before, which is what tells this edit apart from whatever else was
  // already true of it
  const before = useProblemStore.getState().problems[problemSlug]

  // The edit written to the store, which is where every screen reads the problem from
  applyToStore()

  // No answer already on its way knows about the edit, so none of them may land on top of it
  await cancelSearchFetches(queryClient)

  // The problem as the edit leaves it
  const edited = useProblemStore.getState().problems[problemSlug]

  // A problem the store has never heard of has no screen to leave
  if (before === undefined || edited === undefined) return { hiddenFrom: [], hasLeftView: false }

  // Off every screen the edit has stopped it belonging on, now rather than when the archive is next
  // asked, and what those searches held is what puts it back if this fails
  const hiddenFrom = hideProblemFromSearches(queryClient, before, edited)

  // Whether one of those screens is the one the reader is looking at, which is the only case an undo
  // has anything to offer. Read now, since by the time the archive answers they may have moved on.
  const hasLeftView = hiddenFrom.some((snapshot) => snapshot.isOnScreen)

  // What the edit reached
  return { hiddenFrom, hasLeftView }
}

/**
 * Puts searches back as they were before they were edited, and leaves each of them owing the archive
 * a question.
 *
 * A search the archive has answered again since is left alone. That answer knows everything this one
 * does and a page more, so writing the older pages over it takes back edits that stuck and drops rows
 * the reader has scrolled to.
 *
 * They are marked stale either way, and deliberately not asked again on the spot. A refusal reported
 * to the reader is not proof the edit never landed, so what is on screen has to be re-asked at some
 * point; but the connection that just refused it is the wrong one to ask on, and a refetch failing
 * behind a screen that still holds its rows would report the whole search as broken.
 *
 * @param queryClient - The cache the searches are held in.
 * @param snapshots - What each search held, per {@link SearchSnapshot}.
 */
export function restoreSearches(queryClient: QueryClient, snapshots: SearchSnapshot[]): void {
  // Every search the edit reached
  snapshots.forEach(({ key, data, editedData }) => {
    // Back to the pages it was answered with, unless it has been answered again since
    if (queryClient.getQueryData(key) === editedData) queryClient.setQueryData(key, data)

    // Owing a question, which the next screen drawn from it asks
    queryClient.invalidateQueries({ queryKey: key, exact: true, refetchType: 'none' })
  })
}

/**
 * Marks every search stale whose own filters turn on what has just changed, wherever the reader was
 * when they changed it. A search left alone goes on serving what it was answered with, which is what
 * makes this the difference between a filter that is right when it is next opened and one that is a
 * step behind.
 *
 * @param queryClient - The cache the searches are held in.
 * @param isAffected - Whether a search sent under the given filters is one the change reaches.
 */
export function invalidateAffectedSearches(
  queryClient: QueryClient,
  isAffected: (filters: SearchFiltersState | null) => boolean
): void {
  // Every search the change reaches, whether or not the reader is looking at it
  queryClient.invalidateQueries({
    queryKey: problemQueryKeys.allSearches(),
    predicate: (query) => isAffected(searchFiltersOf(query.queryKey)),
  })
}
