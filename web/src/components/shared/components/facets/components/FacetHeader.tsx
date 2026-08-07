import { FilterX, HelpCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Tooltip } from '@/components/shared/components/Tooltip'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * The props of {@link FacetHeader}.
 */
type FacetHeaderProps = {
  /** Name of what the facet filters by. */
  title: string
  /** Id given to the heading. */
  labelId: string
  /** Whether the facet currently holds a selection. */
  anySelected: boolean
  /** Empties the selection. */
  onClear: () => void
  /** Hides the clear button while keeping its space. */
  suppressClear?: boolean
  /** Explanation offered beside the title. */
  titleTooltip?: string
}

/**
 * A facet's header: what it filters by, and a way to empty it.
 */
export function FacetHeader({
  title,
  labelId,
  anySelected,
  onClear,
  suppressClear = false,
  titleTooltip,
}: FacetHeaderProps) {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  // Clearing is worth offering only when there is a selection to empty
  const showClear = anySelected && !suppressClear

  return (
    <div className="flex items-center justify-between gap-2 mb-1 sm:mb-1.5">
      {/* Title, with its explanation alongside */}
      <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-semibold text-foreground">
        <h3 id={labelId} className="flex-1">
          {title}
        </h3>
        {titleTooltip && (
          <Tooltip placement="top" content={titleTooltip}>
            <HelpCircle className="h-4 w-4 cursor-help text-muted/80" aria-hidden="true" />
          </Tooltip>
        )}
      </div>

      {/* Clear button, which stays laid out even when it is not showing */}
      <button
        type="button"
        onClick={onClear}
        className={cn(
          'shrink-0 inline-flex h-6 sm:h-7 items-center gap-0.5 sm:gap-1 rounded-md px-1.5 sm:px-2 text-[11px] sm:text-[12px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus whitespace-nowrap',
          !showClear && 'invisible pointer-events-none'
        )}
        aria-label={tFilters('resetSelection', { name: title })}
        title={tFilters('reset')}
      >
        <FilterX className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        <span className="hidden sm:inline">{tFilters('reset')}</span>
      </button>
    </div>
  )
}
