'use client'

import { useAuth } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { ROUTES } from '@/i18n/i18n'
import { useRouter } from '@/i18n/navigation'
import { errorCodeOf } from '@/lib/api/api-error'
import type { QueryUiState } from '@/lib/query-ui-state'

import { ACTIVE_FILTERS_CONSTANTS } from '../constants/filter-constants'
import { SEARCH_TIMING } from '../constants/timing-constants'
import { getProblemsPageUrl, hasProblemId } from '../services/problem-routes'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { buildCompetitionTree } from '../utils/competition-tree'
import { countActiveFilters } from '../utils/filter-validation'
import { isNoOpFilterChange, isTextOnlyChange } from '../utils/search-logic'
import { serializeFilters, spellTheSameUrl } from '../utils/search-url-serialization'
import {
  createDefaultFilters,
  initializeFiltersFromUrlOrDefaults,
  namesOnlyKnownCompetitions,
} from '../utils/url-initialization'
import { useBaseOptions, useProblemSearchQuery, useSingleProblem } from './use-problem-search-query'
import { useRefusedFilters } from './use-refused-filters'

/** How much of a slug a notice can carry. */
const MAX_NOTICE_SLUG_LENGTH = 20

/**
 * Refuses the filters that only mean something to a signed-in reader.
 *
 * Favorites and mark status are the reader's own, and the backend refuses both without a session.
 * Weighing the reader here too keeps both the screen and the requests off a filter that cannot hold.
 *
 * @param filters - The filters to hold against who is reading.
 * @param isSignedOut - Whether nobody is signed in.
 *
 * @returns The filters as this reader may have them.
 */
