import type { useFloating, useInteractions } from '@floating-ui/react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * The props of {@link FacetTrigger}.
 */
type FacetTriggerProps = {
  /** Whether the popover it controls is showing. */
  open: boolean
  /** Floating-ui's refs, for anchoring the popover to this button. */
  refs: ReturnType<typeof useFloating>['refs']
  /** Floating-ui's trigger props. */
  getReferenceProps: ReturnType<typeof useInteractions>['getReferenceProps']
  /** What the button reads when nothing is selected. */
  closedLabel: string
  /** How many options are selected. */
  count: number
  /** Name of what the facet filters by, which the accessible name is built around. */
  title: string
}

/**
 * The button that opens a facet's popover, showing how many options are selected.
 */
export function FacetTrigger({
  open,
  refs,
  getReferenceProps,
  closedLabel,
  count,
  title,
}: FacetTriggerProps) {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  return (
    <button
      ref={refs.setReference}
      {...getReferenceProps()}
      type="button"
      className="w-full flex items-center justify-between gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg border border-muted/30 bg-surface/95 text-xs sm:text-sm text-muted-foreground outline-none transition-all hover:border-muted/60 focus:border-focus/60 focus:ring-2 focus:ring-focus/35"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={
        open ? tFilters('closePopover') : tFilters('openPopover', { name: title.toLowerCase() })
      }
    >
      {/* Label, plus the selected-count badge */}
      <span className="min-w-0 flex items-center gap-2 truncate">
        <span className="truncate">{closedLabel}</span>
        {count > 0 && (
          <span
            className="shrink-0 rounded-full bg-foreground/10 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-[11px] leading-none"
            aria-label={tFilters('selectedCount', { count })}
          >
            {count}
          </span>
        )}
      </span>

      {/* Open/closed indicator */}
      <span className="shrink-0 text-muted-foreground">
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
        )}
      </span>
    </button>
  )
}
