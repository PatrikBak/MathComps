import {
  FloatingFocusManager,
  FloatingPortal,
  type useFloating,
  type useInteractions,
} from '@floating-ui/react'
import { FilterX } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

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
  /** The popover's contents. */
  children: ReactNode
}

/**
 * The panel a facet opens: a focus-trapped surface portalled to the body, so it can
 * overflow whatever scrolling container the facet sits in and stack above the rest of
 * the page.
 */
export function FacetPopover({
  open,
  context,
  refs,
  floatingStyles,
  getFloatingProps,
  popoverId,
  labelId,
  children,
}: FacetPopoverProps) {
  // A closed facet has no panel at all
  if (!open) return null

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal={true} returnFocus={false}>
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps({ id: popoverId, 'aria-labelledby': labelId })}
          className="z-[1000] flex flex-col overflow-hidden rounded-lg border border-foreground/10 bg-surface/95 shadow-2xl backdrop-blur"
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
  /** Empties the selection. */
  onClear: () => void
  /** How many options are selected. */
  count: number
}

/**
 * A header carrying the facet's name and a clear button, for a popover that has to
 * repeat the header inside itself.
 */
export function FacetPopoverHeader({ title, onClear, count }: FacetPopoverHeaderProps) {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-foreground/10 bg-surface/95 px-2.5 sm:px-3 py-1.5 sm:py-2">
      <div className="min-w-0">
        <span className="text-xs sm:text-sm font-medium text-foreground">{title}</span>
      </div>
      <div className="w-[80px] sm:w-[96px] flex justify-end">
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
          <span>
            {tFilters('reset')} ({count})
          </span>
        </button>
      </div>
    </div>
  )
}
