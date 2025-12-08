import { useAuth } from '@clerk/nextjs'
import { Heart, Layers, Lightbulb, X } from 'lucide-react'
import React, { useEffect, useRef } from 'react'

import { ManualHyphens } from '@/components/shared/components/ManualHyphens'
import { Tooltip } from '@/components/shared/components/Tooltip'
import { cn } from '@/components/shared/utils/css-utils'
import { useDeviceCapabilities } from '@/hooks/use-device-capabilities'
import { useLoginPromptToast } from '@/hooks/use-login-prompt-toast'

import {
  useSearchFiltersLogic,
  type UseSearchFiltersLogicProps,
} from '../hooks/use-search-filters-logic'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { createFilterUpdater } from '../utils/filter-update-utils'
import { serializeFilters } from '../utils/search-url-serialization'
import { getProblemsPageUrl } from '../utils/url-utils'
import MultiSelectFacet from './facets/MultiSelectFacet'
import TreeSelectFacet from './facets/TreeSelectFacet'

/**
 * Defines the type of filter change to distinguish between immediate and debounced search
 */
export type FilterType = 'text' | 'discrete'

/**
 * Props for {@link ModeToggleButton}
 */
type ModeToggleButtonProps = {
  /** Whether this button is active */
  isActive: boolean
  /** Click handler */
  onClick: () => void
  /** Button label */
  label: string
  /** Icon to show before label */
  icon?: React.ReactElement
  /** Whether button should show loading state */
  isLoading?: boolean
}

/**
 * Individual button within the mode toggle segmented control.
 */
const ModeToggleButton = ({ isActive, onClick, label, icon, isLoading }: ModeToggleButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 rounded-md px-2 py-2 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1.5 min-w-0',
        isActive ? 'text-white' : 'text-gray-400 hover:text-gray-300',
        isLoading && 'opacity-50 cursor-wait'
      )}
      title={label}
    >
      {/* Icon wrapper  */}
      <div className="shrink-0">
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
          className: cn(
            'h-3.5 w-3.5 transition-all duration-200',
            isActive ? 'fill-white text-white' : 'fill-none text-gray-400'
          ),
        })}
      </div>

      {/* Label */}
      <span className="truncate whitespace-nowrap">{label}</span>
    </button>
  )
}

/**
 * A tooltip icon component that provides helpful information
 * about search functionality and selection shortcuts.
 */
function TipsAndTricks() {
  const { isMac, isTouchOnly } = useDeviceCapabilities()

  const modifierKey = isMac ? '⌘' : 'Ctrl'
  const modifierName = isMac ? 'Cmd' : 'Ctrl'

  const explanationText =
    'v strome súťaží alebo ďalších filtrov vyberie len túto možnosť (bežné kliknutie položku pridáva/odoberá). Funguje tiež na kľúčové slová v kartičke s úlohami, meno autora a v paneli s aktívnymi filtrami.'

  const tooltipContent = (
    <div className="space-y-3 max-w-xs text-xs sm:text-sm">
      {/* Search languages */}
      <div>
        <div className="font-medium text-slate-200 mb-1.5">Vyhľadávanie</div>
        <p className="text-slate-300/90">
          Vyhľadávanie funguje v slovenčine, češtine a angličtine. Prednastavene sa hľadá v texte
          úlohy, môžete však zapnúť hľadanie aj v riešení.
        </p>
      </div>

      {/* Exclusive selection */}
      <div>
        <div className="font-medium text-slate-200 mb-1.5">Výlučný výber</div>
        {isTouchOnly ? (
          <p className="text-slate-300/90">Dlhé podržanie na položke {explanationText}</p>
        ) : (
          <p className="text-slate-300/90">
            Dlhé podržanie na položke alebo stlačenie{' '}
            <kbd className="px-1 py-0.5 rounded bg-slate-600/50 text-xs font-mono">
              {modifierKey}
            </kbd>{' '}
            ({modifierName}) + kliknutie na položku {explanationText}
          </p>
        )}
      </div>

      {/* Logic toggle */}
      <div>
        <div className="font-medium text-slate-200 mb-1.5">Prepínanie logiky filtrov</div>
        <p className="text-slate-300/90">
          V paneli s aktívnymi filtrami môžete kliknutím na symbol{' '}
          <span className="font-mono text-indigo-200">∧</span> (AND) alebo{' '}
          <span className="font-mono text-indigo-200">∨</span> (OR) medzi filtrami{' '}
          <ManualHyphens text="kľú\-čo\-vých" /> slov alebo autorov prepnúť logiku. AND znamená, že
          musia platiť všetky vybrané filtre, OR znamená, že stačí aspoň jeden.
        </p>
      </div>
    </div>
  )

  return (
    <Tooltip content={tooltipContent} placement="left">
      <span
        className="p-1 rounded text-slate-400 hover:text-amber-400/80 hover:bg-slate-700/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-help"
        aria-label="Tipy a triky"
      >
        <Lightbulb className="h-4 w-4" />
      </span>
    </Tooltip>
  )
}

