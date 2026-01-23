'use client'

import { Loader2, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { GroupedVirtuoso } from 'react-virtuoso'

import { Modal } from '@/components/shared/components/Modal'
import { cn } from '@/components/shared/utils/css-utils'

import { useContestBrowser } from '../hooks/use-contest-browser'
import type { ContestWithCount, SeasonContestsGroup } from '../types/contest-browser-types'

/**
 * Returns the display name of a contest.
 *
 * @param contest The contest to get the display name for.
 *
 * @returns The display name of the contest.
 */
function getContestDisplayName(contest: ContestWithCount) {
  // Start the with competition which always exists
  let name = contest.competitionName

  // Category is optional
  if (contest.categoryName) name += ` ${contest.categoryName}`

  // Round is optional
  if (contest.roundName) name += ` - ${contest.roundName}`

  // The final name
  return name
}

/**
 * Returns the problem count for a season.
 *
 * @param season The season to get the problem count for.
 *
 * @returns The problem count for the season.
 */
function getSeasonProblemCount(season: SeasonContestsGroup) {
  return season.contests.reduce((sum, contest) => sum + contest.problemCount, 0)
}

/**
 * The data passed when a contest is selected from the browser.
 * Contains only slugs - the parent is responsible for building the filter state.
 */
export type ContestBrowserSelection = {
  /** Season slug (the edition number as string) */
  seasonSlug: string
  /** The competition slug */
  competitionSlug: string
  /** The category slug, if applicable */
  categorySlug: string | null
  /** The round slug, if applicable */
  roundSlug: string | null
}

/**
 * Props for the {@link ContestBrowserModal} component.
 */
type ContestBrowserModalProps = {
  /** Whether the modal is open. */
  isOpen: boolean
  /** Callback to close the modal. */
  onClose: () => void
  /** Callback to set the search filters when a contest is selected. */
  onSelectContest: (filters: ContestBrowserSelection) => void
}

/**
 * Flattened contest item with its parent season.
 */
type FlattenedContest = {
  /** The season of the contest */
  season: SeasonContestsGroup
  /** The contest */
  contest: ContestWithCount
}

/**
 * Modal for browsing competitions organized by year. Features:
 * 1. Search box at the top
 * 2. Virtualized list of seasons with contests
 * 3. Clicking on a contest sets the filters and closes the modal
 */
export function ContestBrowserModal({
  isOpen,
  onClose,
  onSelectContest,
}: ContestBrowserModalProps) {
  // Get the data loader
  const { data, isLoading, error } = useContestBrowser(isOpen)

  // The state for the current search query
  const [searchQuery, setSearchQuery] = useState('')

  // Translations for plurals
  const tPlurals = useTranslations('plurals')

  // Translations for the problems page
  const tProblems = useTranslations('problems')

  // The function to filter the seasons based on the search query
  const filteredSeasons = useMemo(() => {
    // Handle no data
    if (!data?.seasons) return []

    // Normalize search query
    const normalizedSearchQuery = searchQuery.toLowerCase().trim()

    // Handle empty search query
    if (!normalizedSearchQuery) return data.seasons

    // Filter contests based on search query
    return data.seasons
      .map((season) => ({
        ...season,
        contests: season.contests.filter(
          (contest) =>
            getContestDisplayName(contest).toLowerCase().includes(normalizedSearchQuery) ||
            season.editionLabel.toLowerCase().includes(normalizedSearchQuery)
        ),
      }))
      .filter((season) => season.contests.length > 0)
  }, [data?.seasons, searchQuery])

  // Flatten data for GroupedVirtuoso - recomputed when search results change
  const { groupCounts, flatContests } = useMemo(() => {
    // Get the counts for each season
    const counts = filteredSeasons.map((season) => season.contests.length)

    // Get the contests for each season
    const contests: FlattenedContest[] = filteredSeasons.flatMap((season) =>
      season.contests.map((contest) => ({ season, contest }))
    )

    // Return the flattened contests and group counts
    return { groupCounts: counts, flatContests: contests }
  }, [filteredSeasons])

  /**
   * Handles a contest click, setting the filters and closing the modal.
   *
   * @param season The season of the contest.
   * @param contest The contest to select.
   */
  const handleContestClick = (season: SeasonContestsGroup, contest: ContestWithCount) => {
    // Set filters for this contest + season
    onSelectContest({
      seasonSlug: String(season.editionNumber),
      competitionSlug: contest.competitionSlug,
      categorySlug: contest.categorySlug,
      roundSlug: contest.roundSlug,
    })

    // Close modal
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tProblems('contestsOverview')}
      showCloseButton
      className="max-w-xl max-h-[90vh] flex flex-col"
    >
      {/* Search box */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={tProblems('searchContests')}
          className="form-input !pl-9 w-full text-sm"
          autoFocus
        />
      </div>

      {/* Content */}
      <div className="h-[100vh] md:h-[60vh] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-400">
            <p>{tProblems('loadContestsFailed')}</p>
          </div>
        ) : filteredSeasons.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p>{tProblems('noContests')}</p>
          </div>
        ) : (
          <GroupedVirtuoso
            style={{ height: '100%' }}
            groupCounts={groupCounts}
            groupContent={(index) => {
              // Get the season data for the current row
              const season = filteredSeasons[index]

              // Get the problem count for this season
              const problemCount = getSeasonProblemCount(season)

              return (
                <div className="text-sm font-semibold text-slate-200 bg-slate-700 py-2 px-2 flex items-center justify-between">
                  <span>{season.editionLabel}</span>
                  <span className="text-xs font-normal text-slate-400">
                    {tPlurals('problems', { count: problemCount })}
                  </span>
                </div>
              )
            }}
            itemContent={(index) => {
              // Get the data for the current row
              const { season, contest } = flatContests[index]

              return (
                <button
                  onClick={() => handleContestClick(season, contest)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm',
                    'flex items-center justify-between gap-4',
                    'text-slate-200 hover:bg-slate-700/50 transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
                  )}
                >
                  <span className="truncate">{getContestDisplayName(contest)}</span>
                  <span className="text-xs text-slate-400 tabular-nums flex-shrink-0">
                    {contest.problemCount}
                  </span>
                </button>
              )
            }}
          />
        )}
      </div>
    </Modal>
  )
}
