import {
  autoUpdate,
  flip,
  offset,
  type Placement,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { useIsomorphicEffect } from '@mantine/hooks'
import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

import { useDeviceCapabilities } from '@/hooks/use-device-capabilities'

import { filterOptionsBySearch } from '../model/facet-logic'
import type { FacetOption } from '../model/facet-types'

/** How many options a popover has to show before it claims a minimum height. */
const MIN_HEIGHT_OPTIONS_THRESHOLD = 10

/** The height a well-populated popover claims. */
const POPOVER_MIN_HEIGHT = 360

/** The height no popover may exceed. */
const POPOVER_MAX_HEIGHT = 520

/** How long to let the popover mount before reaching into it for the search box. */
const FOCUS_DELAY_MS = 10

/**
 * The popover machinery a facet needs.
 */
export type UseFacetPopoverResult<T extends FacetOption> = {
  /** Whether the popover is showing. */
  open: boolean
  /** Shows or hides the popover. */
  setOpen: (open: boolean) => void
  /** Which side of the trigger the popover settled on. */
  placement: Placement
  /** What the user has typed into the search box. */
  query: string
  /** Replaces the search term. */
  setQuery: (query: string) => void
  /** The options surviving the current search term. */
  filtered: T[]
  /** The search box. */
  searchRef: RefObject<HTMLInputElement | null>
  /** Id of the facet's heading. */
  labelId: string
  /** Id of the popover element. */
  popoverId: string
  /** Floating-ui's trigger and popover refs. */
  refs: ReturnType<typeof useFloating>['refs']
  /** Positioning styles for the popover element. */
  floatingStyles: CSSProperties
  /** Floating-ui's shared interaction context. */
  context: ReturnType<typeof useFloating>['context']
  /** Props the trigger has to spread. */
  getReferenceProps: ReturnType<typeof useInteractions>['getReferenceProps']
  /** Props the popover has to spread. */
  getFloatingProps: ReturnType<typeof useInteractions>['getFloatingProps']
  /** Puts the caret in the search box, or drops focus entirely on a phone. */
  focusSearchBox: () => void
}

/**
 * Runs a facet's popover: whether it is open, where it sits, how tall it may be, and
 * the search term narrowing its options.
 *
 * @param options - Every option the facet can offer, before searching.
 * @returns The state and bindings described by {@link UseFacetPopoverResult}.
 */
export function useFacetPopover<T extends FacetOption>(options: T[]): UseFacetPopoverResult<T> {
  // Whether the popover is showing
  const [open, setOpen] = useState(false)

  // What the user has typed into the search box
  const [query, setQuery] = useState('')

  // The search box
  const searchRef = useRef<HTMLInputElement>(null)

  // Ids tying the popover to the heading that names it
  const labelId = useId()
  const popoverId = useId()

  // Whether this is a phone or tablet
  const { isMobileOS } = useDeviceCapabilities()

  // A function which puts the caret where it belongs once the popover is up
  const focusSearchBox = useCallback(() => {
    // On a phone the keyboard costs more room than the search box saves, so drop focus instead
    if (isMobileOS) {
      ;(document.activeElement as HTMLElement)?.blur()
      return
    }

    // Everywhere else the caret starts in the search box, ready to type
    searchRef.current?.focus()
  }, [isMobileOS])

  // Settle focus once the device is known, since the mobile branch decides the other way
  useIsomorphicEffect(() => {
    // Put the caret where this device wants it
    focusSearchBox()
  }, [focusSearchBox])

  // The options left once the search term has been applied
  const filtered = useMemo(() => filterOptionsBySearch(options, query), [options, query])

  // Whether the list is long enough to read better at a settled height than hugging its content
  const shouldUseMinHeight = filtered.length > MIN_HEIGHT_OPTIONS_THRESHOLD

  // Positioning: anchored under the trigger, flipping above it when the page runs out below
  const { refs, floatingStyles, context, placement } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [
      // Clear of the trigger
      offset(8),

      // Above the trigger instead, once there is no room below it
      flip({ fallbackPlacements: ['top-start'], padding: 8 }),

      // Nudged along the viewport rather than allowed to hang off its edge
      shift({ padding: 8 }),

      // Sized to the trigger's width, and to whatever height the viewport allows
      size({
        apply({ availableHeight, rects, elements }) {
          // Written straight onto the element, since these change as the page moves
          Object.assign(elements.floating.style, {
            // Never past what the viewport offers, since a minimum outranks a maximum in CSS
            minHeight: shouldUseMinHeight
              ? `${Math.min(POPOVER_MIN_HEIGHT, availableHeight)}px`
              : 'auto',
            maxHeight: `${Math.min(POPOVER_MAX_HEIGHT, availableHeight)}px`,
            width: `${rects.reference.width}px`,
          })
        },
        padding: 8,
      }),
    ],
  })

  // Opens on a click of the trigger
  const click = useClick(context)

  // Closes on Escape or on a click landing anywhere else
  const dismiss = useDismiss(context, { outsidePress: true, escapeKey: true })

  // Announced as a dialog, since the popover holds controls rather than just a list
  const role = useRole(context, { role: 'dialog' })

  // The three behaviours merged into one set of props per element
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role])

  // Move focus in as the popover appears, and out again as it goes
  useEffect(() => {
    // Opening: let the popover mount before reaching into it
    if (open) {
      const focusTimer = window.setTimeout(focusSearchBox, FOCUS_DELAY_MS)

      // Closing before the timer fires must not steal focus from wherever it went next
      return () => window.clearTimeout(focusTimer)
    }

    // Closing: drop focus so no ring flashes as the popover goes
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    // A reopened facet starts from its full option list rather than the last search
    setQuery('')
  }, [open, focusSearchBox])

  // The popover's state, plus everything the trigger and panel have to spread
  return {
    open,
    setOpen,
    placement,
    query,
    setQuery,
    filtered,
    searchRef,
    labelId,
    popoverId,
    refs,
    floatingStyles,
    context,
    getReferenceProps,
    getFloatingProps,
    focusSearchBox,
  }
}
