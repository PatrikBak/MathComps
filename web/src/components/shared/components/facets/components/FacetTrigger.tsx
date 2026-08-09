import type { useFloating, useInteractions } from '@floating-ui/react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * How a facet's trigger sits on the page: filling the column it stands in, under a heading naming it, or as a
 * pill in a row of them, carrying that name itself.
 */
export type FacetTriggerVariant = 'stacked' | 'pill'

/**
 * What every facet control shares at rest, whichever shape it takes. Its border colour and fill are not
 * among them: those come with the shape, since the two shapes stand on different surfaces.
 */
export const FACET_CONTROL_CLASS = cn(
  'flex items-center gap-2 border text-xs sm:text-sm text-muted-foreground transition-all focus-visible:border-focus/60',
  FOCUS_RING_CLASS
)

/**
 * The pill shape, exported so a plain toggle standing in the same row can't drift away from the facets beside it.
 *
 * It sits on the page itself, so it is drawn lighter than the panel-weight edge a stacked control carries.
 */
export const FACET_PILL_CLASS = cn(
  'w-auto shrink-0 rounded-full border-foreground/10 bg-foreground/[0.03] px-3 py-1.5',
  'hover:border-foreground/25 hover:bg-foreground/[0.07]'
)

/**
 * How a pill reads once it is narrowing something.
 */
export const FACET_PILL_ACTIVE_CLASS = 'border-foreground/40 bg-foreground/10 text-foreground'

/**
 * How one trigger shape sits on the page and what it says about itself.
 */
type FacetTriggerShape = {
  /** The classes giving the trigger its edge, its fill and its spacing. */
  shapeClass: string
  /**
   * Whether the trigger carries the facet's name in its own visible text. One that does states what it was
   * narrowed to and reads as active on its own; one that doesn't leaves both to the heading above it.
   */
  isSelfNaming: boolean
}

/** How each variant sits on the page. */
const FACET_TRIGGER_SHAPES: Record<FacetTriggerVariant, FacetTriggerShape> = {
  stacked: {
    shapeClass: cn(
      'w-full justify-between rounded-lg border-muted/30 bg-surface/95 px-2.5 py-2 sm:px-3 sm:py-2.5',
      'hover:border-muted/60'
    ),
    isSelfNaming: false,
  },
  pill: { shapeClass: FACET_PILL_CLASS, isSelfNaming: true },
}

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
  /**
   * The one selected option's name, where the facet has exactly one to name; null otherwise. Only a
   * self-naming shape reads it, carrying it in place of the facet's own name so that a filtered row states
   * what it was narrowed to rather than only that it was.
   */
  selectedLabel: string | null
  /** How many options are selected. */
  count: number
  /** Name of what the facet filters by, which the accessible name is built around. */
  title: string
  /** How the trigger sits on the page. */
  variant?: FacetTriggerVariant
}

/**
 * The button that opens a facet's popover, reading what the facet was narrowed to and how many
 * options that took.
 */
export function FacetTrigger({
  open,
  refs,
  getReferenceProps,
  closedLabel,
  selectedLabel,
  count,
  title,
  variant = 'stacked',
}: FacetTriggerProps) {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  // How this trigger sits on the page, and whether it speaks for itself
  const { shapeClass, isSelfNaming } = FACET_TRIGGER_SHAPES[variant]

  // Whether the badge tells the reader anything the visible label doesn't: a self-naming trigger already
  // states the one option standing, so there the number only starts saying something at two
  const showCount = count > (isSelfNaming ? 1 : 0)

  return (
    <button
      ref={refs.setReference}
      {...getReferenceProps()}
      type="button"
      className={cn(
        FACET_CONTROL_CLASS,
        shapeClass,
        // With something picked and no heading above it to say so, the trigger has to read as active itself
        isSelfNaming && count > 0 && FACET_PILL_ACTIVE_CLASS
      )}
      aria-haspopup="dialog"
      aria-expanded={open}
      // A self-naming trigger carries the facet's name in its own text, so naming it again here would replace
      // the visible label with different words and swallow the count badge. The others read a fixed closed
      // label, with the facet named by the heading above them, so there it is the accessible name, and it
      // says what the click will do rather than describing the panel that is already up.
      aria-label={
        isSelfNaming
          ? undefined
          : open
            ? tFilters('closePopover')
            : tFilters('openPopover', { name: title.toLowerCase() })
      }
    >
      {/* Label, plus the selected-count badge */}
      <span className="min-w-0 flex items-center gap-2 truncate">
        {/* A self-naming trigger states the one option it was narrowed to, or names the facet; the rest
            read their closed label */}
        <span className="truncate">{isSelfNaming ? (selectedLabel ?? title) : closedLabel}</span>
        {showCount && (
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
