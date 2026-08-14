'use client'

import { Loader2, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { GroupedVirtuoso } from 'react-virtuoso'

import { Modal } from '@/components/shared/components/Modal'
import { cn } from '@/components/shared/utils/css-utils'

import { useCompetitionBrowser } from '../hooks/use-competition-browser'
import type {
  CompetitionWithCount,
  SeasonCompetitionsGroup,
} from '../types/competition-browser-types'

/** Golden angle in degrees — guarantees maximum hue separation between consecutive indices. */
const GOLDEN_ANGLE = 137.508

/**
 * Builds a color map for a list of seasons, assigning a distinct HSL color
 * to each group of sibling competitions using golden angle distribution.
 *
 * @param seasons The seasons to build the color map for.
 *
 * @returns A map from color key to HSL color string.
 */
function buildHueMap(seasons: SeasonCompetitionsGroup[]): Map<string, number> {
  // Collect unique keys in order of first appearance
  const uniqueKeys = [
    ...new Set(
      seasons.flatMap((seasonGroup) => seasonGroup.competitions.map(getCompetitionColorKey))
    ),
  ]

  // Assign golden-angle-spaced hues
  return new Map(uniqueKeys.map((key, index) => [key, Math.round((index * GOLDEN_ANGLE) % 360)]))
}

/**
 * Returns the color key for a competition, which is the one a level above it. Siblings therefore
 * share a color, and a competition with others hanging straight off it keeps them all under one.
 *
 * The key is taken off the path rather than the labels because labels are localized, and two
 * competitions reading alike in one language would silently share a hue.
 *
 * @param competition The competition to get the color key for.
 *
 * @returns The color key string.
 */
function getCompetitionColorKey(competition: CompetitionWithCount): string {
  // What the competition hangs from, which is nothing at all for one sitting at the root
  const parentPath = competition.path.split('-').slice(0, -1).join('-')

  // A root competition stands under its own name, since there is nothing above it to group it with
  return parentPath || competition.path
}

/**
 * Returns the problem count for a season.
 *
 * @param season The season to get the problem count for.
 *
 * @returns The problem count for the season.
 */
function getSeasonProblemCount(season: SeasonCompetitionsGroup) {
  return season.competitions.reduce((sum, competition) => sum + competition.problemCount, 0)
}

/**
 * Small decorative label chip used in the competition browser rows.
 * Not interactive — the entire row is the click target.
 */
function Chip({ children, truncate }: { children: React.ReactNode; truncate?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-xs text-muted-foreground bg-foreground/5',
        truncate ? 'truncate' : 'flex-shrink-0'
      )}
    >
      {children}
    </span>
  )
}

/**
 * The data passed when a competition is selected from the browser.
 * Names what was picked and nothing more - the parent is responsible for building the filter state.
 */
export type CompetitionBrowserSelection = {
  /** Season slug (the edition number as string) */
  seasonSlug: string
  /** The competition, addressed by the slugs leading down to it, e.g. `csmo-a-i`. */
  path: string
}

/**
 * Props for the {@link CompetitionBrowserModal} component.
 */
type CompetitionBrowserModalProps = {
  /** Whether the modal is open. */
  isOpen: boolean
  /** Callback to close the modal. */
  onClose: () => void
  /** Callback to set the search filters when a competition is selected. */
  onSelectCompetition: (filters: CompetitionBrowserSelection) => void
}

/**
 * Flattened competition item with its parent season and visual metadata.
 */
type FlattenedCompetition = {
  /** The season of the competition */
  season: SeasonCompetitionsGroup
  /** The competition */
  competition: CompetitionWithCount
  /** The hue (0-360) the competition shares with its siblings */
  hue: number
}

/**
 * Modal for browsing competitions organized by year. Features:
 * 1. Search box at the top
 * 2. Virtualized list of seasons with competitions
 * 3. Color-coded dots for visual grouping of sibling competitions
 * 4. Clicking on a competition sets the filters and closes the modal
 */
