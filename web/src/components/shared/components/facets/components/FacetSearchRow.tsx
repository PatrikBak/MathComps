import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type RefObject, useCallback } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import { FACET_SURFACE_CLASS } from './FacetPopover'

/** How many options a facet has to offer before searching them is worth the row it costs. */
export const SEARCH_THRESHOLD = 12

/**
 * The props of {@link FacetSearchRow}.
 */
type FacetSearchRowProps = {
  /** What the user has typed. */
  query: string
  /** Replaces the search term. */
  setQuery: (value: string) => void
  /** The search input element. */
  searchRef: RefObject<HTMLInputElement | null>
  /** Name of what the facet filters by, used in the accessible labels. */
  title: string
  /** Prompt shown in the empty input. */
  placeholder: string
  /** Hands focus down to the option list. */
  onArrowDownToList: () => void
}

/**
 * The search box at the top of a facet's popover, with a clear button that appears
 * once there is something to clear.
 */
export function FacetSearchRow({
  query,
  setQuery,
  searchRef,
  title,
  placeholder,
  onArrowDownToList,
}: FacetSearchRowProps) {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  // A function which empties the box and puts the caret back in it
  const handleClear = useCallback(() => {
    // Empty the search term
    setQuery('')

    // Clearing by the button would otherwise leave the caret nowhere
    searchRef.current?.focus()
  }, [setQuery, searchRef])

  return (
    <div
      className={cn(
        'relative flex items-center gap-2 border-b border-foreground/10 px-2.5 sm:px-3 py-1.5 sm:py-2',
        FACET_SURFACE_CLASS
      )}
    >
      <div className="relative flex-1">
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Arrow-down hands over to the list rather than moving the caret
            if (event.key === 'ArrowDown') {
              // The caret would otherwise jump to the end of the term
              event.preventDefault()
              onArrowDownToList()
            }

            // Escape empties the box first, and only closes the popover once it is empty
            if (event.key === 'Escape' && query.length > 0) {
              // The popover's own dismiss would otherwise take the whole thing down
              event.preventDefault()
              handleClear()
            }
          }}
          aria-label={tFilters('searchIn', { name: title.toLowerCase() })}
          placeholder={placeholder}
          className={cn(
            'h-8 sm:h-9 w-full rounded-md border border-foreground/10 bg-surface-inset/40 px-2.5 sm:px-3 text-xs sm:text-sm text-foreground placeholder-muted focus:border-focus/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-focus/70',
            query.length > 0 && 'pr-8 sm:pr-9'
          )}
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 rounded text-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus transition-colors"
            aria-label={tFilters('clearSearch', { name: title.toLowerCase() })}
            title={tFilters('clear')}
          >
            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
