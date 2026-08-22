import {
  type FloatingContext,
  type FloatingFocusManagerProps,
  type OpenChangeReason,
  type Placement,
  useClick,
  useDismiss,
  type UseFloatingReturn,
  useInteractions,
  useRole,
} from '@floating-ui/react'
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
import { useFloatingPanel } from '@/hooks/use-floating-panel'

import { filterOptionsBySearch } from '../model/facet-logic'
import type { FacetOption } from '../model/facet-types'

/** How many options a popover has to show before it claims a minimum height. */
const MIN_HEIGHT_OPTIONS_THRESHOLD = 10

/** The height a well-populated popover claims. */
const POPOVER_MIN_HEIGHT = 360

/** The height no popover may exceed. */
const POPOVER_MAX_HEIGHT = 520

/** The width a popover claims when its trigger is too narrow to hand it a usable one. */
const POPOVER_MIN_WIDTH = 260

/**
 * Where a popover takes its width from: its trigger, for a facet standing in a column as wide as the list it
 * opens, or its own content, for one whose trigger is only as wide as its label.
 */
export type FacetPopoverWidth = 'trigger' | 'content'

/**
 * The width declarations one sizing rule writes onto the popover. Both properties are always set, since the
 * element is styled in place and whichever the other rule used has to be cleared rather than left standing.
 */
type PopoverWidthStyle = {
  /** The width to hold, or empty to grow to what it holds. */
  width: string
  /** The width to grow from, or empty to claim none. */
  minWidth: string
}

/**
 * How each rule sizes the popover, against the width of the trigger it hangs under and the room the
 * viewport leaves beside it.
 */
const POPOVER_WIDTH_STYLES: Record<
  FacetPopoverWidth,
  (referenceWidth: number, availableWidth: number) => PopoverWidthStyle
> = {
  trigger: (referenceWidth) => ({ width: `${referenceWidth}px`, minWidth: '' }),
  content: (referenceWidth, availableWidth) => ({
    width: '',
    // Never past what the viewport offers, since a minimum outranks a maximum in CSS
    minWidth: `${Math.min(availableWidth, Math.max(POPOVER_MIN_WIDTH, referenceWidth))}px`,
  }),
}

/**
 * Whether the trigger takes focus back after a popover closes this way.
 *
 * Escape and a second click on the trigger both leave the reader standing where they started, which
 * is where focus belongs. The rest close a popover by pointing somewhere else or tabbing past it,
 * and there the reader has already said where their attention is going.
 */
const FOCUS_RETURNS_TO_TRIGGER = {
  'escape-key': true,
  click: true,
  'outside-press': false,
  'reference-press': false,
  'ancestor-scroll': false,
  'focus-out': false,
  hover: false,
  focus: false,
  'list-navigation': false,
  'safe-polygon': false,
} satisfies Record<OpenChangeReason, boolean>

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
  refs: UseFloatingReturn['refs']
  /** Positioning styles for the popover element. */
  floatingStyles: CSSProperties
  /** Floating-ui's shared interaction context. */
  context: FloatingContext
  /** Props the trigger has to spread. */
  getReferenceProps: ReturnType<typeof useInteractions>['getReferenceProps']
  /** Props the popover has to spread. */
  getFloatingProps: ReturnType<typeof useInteractions>['getFloatingProps']
  /** Where focus lands as the popover opens. */
  initialFocus: FloatingFocusManagerProps['initialFocus']
  /** Puts the caret in the search box, where the device has a keyboard to type on. */
  focusSearchBox: () => void
}

/**
 * Runs a facet's popover: whether it is open, where it sits, how wide and tall it may be, and
 * the search term narrowing its options.
 *
 * @param options - Every option the facet can offer, before searching.
 * @param width - Whether the popover takes its trigger's width, or a width of its own.
 * @returns The state and bindings described by {@link UseFacetPopoverResult}.
 */