function withoutRefusedFilters(
  filters: SearchFiltersState | null,
  isSignedOut: boolean
): SearchFiltersState | null {
  // There are no filters yet, or the reader is entitled to every one of them
  if (!filters || !isSignedOut) return filters

  // Nobody is signed in, so the filters that only mean something signed in come off
  return { ...filters, favoritesOnly: false, markStatus: null }
}

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

  // Translations for the filter controls
  const tFilters = useTranslations('problems.filters')

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

  // The signed-in user's id, null while auth is unsettled or nobody is signed in
  const signedInUserId = isUserDataLoaded ? (userId ?? null) : null

  // Whether nobody is signed in, which auth still loading cannot yet say
  const isSignedOut = isUserDataLoaded && !userId

  // The locale the library reads in
  const locale = useLocale()

  // Every option the library can ever offer, once the first answer has carried them
  const baseOptions = useBaseOptions(locale) ?? null

  // The fetch of the problem the URL singles out, held until auth settles because a problem
  // carries whether the reader liked it
  const singleProblemQuery = useSingleProblem(
    locale,
    problemId,
    signedInUserId,
    !!problemId && isUserDataLoaded
  )

  // The filters as read off the URL, the one place they are kept. The competitions they name are
  // still unproven: only the taxonomy can say whether they are real, and it rides on the answer this
  // very state is about to ask for.
  const urlParsingResult = useMemo(() => {
    // Single problem view doesn't use URL filters
    if (problemId) return null

    // The URL as filters, taken at its word
    return initializeFiltersFromUrlOrDefaults(searchParams)
  }, [searchParams, problemId])

  // Whether the taxonomy, once it arrived, disowned a competition the URL named
  const namesAGoneCompetition = useMemo(() => {
    // Nothing to hold the URL against until the archive has answered
    if (!baseOptions || !urlParsingResult) return false

    // Every competition the URL named, held against the taxonomy as it stands now
    return !namesOnlyKnownCompetitions(
      urlParsingResult.filters,
      buildCompetitionTree(baseOptions.competitions, baseOptions.competitions)
    )
  }, [baseOptions, urlParsingResult])

  // The filters the URL asked for, which a competition the taxonomy has since dropped costs
  // entirely, and which are held against whoever is reading
  const urlFilters = useMemo(() => {
    // The URL has yet to be read
    if (!urlParsingResult) return null

    // A competition nothing answers to leaves the library on its defaults
    const namedFilters = namesAGoneCompetition ? createDefaultFilters() : urlParsingResult.filters

    // The filters left once the reader has been weighed
    return withoutRefusedFilters(namedFilters, isSignedOut)
  }, [urlParsingResult, namesAGoneCompetition, isSignedOut])

  // Say so when the URL asked for filters that could not be honoured
  useEffect(() => {
    // The URL has yet to be read
    if (!urlParsingResult) return

    // The URL could not be read, or named a competition the taxonomy has since dropped
    if (urlParsingResult.hasInvalidParams || namesAGoneCompetition) {
      // Warn that the URL's filters were dropped
      toast.warning(tErrors('urlFiltersIgnored'))
    }
    // The URL named more filters than are allowed
    else if (urlParsingResult.hasTooManyFilters) {
      // Warn that the limit is what dropped them
      toast.warning(tErrors('urlTooManyFilters', { max: ACTIVE_FILTERS_CONSTANTS.maxFilterLimit }))
    }
  }, [urlParsingResult, namesAGoneCompetition, tErrors])

  // A function which answers a filter this reader turns out not to be able to have
  const { dropAndExplain } = useRefusedFilters({
    filtersInForce: urlFilters,
    filtersRequested: urlParsingResult?.filters ?? null,
  })

  // Favorites and mark status are a reader's own, so a URL asking for either without one is asking
  // for something nobody can be given
  useEffect(() => {
    // Nothing to weigh until the URL has been read, and nothing to refuse while somebody is signed
    // in or auth has yet to say whether anybody is
    if (!urlParsingResult || !isSignedOut) return

    // Whether the URL asked for the reader's own likes
    const wantsFavorites = urlParsingResult.filters.favoritesOnly

    // Whether it asked for the problems they have marked
    const wantsMarkStatus = urlParsingResult.filters.markStatus !== null

    // It asked for neither, so there is nothing to refuse
    if (!wantsFavorites && !wantsMarkStatus) return

    // Take them out of the URL and offer the account they need, naming whichever was reached for
    dropAndExplain(
      { favoritesOnly: false, markStatus: null },
      {
        kind: 'sign-in',
        reason: wantsFavorites
          ? tFilters('viewFavoritesAuthReason')
          : tFilters('markStatusAuthReason'),
      }
    )
  }, [urlParsingResult, isSignedOut, dropAndExplain, tFilters])

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

  // The filters the fetch runs on. They sit parked while typing settles, and a session can end in
  // the meantime, so who is reading is weighed against them again.
  const fetchedFilters = useMemo(
    () => withoutRefusedFilters(queryFilters, isSignedOut),
    [queryFilters, isSignedOut]
  )

  // The fetch of the problems the filters ask for. It waits on the options, the filters and the
  // reader all being known, and stands down entirely when the URL singles out one problem.
  const searchQuery = useProblemSearchQuery(
    locale,
    fetchedFilters,
    signedInUserId,
    !problemId && fetchedFilters !== null && isUserDataLoaded
  )

  // The filters as the reader sees them, moving the moment they click, ahead of the URL catching up
  const [localFilters, setLocalFilters] = useState<SearchFiltersState | null>(null)

  // A URL arriving from elsewhere, such as the back button or a shared link, takes the filters over.
  // The one the library's own write put there is only an echo of what is on screen, and a lossy one:
  // it carries the term without the padding the reader is still typing around it, so adopting that
  // would snatch the padding back out of the box.
  useEffect(() => {
    setLocalFilters((current) => {
      // The URL says something the filters on screen do not say already
      if (!urlFilters || !current || !spellTheSameUrl(urlFilters, current)) return urlFilters

      // Otherwise the screen keeps what it has
      return current
    })
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

    // The slug, cut short when it runs past what a notice can carry
    const truncatedId =
      problemId.length > MAX_NOTICE_SLUG_LENGTH
        ? `${problemId.slice(0, MAX_NOTICE_SLUG_LENGTH)}...`
        : problemId

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
    // The single problem view has its own error handling, and a first search that never got the
    // library's options is covered by the page-level state
    if (problemId || !baseOptions) return undefined

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
    baseOptions,
    searchStateKind,
    hasVisibleResults,
    retrySearch,
    tActions,
    tErrors,
    tProblems,
  ])

  // The list the archive last answered for, null while the whole library is showing. A reader the
  // archive has answered is one the backend let in, which is what tells a session ending apart from
  // a list that was never theirs to open.
  const lastReadListRef = useRef<string | null>(null)

  // Remember which list the archive is answering for
  useEffect(() => {
    // Only an answer says anything about what this reader may read
    if (searchQuery.uiState.kind !== 'ready') return

    // The list that answer came back for
    lastReadListRef.current = fetchedFilters?.listContentId ?? null
  }, [searchQuery.uiState.kind, fetchedFilters])

  // The failure already acted on, so the same one is not acted on twice
  const handledFailureRef = useRef<QueryUiState | null>(null)

  // Handle a settled search error, which the archive alone can raise: a filter it will not serve
  // this reader comes out of the URL, and the rest of their search stays where it is.
  useEffect(() => {
    // The state the search settled into
    const searchState = searchQuery.uiState

    // Only a failure is this effect's business
    if (searchState.kind !== 'failed') return

    // The same failure coming round again, which rewriting the URL below is itself enough to cause:
    // acting on it twice would say the same thing to the reader twice
    if (handledFailureRef.current === searchState) return

    // This failure is being acted on now
    handledFailureRef.current = searchState

    // The failure code, if any
    const errorCode = errorCodeOf(searchState.error)

    // Favorites reached the backend without a reader behind them, which only a session lapsing
    // between the library weighing the reader and the request going out can produce
    if (errorCode === 'FavoritesRequireAuthentication') {
      // Take them off and offer the account they need
      dropAndExplain(
        { favoritesOnly: false },
        { kind: 'sign-in', reason: tFilters('viewFavoritesAuthReason') }
      )
    }
    // Mark status, the same way
    else if (errorCode === 'MarkStatusRequiresAuthentication') {
      // Take it off and offer the account it needs
      dropAndExplain(
        { markStatus: null },
        { kind: 'sign-in', reason: tFilters('markStatusAuthReason') }
      )
    }
    // A list the URL names that no longer exists
    else if (errorCode === 'ListNotFound') {
      // Take it off and say it is gone, which no account would bring back
      dropAndExplain({ listContentId: null }, { kind: 'plain', message: tErrors('listNotFound') })
    }
    // A list this reader may not read, which only the backend can tell, since a list is shareable
    // and the URL alone says nothing about who may open it
    else if (errorCode === 'ListAccessDenied') {
      // A list the archive was already answering for is one the reader was reading, so the refusal
      // is their sign-in lapsing rather than a list that was never theirs. Accusing them of opening
      // somebody else's would name something they did not do, and hide what did happen.
      const signInExpired = (fetchedFilters?.listContentId ?? null) === lastReadListRef.current

      // Take the list off, and say which of the two it was
      dropAndExplain(
        { listContentId: null },
        signInExpired
          ? { kind: 'sign-in-message', message: tErrors('listSignInExpired') }
          : { kind: 'plain', message: tErrors('listAccessDenied') }
      )
    }
  }, [searchQuery.uiState, fetchedFilters, dropAndExplain, tErrors, tFilters])

  // The options to pick from: a single problem's own, otherwise the counts the current results
  // leave behind, otherwise the whole library's
  const filterOptions = singleProblemQuery.data?.options ?? searchQuery.filterOptions ?? baseOptions

  // Whether the page is the one the URL singles a problem out for
  const needsSingleProblem = problemId !== null

  // The archive stands on its first search until that search has handed over the library's options
  const archiveState = baseOptions ? { kind: 'ready' as const } : searchQuery.uiState

  // No view renders without the filter options, and each gets them off its own first answer: the
  // archive off its search, the single-problem view off that problem. Whichever answer is still
  // outstanding is what the page's state is about, and what retrying it runs.
  const pageState = needsSingleProblem ? singleProblemQuery.uiState : archiveState

  // Are we waiting on a search with nothing on screen yet?
  const isBlankSlateLoading = !problemId && searchQuery.isPending

  // Is any search running at all?
  const isActiveSearchFetching = !problemId && searchQuery.isFetching

  // Are we loading more pages?
  const isPaginationLoading = !problemId && searchQuery.isFetchingNextPage

  // The problems on screen: the one the URL names, or whatever the search returned
  const problems = problemId ? [problemId] : searchQuery.problems

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
    retryPage: needsSingleProblem ? singleProblemQuery.retry : searchQuery.retry,
    retrySearch,
    loadMore: searchQuery.loadMore,
  }
}
