import {
  FloatingFocusManager,
  type FloatingFocusManagerProps,
  FloatingPortal,
  type useFloating,
  type useInteractions,
} from '@floating-ui/react'
import { FilterX } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import type { FacetTriggerVariant } from './FacetTrigger'

/**
 * The fill each shape's panel takes, following the surface it floats over: a stacked facet opens inside the
 * panel its column sits in, a pill opens over the page itself.
 */
const FACET_POPOVER_SURFACES: Record<FacetTriggerVariant, string> = {
  stacked: '[--facet-surface:var(--color-surface)]',
  pill: '[--facet-surface:var(--color-surface-raised)]',
}

/**
 * The panel's own fill, which everything inside it shares. One unbroken surface, divided by hairlines
 * rather than by tone, and opaque whatever the panel is given, so the rows never show through the
 * chrome they scroll under.
 */
export const FACET_SURFACE_CLASS = 'bg-[var(--facet-surface)]'

/**
 * The panel itself.
 */
const FACET_PANEL_CLASS = cn(
  FACET_SURFACE_CLASS,
  // Everything in here is control text, which the hyphenation the document sets for prose would break mid-word
  'hyphens-none'
)

/**
 * The props of {@link FacetPopover}.
 */
type FacetPopoverProps = {
  /** Whether to render at all. */
  open: boolean
  /** Floating-ui's shared interaction context. */
  context: ReturnType<typeof useFloating>['context']
  /** Floating-ui's refs, for attaching the popover element. */
  refs: ReturnType<typeof useFloating>['refs']
  /** Positioning styles from floating-ui. */
  floatingStyles: CSSProperties
  /** Floating-ui's popover props. */
  getFloatingProps: ReturnType<typeof useInteractions>['getFloatingProps']
  /** Id given to the popover element. */
  popoverId: string
  /** Id of the heading that names the popover. */
  labelId: string
  /** How the trigger that opens it sits on the page, which decides what the panel floats over. */
  variant?: FacetTriggerVariant
  /** Where focus lands as the panel opens. */
  initialFocus: FloatingFocusManagerProps['initialFocus']
  /** Handles the navigation keys, wherever inside the panel they are pressed. */
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  /** The popover's contents. */
  children: ReactNode
}

/**
 * The panel a facet opens: a surface portalled to the body, so it can overflow whatever
 * scrolling container the facet sits in and stack above the rest of the page.
 *
 * Non-modal, since a filter is something the page is read alongside rather than instead of. The
 * modal reading hides every other control on the page from assistive tech for as long as one
 * dropdown is open, which is a heavier claim than a filter has any business making.
 *
 * The panel owns the navigation keys rather than the list inside it, because a facet too short to
 * draw a search row opens on the panel itself: a handler any deeper than this never sees the arrows
 * pressed the moment it opens.
 */
export function FacetPopover({
  open,
  context,
  refs,
  floatingStyles,
  getFloatingProps,
  popoverId,
  labelId,
  variant = 'stacked',
  initialFocus,
  onKeyDown,
  children,
}: FacetPopoverProps) {
  // A closed facet has no panel at all
  if (!open) return null

  return (
    <FloatingPortal>
      <FloatingFocusManager
        context={context}
        modal={false}
        returnFocus={false}
        initialFocus={initialFocus}
      >
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps({ id: popoverId, 'aria-labelledby': labelId, onKeyDown })}
          className={cn(
            // The panel takes focus itself as it opens, being a surface rather than a control, so it
            // draws no ring: the mark belongs on whichever row the arrows move to from there
            'focus:outline-none',
            'z-[1000] flex flex-col overflow-hidden rounded-lg border border-foreground/10 shadow-2xl',
            FACET_POPOVER_SURFACES[variant],
            FACET_PANEL_CLASS
          )}
        >
          {children}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  )
}

/**
 * The props of {@link FacetPopoverHeader}.
 */
type FacetPopoverHeaderProps = {
  /** Name of what the facet filters by. */
  title: string
  /** Id given to the name, absent where a heading outside the popover already carries it. */
  titleId: string | undefined
  /** Empties the selection. */
  onClear: () => void
  /** How many options are selected. */
  count: number
}

/**
 * A header naming the facet and carrying the way to empty it.
 *
 * The clear button holds its space while there is nothing to clear, so picking the first option does not
 * shift the list out from under the pointer that picked it.
 */
export function FacetPopoverHeader({ title, titleId, onClear, count }: FacetPopoverHeaderProps) {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  // How the button reads: the number is worth printing only from two options standing up, since below that
  // the list under it says which one as plainly as a count would
  const resetLabel = count > 1 ? `${tFilters('reset')} (${count})` : tFilters('reset')

  return (
    <div
      className={cn(
        'sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-foreground/10 px-2.5 sm:px-3 py-1.5 sm:py-2',
        FACET_SURFACE_CLASS
      )}
    >
      {/* The facet's name */}
      <span
        id={titleId}
        className="min-w-0 truncate text-xs sm:text-sm font-medium text-foreground"
      >
        {title}
      </span>

      {/* The way to clear it */}
      <div className="ml-auto w-[80px] sm:w-[96px] flex justify-end">
        <button
          type="button"
          onClick={onClear}
          className={cn(
            'inline-flex h-7 sm:h-8 items-center gap-1 rounded-md px-1.5 sm:px-2 text-[11px] sm:text-xs text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus whitespace-nowrap',
            count === 0 && 'invisible pointer-events-none'
          )}
          aria-label={tFilters('resetFilter')}
          title={tFilters('reset')}
        >
          <FilterX className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          <span>{resetLabel}</span>
        </button>
      </div>
    </div>
  )
}
