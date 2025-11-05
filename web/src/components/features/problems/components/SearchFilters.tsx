import { Lightbulb, X } from 'lucide-react'
import React, { useRef } from 'react'

import Tooltip from '@/components/shared/components/Tooltip'
import { cn } from '@/components/shared/utils/css-utils'
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities'

import {
  useSearchFiltersLogic,
  type UseSearchFiltersLogicProps,
} from '../hooks/use-search-filters-logic'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { createFilterUpdater } from '../utils/filter-update-utils'
import MultiSelectFacet from './facets/MultiSelectFacet'
import TreeSelectFacet from './facets/TreeSelectFacet'

// Defines the type of filter change to distinguish between immediate and debounced search
type FilterType = 'text' | 'discrete'

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
            Stlačenie{' '}
            <kbd className="px-1 py-0.5 rounded bg-slate-600/50 text-xs font-mono">
              {modifierKey}
            </kbd>{' '}
            ({modifierName}) + kliknutie na položku {explanationText}
          </p>
        )}
      </div>
    </div>
  )

  return (
    <Tooltip content={tooltipContent} placement="left">
      <button
        type="button"
        className="p-1 rounded text-slate-400 hover:text-amber-400/80 hover:bg-slate-700/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label="Tipy a triky"
      >
        <Lightbulb className="h-4 w-4" />
      </button>
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
  const searchTextRef = useRef<HTMLInputElement | null>(null)

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

  return (
    <div className="flex flex-col rounded-lg border border-slate-600/40 bg-slate-800/95 shadow-lg lg:fixed lg:top-28 lg:bottom-8 lg:w-[var(--problems-sidebar-width)] lg:max-h-[calc(100vh-7rem)]">
      {/* Filters Body */}
      <div className="flex-grow overflow-y-auto p-3 sm:p-4 lg:p-5 lg:min-h-0">
        <div className="space-y-3 sm:space-y-4">
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
              onChange={(next) =>
                updateFilter(
                  'seasons',
                  next.map((slug) => ({ slug, displayName: slug })),
                  'discrete'
                )
              }
              searchPlaceholder="Hľadať ročníky…"
              closedLabel={'Všetky ročníky'}
            />

            {/* Problem Numbers as a multi-select facet */}
            <MultiSelectFacet
              title="Poradie úlohy"
              options={numberOpts}
              selected={filters.problemNumbers.map(String)}
              onChange={(nextIds: string[]) => {
                onFiltersChange(
                  {
                    ...filters,
                    problemNumbers: nextIds.map((id) => parseInt(id, 10)),
                  },
                  'discrete'
                )
              }}
              showSearch={false}
              showCounts={true}
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
              onChange={(newTags) =>
                updateFilter(
                  'tags',
                  newTags.map((slug) => ({ slug, displayName: slug })),
                  'discrete'
                )
              }
              searchPlaceholder="Hľadať kľúčové slová"
              logic={{
                mode: filters.tagLogic,
                onChange: (m) => updateFilter('tagLogic', m, 'discrete'),
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
              onChange={(newAuthors) =>
                updateFilter(
                  'authors',
                  newAuthors.map((slug) => ({ slug, displayName: slug })),
                  'discrete'
                )
              }
              searchPlaceholder="Hľadať autorov…"
              logic={{
                mode: filters.authorLogic,
                onChange: (node) => updateFilter('authorLogic', node, 'discrete'),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