export function useFacetPopover<T extends FacetOption>(
  options: T[],
  width: FacetPopoverWidth = 'trigger'
): UseFacetPopoverResult<T> {
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
    // A phone answers a caret with a soft keyboard covering the list that just opened
    if (isMobileOS) return

    // Everywhere else the caret starts in the search box, ready to type
    searchRef.current?.focus()
  }, [isMobileOS])

  // Why the popover last closed, which is what decides whether the trigger takes focus back
  const closeReason = useRef<OpenChangeReason | undefined>(undefined)

  // The options left once the search term has been applied
  const filtered = useMemo(() => filterOptionsBySearch(options, query), [options, query])

  // Whether the list is long enough to read better at a settled height than hugging its content
  const shouldUseMinHeight = filtered.length > MIN_HEIGHT_OPTIONS_THRESHOLD

  // Positioning: under the trigger where the page has room below it, and above it where it does not.
  // The side is pinned, since searching, collapsing a section and expanding a tree node all resize the
  // popover while it stands open.
  const { refs, floatingStyles, context, placement } = useFloatingPanel({
    open,
    onOpenChange: (nextOpen, _event, reason) => {
      // Only a close has a reason worth keeping, and recording an opening one would leave it standing
      // as the answer for whatever closes the popover next
      closeReason.current = nextOpen ? undefined : reason

      // What the interaction asked for
      setOpen(nextOpen)
    },
    placement: 'bottom-start',
    fallbackPlacements: ['top-start'],
    pinSide: true,
    strategy: 'fixed',
    gap: 8,
    padding: 8,
    // Sized to the trigger, or to its own content, and to whatever height the viewport allows. The
    // height cap is load-bearing: the side is settled on before the popover has finished dressing
    // itself, so it is chosen against a panel shorter than the one that ends up standing there.
    applySize({ availableHeight, availableWidth, rects, elements }) {
      // Written straight onto the element, since these change as the page moves
      Object.assign(elements.floating.style, {
        // Never past what the viewport offers, since a minimum outranks a maximum in CSS
        minHeight: shouldUseMinHeight
          ? `${Math.min(POPOVER_MIN_HEIGHT, availableHeight)}px`
          : 'auto',
        maxHeight: `${Math.min(POPOVER_MAX_HEIGHT, availableHeight)}px`,
        // Growing to what it holds still has to stop at the viewport's edge: nudging it along can move an
        // over-wide panel but never shrink it, and its rows only start truncating once something does.
        maxWidth: `${availableWidth}px`,
        // Sized by the rule this popover was set up with
        ...POPOVER_WIDTH_STYLES[width](rects.reference.width, availableWidth),
      })
    },
  })

  // Opens on a click of the trigger
  const click = useClick(context)

  // Closes on Escape or on a click landing anywhere else
  const dismiss = useDismiss(context, { outsidePress: true, escapeKey: true })

  // Announced as a dialog, since the popover holds controls rather than just a list
  const role = useRole(context, { role: 'dialog' })

  // The three behaviours merged into one set of props per element
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role])

  // Whether the popover was up on the render before, which is what makes a close a close rather than
  // the state it has sat in since the page loaded
  const wasOpen = useRef(false)

  // Hand focus back to the trigger as the popover goes
  useEffect(() => {
    // An open popover has nothing to hand back yet
    if (open) {
      // Record it, so the next closed render reads as a close
      wasOpen.current = true
      return
    }

    // Closed without ever having been open, which every render before the first click is
    if (!wasOpen.current) return

    // The close is being handled here, so it isn't handled again
    wasOpen.current = false

    // A reopened facet starts from its full option list rather than the last search
    setQuery('')

    // Whether the way it closed asks for the trigger to take focus back. A close with no reason to it
    // is one nothing interactive drove, so it is treated as asking.
    const returnsFocus = closeReason.current ? FOCUS_RETURNS_TO_TRIGGER[closeReason.current] : true

    // Pointing at something else has already put focus where the reader wants it, but pointing at bare
    // page leaves it nowhere, and a popover that drops focus leaves the next Tab at the top of the page
    if (!returnsFocus && document.activeElement !== document.body) return

    // The trigger, which is where the reader was standing before the popover took over
    const trigger = refs.domReference.current

    // Focus is moved rather than restored: Safari never focuses a button on click, so there is
    // nothing to restore to
    if (trigger instanceof HTMLElement) trigger.focus()
  }, [open, refs])

  // Where focus lands as the popover opens: on a phone nowhere inside it, and everywhere else the
  // search box, falling back to the panel itself where the facet is too short to draw one
  const initialFocus = isMobileOS ? -1 : searchRef

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
    initialFocus,
    focusSearchBox,
  }
}