export function CompetitionBrowserModal({
  isOpen,
  onClose,
  onSelectCompetition,
}: CompetitionBrowserModalProps) {
  // Get the data loader
  const { data, isLoading, error } = useCompetitionBrowser(isOpen)

  // The state for the current search query
  const [searchQuery, setSearchQuery] = useState('')

  // Translations for plurals
  const tPlurals = useTranslations('plurals')

  // Translations for the problems page
  const tProblems = useTranslations('problems')

  // Build the hue map once from all data (not filtered) so colors stay stable during search
  const hueMap = useMemo(() => {
    return data?.seasons ? buildHueMap(data.seasons) : new Map<string, number>()
  }, [data?.seasons])

  // The function to filter the seasons based on the search query
  const filteredSeasons = useMemo(() => {
    // Handle no data
    if (!data?.seasons) return []

    // Normalize search query
    const normalizedSearchQuery = searchQuery.toLowerCase().trim()

    // Handle empty search query
    if (!normalizedSearchQuery) return data.seasons

    // Filter competitions based on search query
    return data.seasons
      .map((season) => ({
        ...season,
        competitions: season.competitions.filter(
          (competition) =>
            competition.labels.some((label) =>
              label.toLowerCase().includes(normalizedSearchQuery)
            ) || season.editionLabel.toLowerCase().includes(normalizedSearchQuery)
        ),
      }))
      .filter((season) => season.competitions.length > 0)
  }, [data?.seasons, searchQuery])

  // Flatten data for GroupedVirtuoso with precomputed hues
  const { groupCounts, flatCompetitions } = useMemo(() => {
    // Get the counts for each season
    const counts = filteredSeasons.map((season) => season.competitions.length)

    // Get the competitions for each season with their assigned hue
    const competitions: FlattenedCompetition[] = filteredSeasons.flatMap((season) =>
      season.competitions.map((competition) => ({
        season,
        competition,
        hue: hueMap.get(getCompetitionColorKey(competition)) ?? 0,
      }))
    )

    // Return the flattened competitions and group counts
    return { groupCounts: counts, flatCompetitions: competitions }
  }, [filteredSeasons, hueMap])

  /**
   * Handles a competition click, setting the filters.
   *
   * @param season The season of the competition.
   * @param competition The competition to select.
   */
  const handleCompetitionClick = (
    season: SeasonCompetitionsGroup,
    competition: CompetitionWithCount
  ) => {
    // Set filters for this competition + season
    onSelectCompetition({
      seasonSlug: String(season.editionNumber),
      path: competition.path,
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tProblems('competitionsOverview')}
      showCloseButton
      className="max-w-xl max-h-[90vh] flex flex-col"
    >
      {/* Search box */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={tProblems('searchCompetitions')}
          className="form-input pl-9 w-full text-sm"
          autoFocus
        />
      </div>

      {/* Content */}
      <div className="h-[100vh] md:h-[60vh] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-error">
            <p>{tProblems('loadCompetitionsFailed')}</p>
          </div>
        ) : filteredSeasons.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <p>{tProblems('noCompetitions')}</p>
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
                <div className="text-sm font-semibold text-foreground bg-surface py-2 px-2 flex items-center justify-between">
                  <span>{season.editionLabel}</span>
                  <span className="text-xs font-normal text-muted">
                    {tPlurals('problems', { count: problemCount })}
                  </span>
                </div>
              )
            }}
            itemContent={(index) => {
              // Get the data for the current row
              const { season, competition, hue } = flatCompetitions[index]

              return (
                <button
                  onClick={() => handleCompetitionClick(season, competition)}
                  className={cn(
                    'w-full text-left px-3 py-1.5 rounded-md text-sm',
                    'flex items-center justify-between gap-3',
                    'hover:bg-foreground/5 transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {/* Color dot for visual grouping */}
                    <span
                      className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `hsl(${hue}, 55%, 62%)` }}
                    />

                    {/* Competition chips, one per level down to the competition */}
                    {competition.labels.map((label, labelIndex) => (
                      <Chip
                        key={labelIndex}
                        truncate={labelIndex === competition.labels.length - 1}
                      >
                        {label}
                      </Chip>
                    ))}
                  </span>
                  <span className="text-xs text-muted tabular-nums flex-shrink-0">
                    {competition.problemCount}
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