type SearchFiltersProps = {
  filters: SearchFiltersState
  onFiltersChange: (newFilters: SearchFiltersState, filterType: FilterType) => void
  filterOptions: FilterOptionsWithCounts
  baseOptions: FilterOptionsWithCounts
}

/**
 * Sidebar filter UI for the problems library.
 * This component is now a thin wrapper around the `useSearchFiltersLogic` hook,
 * responsible for rendering the UI based on the logic provided by the hook.
 */
export const SearchFilters = ({
  filters,
  onFiltersChange,
  filterOptions,
  baseOptions,
}: SearchFiltersProps) => {
  // Ref for the search input
  const searchTextRef = useRef<HTMLInputElement | null>(null)

  // Auth state
  const { isLoaded, isSignedIn } = useAuth()

  const {
    competitionTreeOpts,
    defaultExpandedIds,
    selectedTreeIds,
    handleCompetitionTreeChange,
    seasonOpts,
    tagOpts,
    authorOpts,
    numberOpts,
  } = useSearchFiltersLogic({
    filters,
    onFiltersChange,
    filterOptions,
    baseOptions,
  } as UseSearchFiltersLogicProps)

  // A helper function to update filters
  const updateFilter = createFilterUpdater(filters, onFiltersChange)

  // A function to show the login prompt toast to access favorites
  const showLoginPrompt = useLoginPromptToast()

  // Handle favorites button click
  const handleFavoritesClick = () => {
    // Still loading, do nothing
    if (!isLoaded) {
      return
    }

    // User is not signed in, show login prompt
    if (!isSignedIn) {
      // Create filters with favorites enabled to redirect correctly after login
      const nextFilters = { ...filters, favoritesOnly: true }
      const queryString = serializeFilters(nextFilters)
      const redirectUrl = getProblemsPageUrl(queryString)

      // Show login prompt with a redirect URL to the filter with favorite problems
      showLoginPrompt({ reason: 'zobrazenie obľúbených úloh', redirectUrl })
      return
    }

    // User is signed in, toggle favorites
    updateFilter('favoritesOnly', true, 'discrete')
  }

  // Clear favoritesOnly when user logs out
  useEffect(() => {
    if (isLoaded && !isSignedIn && filters.favoritesOnly) {
      updateFilter('favoritesOnly', false, 'discrete')
    }
  }, [isLoaded, isSignedIn, filters.favoritesOnly, updateFilter])

  return (
    <div className="flex flex-col rounded-lg border border-slate-600/40 bg-slate-800/95 shadow-lg lg:fixed lg:top-28 lg:bottom-8 lg:w-[var(--problems-sidebar-width)] lg:max-h-[calc(100vh-7rem)]">
      {/* Filters Body */}
      <div className="flex-grow overflow-y-auto p-3 sm:p-4 lg:p-5 lg:min-h-0">
        <div className="space-y-3 sm:space-y-4">
          {/* Section 0: Mode Switch - All vs Favorites */}
          <div className="mb-6">
            <div className="flex w-full rounded-lg p-1 border border-slate-600/40">
              <ModeToggleButton
                isActive={!filters.favoritesOnly}
                onClick={() => updateFilter('favoritesOnly', false, 'discrete')}
                icon={<Layers />}
                label="Všetky úlohy"
              />
              <ModeToggleButton
                isActive={filters.favoritesOnly}
                onClick={handleFavoritesClick}
                isLoading={!isLoaded}
                icon={<Heart />}
                label="Moje obľúbené"
              />
            </div>
            {isLoaded && !isSignedIn && filters.favoritesOnly && (
              <p className="mt-2 text-xs text-slate-500 text-center px-2">
                Pre zobrazenie obľúbených úloh sa musíte prihlásiť.
              </p>
            )}
          </div>

          {/* Section 1: Full-text search */}
          <div>
            <div className="mb-2 sm:mb-3 flex items-center justify-between gap-2">
              <label htmlFor="search" className="text-xs sm:text-sm font-semibold text-slate-200">
                Vyhľadávanie
              </label>
              <TipsAndTricks />
            </div>
            <div className="relative">
              <input
                ref={searchTextRef}
                type="text"
                id="search"
                value={filters.searchText}
                onChange={(e) => updateFilter('searchText', e.target.value, 'text')}
                className={cn('form-input', filters.searchText && 'pr-9')}
                placeholder="napr. tabuľka"
              />
              {filters.searchText && (
                <button
                  type="button"
                  onClick={() => {
                    updateFilter('searchText', '', 'text')
                    searchTextRef.current?.focus()
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-slate-400 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  aria-label="Vymazať text vyhľadávania"
                  title="Vymazať"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex items-center mt-2 sm:mt-3">
              <input
                id="search-solution"
                type="checkbox"
                checked={filters.searchInSolution}
                onChange={(e) => updateFilter('searchInSolution', e.target.checked, 'discrete')}
                className="form-checkbox"
                disabled={!filters.searchText}
              />
              <label
                htmlFor="search-solution"
                className={cn(
                  'ml-2 text-xs sm:text-[14px] leading-none text-slate-200 transition-colors',
                  !filters.searchText && 'text-slate-500'
                )}
              >
                Hľadať aj v riešení
              </label>
            </div>
          </div>

          {/* Section 2: Contextual Filters */}
          <div className="space-y-3 sm:space-y-4 border-t border-slate-500/70 pt-3 sm:pt-4 py-2">
            <TreeSelectFacet
              title="Súťaž"
              options={competitionTreeOpts}
              selected={selectedTreeIds}
              onChange={handleCompetitionTreeChange}
              searchPlaceholder="Hľadať súťaže"
              closedLabel={'Všetky súťaže'}
              defaultExpandedIds={defaultExpandedIds}
            />

            <MultiSelectFacet
              title="Ročník"
              options={seasonOpts}
              selected={filters.seasons.map((item) => item.slug)}
              onChange={(next) => {
                updateFilter(
                  'seasons',
                  next.map((slug: string) => ({ slug, displayName: slug })),
                  'discrete'
                )
              }}
              searchPlaceholder="Hľadať ročníky…"
              closedLabel={'Všetky ročníky'}
            />

            {/* Problem Numbers as a multi-select facet */}
            <MultiSelectFacet
              title="Poradie úlohy"
              options={numberOpts}
              selected={filters.problemNumbers.map(String)}
              onChange={(next) => {
                onFiltersChange(
                  {
                    ...filters,
                    problemNumbers: next.map((id: string) => parseInt(id, 10)),
                  },
                  'discrete'
                )
              }}
              showSearch={false}
              closedLabel={'Ľubovoľné poradie'}
            />
          </div>

          {/* Section 3: Attribute Filters (Multi-select) */}
          <div className="space-y-3 sm:space-y-4 border-t border-slate-500/70 pt-3 sm:pt-4">
            <MultiSelectFacet
              title="Kľúčové slová"
              titleTooltip="Kľúčové slová sú prideľované čiastočne na základe heuristík a umelej inteligencie, a preto môžu obsahovať nepresnosti."
              closedLabel={'Vyberte kľúčové slová'}
              options={tagOpts}
              selected={filters.tags.map((item) => item.slug)}
              onChange={(next) => {
                updateFilter(
                  'tags',
                  next.map((slug: string) => ({ slug, displayName: slug })),
                  'discrete'
                )
              }}
              searchPlaceholder="Hľadať kľúčové slová"
              logic={{
                mode: filters.tagLogic,
                onChange: (mode) => updateFilter('tagLogic', mode, 'discrete'),
                labels: { or: 'Aspoň jedno', and: 'Všetky' },
              }}
              grouping={{
                keys: ['Area', 'Type', 'Goal', 'Technique'],
                labels: {
                  Area: 'Oblasť',
                  Type: 'Výskyt',
                  Goal: 'Cieľ',
                  Technique: 'Technika',
                },
              }}
            />

            <MultiSelectFacet
              title="Autori"
              closedLabel={'Vyberte autorov'}
              options={authorOpts}
              selected={filters.authors.map((item) => item.slug)}
              onChange={(next) => {
                updateFilter(
                  'authors',
                  next.map((slug: string) => ({ slug, displayName: slug })),
                  'discrete'
                )
              }}
              searchPlaceholder="Hľadať autorov…"
              logic={{
                mode: filters.authorLogic,
                onChange: (mode) => updateFilter('authorLogic', mode, 'discrete'),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
