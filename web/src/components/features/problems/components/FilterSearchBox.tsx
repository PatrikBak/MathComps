import { Lightbulb, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ReactNode, useId, useRef } from 'react'

import { LIGHT_CONTROL_SURFACE_CLASS } from '@/components/shared/components/facets/components/FacetTrigger'
import { Kbd } from '@/components/shared/components/Kbd'
import { ManualHyphens } from '@/components/shared/components/ManualHyphens'
import { Tooltip } from '@/components/shared/components/Tooltip'
import { cn } from '@/components/shared/utils/css-utils'
import { useDeviceCapabilities } from '@/hooks/use-device-capabilities'

import type { SearchFiltersState } from '../types/problem-library-types'
import { createFilterUpdater } from '../utils/filter-update-utils'

/**
 * The hint beside the search box, explaining what the filters can do that isn't visible:
 * which languages a search covers, the modifier that narrows a facet to one value, and
 * what the AND/OR toggle means.
 */
function TipsAndTricks() {
  // Translations for the filter hints
  const t = useTranslations('problems.filters.tips')

  // The lead-in both the touch and desktop wordings are built around
  const introText = t('intro')

  // The modifier is named differently per platform, and absent entirely on touch
  const { isMac, isTouchOnly } = useDeviceCapabilities()

  // The key as it is printed, and as it is spoken
  const modifierKey = isMac ? '⌘' : 'Ctrl'
  const modifierName = isMac ? 'Cmd' : 'Ctrl'

  // The hint's body
  const tooltipContent = (
    <div className="space-y-3 max-w-xs text-xs sm:text-sm">
      {/* Search languages */}
      <div>
        <div className="font-medium text-foreground mb-1.5">{t('search.title')}</div>
        <p className="text-muted-foreground">{t('search.text')}</p>
      </div>

      {/* Exclusive selection */}
      <div>
        <div className="font-medium text-foreground mb-1.5">{t('exclusive.title')}</div>
        {isTouchOnly ? (
          <p className="text-muted-foreground">{t('exclusive.touch', { intro: introText })}</p>
        ) : (
          <p className="text-muted-foreground">
            {t.rich('exclusive.desktop', {
              modifierKey,
              modifierName,
              intro: introText,
              kbd: (chunks: ReactNode) => <Kbd>{chunks}</Kbd>,
            })}
          </p>
        )}
      </div>

      {/* Logic toggle */}
      <div>
        <div className="font-medium text-foreground mb-1.5">{t('logic.title')}</div>
        <p className="text-muted-foreground">
          {t.rich('logic.text', {
            mono: (chunks: ReactNode) => (
              <span className="font-mono text-focus-light">{chunks}</span>
            ),
            hyphens: (chunks: ReactNode) => <ManualHyphens text={String(chunks)} />,
          })}
        </p>
      </div>
    </div>
  )

  return (
    <Tooltip content={tooltipContent} placement="left">
      <button
        type="button"
        className={cn(
          'cursor-help rounded p-1 text-muted transition-colors hover:bg-foreground/5 hover:text-warning/80',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'
        )}
        aria-label={t('title')}
      >
        <Lightbulb className="h-4 w-4" />
      </button>
    </Tooltip>
  )
}

/**
 * The props of {@link FilterSearchBox}.
 */
type FilterSearchBoxProps = {
  /** The filters currently applied, the term searched for and its scope among them. */
  filters: SearchFiltersState
  /** Applies a change the user made in the box. */
  onFiltersChange: (newFilters: SearchFiltersState) => void
}

/**
 * The full-text search over the problems: the box the term is typed into, the hint on what the filters can do, and
 * whether the search reaches into the solutions too.
 */
export function FilterSearchBox({ filters, onFiltersChange }: FilterSearchBoxProps) {
  // Translations for the filter sidebar
  const t = useTranslations('problems.filters')

  // The search box
  const searchTextRef = useRef<HTMLInputElement | null>(null)

  // The ids tying the search box and its scope to their labels, unique to each copy of the box, since the page can
  // hold more than one
  const searchTextId = useId()
  const searchScopeId = useId()

  // A function which writes one filter back, carrying the rules that tie filters together
  const updateFilter = createFilterUpdater(filters, onFiltersChange)

  // A function which empties the search box
  const handleClearSearch = () => {
    // Emptying the term also drops the search-in-solutions scope
    updateFilter('searchText', '')

    // Clearing by the button would otherwise leave the caret nowhere
    searchTextRef.current?.focus()
  }

  return (
    <div>
      <div className="mb-2 sm:mb-3 flex items-center justify-between gap-2">
        <label htmlFor={searchTextId} className="text-xs sm:text-sm font-semibold text-foreground">
          {t('search.label')}
        </label>
        <TipsAndTricks />
      </div>
      <div className="relative">
        <input
          ref={searchTextRef}
          type="text"
          id={searchTextId}
          value={filters.searchText}
          onChange={(event) => updateFilter('searchText', event.target.value)}
          className={cn(
            'form-input focus-visible:border-focus/70',
            LIGHT_CONTROL_SURFACE_CLASS,
            filters.searchText && 'pr-9'
          )}
          placeholder={t('search.placeholder')}
        />
        {filters.searchText && (
          <button
            type="button"
            onClick={handleClearSearch}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 rounded text-muted hover:text-foreground',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'
            )}
            aria-label={t('search.clear')}
            title={t('search.clear')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex items-center mt-2 sm:mt-3">
        <input
          id={searchScopeId}
          type="checkbox"
          checked={filters.searchInSolution}
          onChange={(event) => updateFilter('searchInSolution', event.target.checked)}
          className="form-checkbox"
          disabled={!filters.searchText}
        />
        <label
          htmlFor={searchScopeId}
          className={cn(
            'ml-2 text-xs sm:text-[14px] leading-none text-foreground transition-colors',
            !filters.searchText && 'text-muted/40'
          )}
        >
          {t('search.searchInSolution')}
        </label>
      </div>
    </div>
  )
}
