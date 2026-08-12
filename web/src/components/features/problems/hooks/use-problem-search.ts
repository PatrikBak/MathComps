'use client'

import { useAuth } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { useLoginRedirect } from '@/hooks/use-login-redirect'
import { ROUTES } from '@/i18n/i18n'
import { useRouter } from '@/i18n/navigation'
import { errorCodeOf } from '@/lib/api/api-error'
import type { QueryUiState } from '@/lib/query-ui-state'
import { useProblemStore } from '@/stores/problem-store'

import { ACTIVE_FILTERS_CONSTANTS } from '../constants/filter-constants'
import { SEARCH_TIMING } from '../constants/timing-constants'
import { getProblemsPageUrl, hasProblemId } from '../services/problem-routes'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { buildContestTree } from '../utils/contest-tree'
import { countActiveFilters } from '../utils/filter-validation'
import { isNoOpFilterChange, isTextOnlyChange } from '../utils/search-logic'
import { serializeFilters } from '../utils/search-url-serialization'
import { initializeFiltersFromUrlOrDefaults } from '../utils/url-initialization'
import {
  useInitialFilterData,
  useProblemSearchQuery,
  useSingleProblem,
} from './use-problem-search-query'

/**
 * The problem search state: loading flags, active filters, and the current result page.
 */
type ProblemSearchState = {
  /** Whether a search is happening in the background (e.g., while typing or filtering). */
  isActiveSearchFetching: boolean
  /** Whether a search with genuinely new filters is in progress (first fetch, no cached data). */
  isBlankSlateLoading: boolean
  /** Whether more results are being loaded (infinite scroll). */
  isPaginationLoading: boolean

  /** The current active filters. */
  filters: SearchFiltersState | null
  /** The available options for filtering. */
  filterOptions: FilterOptionsWithCounts | null
  /** Every option the library can ever offer, whatever is filtered. */
  baseOptions: FilterOptionsWithCounts | null

  /** The list of problem slugs currently displayed. */
  problems: string[]
  /** The total number of problems matching the current criteria. */
  totalCount: number
  /** Whether there are more pages of results available. */
  hasMore: boolean

  /** The state of the filter-options fetch, which the page cannot render without. */
  pageState: QueryUiState
  /** The state of the result fetch. */
  searchState: QueryUiState
  /** When filtering by a list, the display name of that list. Null otherwise. */
  listName: string | null
}

/**
 * The return type of the {@link useProblemSearch} hook.
 * Encapsulates the entire state and actions available for the problem search feature.
 */
type UseProblemSearchReturn = {
  /** The current state of the problem search, including loading status, filters, and data. */
  state: ProblemSearchState
  /** Handler for updating the search filters. */
  handleFiltersChange: (newFilters: SearchFiltersState) => void
  /** Runs the page's own fetch again after it failed. */
  retryPage: () => void
  /** Runs the result fetch again after it failed. */
  retrySearch: () => void
  /** Handler to load more results (infinite scroll). */
  loadMore: () => void
}

/**
 * Drives the problem library: the filters the URL holds, the results or the single problem they
 * ask for, and the notices a failed fetch calls for.
 *
 * @returns The state and handlers described by {@link UseProblemSearchReturn}.
 */
export const useProblemSearch = (): UseProblemSearchReturn => {
  // Translations for the problems section
  const tProblems = useTranslations('problems')

  // Translations for problem-related errors
  const tErrors = useTranslations('problems.errors')

  // Translations for the shared action labels
  const tActions = useTranslations('ui.actions')

  // The router the URL is rewritten through
  const router = useRouter()

  // The URL's query parameters, which is where the filters live
  const searchParams = useSearchParams()

  // A function which marks the update handed to it as low priority
  const [, startTransition] = useTransition()

  // The problem the URL singles out, null while the library is being browsed
  const problemId = hasProblemId(searchParams) ? searchParams.get('id') : null

  // Who is signed in, and whether that is settled yet
  const { userId, isLoaded: isUserDataLoaded } = useAuth()

  // A function which sends the reader off to sign in
  const { redirectToLogin } = useLoginRedirect()

  // The signed-in user's id, null while auth is unsettled or nobody is signed in
  const signedInUserId = isUserDataLoaded ? (userId ?? null) : null

  // The locale the library reads in
  const locale = useLocale()

  // The fetch of every option the library offers, each counted across the whole library
  const initialDataQuery = useInitialFilterData(locale, signedInUserId, isUserDataLoaded)

  // Every option the library can ever offer, once they have arrived
  const baseOptions = initialDataQuery.data?.updatedOptions ?? null

  // The fetch of the problem the URL singles out, held until auth settles because a problem
  // carries whether the reader liked it
  const singleProblemQuery = useSingleProblem(
    locale,
    problemId,
    signedInUserId,
    !!problemId && isUserDataLoaded
  )

  // The filters as read off the URL, the one place they are kept
  const urlParsingResult = useMemo(() => {
    // A contest path can only be resolved once the taxonomy has arrived
    if (!baseOptions) return null

    // Single problem view doesn't use URL filters
    if (problemId) return null

    // Each contest path resolved against the taxonomy it was written for
    return initializeFiltersFromUrlOrDefaults(
      searchParams,
      buildContestTree(baseOptions.competitions, baseOptions.competitions)
    )
  }, [searchParams, baseOptions, problemId])

  // The filters the URL asked for
  const urlFilters = urlParsingResult?.filters ?? null

  // Say so when the URL asked for filters that could not be honoured
  useEffect(() => {
    // The URL has yet to be read
    if (!urlParsingResult) return

    // The URL could not be read, so the defaults took over
    if (urlParsingResult.hasInvalidParams) {
      // Warn that the URL's filters were dropped
      toast.warning(tErrors('urlFiltersIgnored'))
    }
    // The URL named more filters than are allowed
    else if (urlParsingResult.hasTooManyFilters) {
      // Warn that the limit is what dropped them
      toast.warning(tErrors('urlTooManyFilters', { max: ACTIVE_FILTERS_CONSTANTS.maxFilterLimit }))
    }
  }, [urlParsingResult, tErrors])

  // Favorites are a reader's own, so asking for them signed out means signing in first
  useEffect(() => {
    // Nothing to do until the URL asks for favorites
    if (!urlParsingResult?.favoritesRequested) return

    // Whether anyone is signed in is not known until auth settles
    if (!isUserDataLoaded) return

    // Nobody is signed in
    if (!userId) {
      // Send the reader to sign in
      redirectToLogin()
    }
  }, [urlParsingResult?.favoritesRequested, isUserDataLoaded, userId, redirectToLogin])

  // The filters the results are fetched for, which lag what the reader is typing
  const [queryFilters, setQueryFilters] = useState<SearchFiltersState | null>(null)

  // The filters the last sync ran on
  const prevUrlFiltersRef = useRef<SearchFiltersState | null>(null)

  // Carry a filter change through to the fetch, letting typing settle first
  useEffect(() => {
    // Nothing has been read off the URL yet
    if (!urlFilters) {
      // Drop whatever was being fetched for
      setQueryFilters(null)
      prevUrlFiltersRef.current = null
      return
    }

    // The first filters to arrive have nothing to be compared against
    if (!prevUrlFiltersRef.current) {
      // Fetch for them at once
      setQueryFilters(urlFilters)
      prevUrlFiltersRef.current = urlFilters
      return
    }

    // A change that cannot produce different results, such as flipping OR↔AND on a single value
    if (isNoOpFilterChange(prevUrlFiltersRef.current, urlFilters)) {
      // Remember it without spending a fetch on it
      prevUrlFiltersRef.current = urlFilters
      return
    }

    // Only the search text moved
    if (isTextOnlyChange(prevUrlFiltersRef.current, urlFilters)) {
      // Let the typing settle before fetching for it
      const timer = setTimeout(() => {
        setQueryFilters(urlFilters)
        prevUrlFiltersRef.current = urlFilters
      }, SEARCH_TIMING.textDebounceMs)

      // Another keystroke calls the pending fetch off
      return () => clearTimeout(timer)
    }
    // A value picked deliberately
    else {
      // Fetch for it at once
      setQueryFilters(urlFilters)
      prevUrlFiltersRef.current = urlFilters
    }
  }, [urlFilters])

  // The fetch of the problems the filters ask for. It waits on the options, the filters and the
  // reader all being known, and stands down entirely when the URL singles out one problem.
  const searchQuery = useProblemSearchQuery(
    locale,
    queryFilters,
    signedInUserId,
    !problemId &&
      queryFilters !== null &&
      initialDataQuery.uiState.kind !== 'loading' &&
      isUserDataLoaded
  )

  // The filters as the reader sees them, moving the moment they click, ahead of the URL catching up
  const [localFilters, setLocalFilters] = useState<SearchFiltersState | null>(null)

  // A URL arriving from elsewhere, such as the back button or a shared link, takes the filters over
  useEffect(() => {
    setLocalFilters(urlFilters)
  }, [urlFilters])

  // A function which records a filter change: the reader sees it at once, the URL catches up after
  const handleFiltersChange = useCallback(
    (newFilters: SearchFiltersState) => {
      // How many filters the change would leave active
      const filterCount = countActiveFilters(newFilters)

      // More filters than the limit allows
      if (filterCount > ACTIVE_FILTERS_CONSTANTS.maxFilterLimit) {
        // Say the limit out loud and leave the filters as they were
        toast.warning(
          tErrors('maxFiltersExceeded', { max: ACTIVE_FILTERS_CONSTANTS.maxFilterLimit })
        )
        return
      }

      // Show the change at once, ahead of the URL
      setLocalFilters(newFilters)

      // Write the change to the URL without holding up what the reader is doing
      startTransition(() => {
        // The filters as the URL spells them
        const queryString = serializeFilters(newFilters)

        // The problems page carrying them
        const url = getProblemsPageUrl(queryString)

        // Swap it in without moving the page
        router.replace(url, { scroll: false })
      })
    },
    [router, tErrors]
  )

  // The filters the reader sees
  const displayFilters = useMemo((): SearchFiltersState | null => {
    // A single problem carries the filters that resolve to exactly it
    if (problemId) return singleProblemQuery.data?.filters ?? null

    // Otherwise whatever the reader last picked
    return localFilters
  }, [problemId, singleProblemQuery.data?.filters, localFilters])

  // Sync filters to global store
  useEffect(() => {
    useProblemStore.getState().setCurrentFilters(displayFilters)
  }, [displayFilters])

  // A problem asked for by ID that turns out not to exist is worth saying out loud, because the
  // answer is to leave the page rather than to try again. Every other failure keeps the reader here,
  // where the page itself explains it.
  useEffect(() => {
    // The state the single-problem fetch settled into
    const singleProblemState = singleProblemQuery.uiState

    // Only a failure while the URL singles out a problem is this effect's business
    if (singleProblemState.kind !== 'failed' || !problemId) return

    // Only a missing problem is handled here
    if (errorCodeOf(singleProblemState.error) !== 'ProblemNotFound') return

    // How much of a slug a notice can carry
    const maxIdLength = 20

    // The slug, cut short when it runs past that
    const truncatedId =
      problemId.length > maxIdLength ? `${problemId.slice(0, maxIdLength)}...` : problemId

    // Name the problem that is gone
    toast.error(tErrors('problemNotFound', { problemId: truncatedId }))

    // Return to the list it should have been in
    router.replace(ROUTES.PROBLEMS, { scroll: false })
  }, [problemId, singleProblemQuery.uiState, router, tErrors])

  // A function which runs the search again
  const retrySearch = searchQuery.retry

  // Which state the search is in
  const searchStateKind = searchQuery.uiState.kind

  // Whether the reader has rows in front of them
  const hasVisibleResults = searchQuery.problems.length > 0

  // Speak up about a search that is struggling underneath results the reader is already reading,
  // since nothing about those results shows it. The notice carries the way to try again too: it
  // floats above the page, so unlike anything in the list it cannot be scrolled away from, and it
  // names the cause where the list names the consequence.
  useEffect(() => {
    // The single problem view has its own error handling, and a boot that never got its filter
    // options is covered by the page-level state
    if (problemId || initialDataQuery.uiState.kind !== 'ready') return undefined

    // A request genuinely is in flight after an earlier attempt failed
    if (searchStateKind === 'retrying') {
      // Tell the reader the connection is being worked on
      const toastId = toast.loading(tErrors('connectionProblem'), { duration: Infinity })

      // Drop the notice the moment the search stops trying
      return () => {
        toast.dismiss(toastId)
      }
    }

    // The attempts are spent, and the results on screen give no hint that they stop early
    if (searchStateKind === 'failed' && hasVisibleResults) {
      // Tell the reader the results stop here, and offer to run the search again
      const toastId = toast.error(tProblems('connectionFailed'), {
        duration: Infinity,
        action: { label: tActions('retry'), onClick: () => retrySearch() },
      })

      // Drop the notice once the search leaves its failure behind
      return () => {
        toast.dismiss(toastId)
      }
    }

    // Nothing went up, so there is nothing to take back down
    return undefined
  }, [
    problemId,
    initialDataQuery.uiState,
    searchStateKind,
    hasVisibleResults,
    retrySearch,
    tActions,
    tErrors,
    tProblems,
  ])

  // Handle a settled search error: an auth-gated filter needs a login, a bad list clears its URL param.
  useEffect(() => {
    // The state the search settled into
    const searchState = searchQuery.uiState

    // Only a failure is this effect's business
    if (searchState.kind !== 'failed') return

    // The failure code, if any
    const errorCode = errorCodeOf(searchState.error)

    // An auth-gated filter (favorites, mark status) reached the backend without a signed-in reader
    if (
      errorCode === 'FavoritesRequireAuthentication' ||
      errorCode === 'MarkStatusRequiresAuthentication'
    ) {
      // Signing in is what makes such a filter mean anything
      redirectToLogin()
      return
    }

    // A list the URL names that no longer exists
    if (errorCode === 'ListNotFound') {
      // Say the list is gone
      toast.error(tErrors('listNotFound'))
    }
    // A list this reader may not read, which only the backend can tell, since a list is shareable
    // and the URL alone says nothing about who may open it
    else if (errorCode === 'ListAccessDenied') {
      // Say the list is not theirs to read
      toast.error(tErrors('listAccessDenied'))
    }
    // Any other failure
    else {
      // The page itself explains it, so nothing to do here
      return
    }

    // Back to the library, which takes the bad list out of the URL
    router.replace(ROUTES.PROBLEMS, { scroll: false })
  }, [searchQuery.uiState, router, redirectToLogin, tErrors])

  // The options to pick from: a single problem's own, otherwise the counts the current results
  // leave behind, otherwise the whole library's
  const filterOptions = singleProblemQuery.data?.options ?? searchQuery.filterOptions ?? baseOptions

  // No view renders without the filter options, and the single-problem view needs that problem on
  // top. Whichever is still missing is what the page's state is about, and what retrying it runs.
  // Because the problem is only reached once the options are ready, a ready page means both are.
  const needsSingleProblem = problemId !== null && initialDataQuery.uiState.kind === 'ready'
  const pageState = needsSingleProblem ? singleProblemQuery.uiState : initialDataQuery.uiState

  // Are we waiting on a search with nothing on screen yet?
  const isBlankSlateLoading = !problemId && searchQuery.isPending

  // Is any search running at all?
  const isActiveSearchFetching = !problemId && searchQuery.isFetching

  // Are we loading more pages?
  const isPaginationLoading = !problemId && searchQuery.isFetchingNextPage

  // The problems the last search put on screen
  const displayedProblems = useProblemStore((state) => state.displayedProblems)

  // The problems on screen: the one the URL names, or whatever the search returned
  const problems = problemId ? [problemId] : displayedProblems

  // How many problems match, which the problem the URL names answers on its own
  const totalCount = problemId ? 1 : searchQuery.totalCount

  // Whether another page can be scrolled into, which a single problem never has
  const hasMore = problemId ? false : searchQuery.hasMore

  // Everything the library renders from, and the handlers it acts through
  return {
    state: {
      isActiveSearchFetching,
      isBlankSlateLoading,
      isPaginationLoading,
      filters: displayFilters,
      filterOptions,
      baseOptions,
      problems,
      totalCount,
      hasMore,
      pageState,
      searchState: searchQuery.uiState,
      listName: searchQuery.listName,
    },
    handleFiltersChange,
    retryPage: needsSingleProblem ? singleProblemQuery.retry : initialDataQuery.retry,
    retrySearch,
    loadMore: searchQuery.loadMore,
  }
}
