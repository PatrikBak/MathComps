import {
  type FloatingContext,
  type FloatingFocusManagerProps,
  type OpenChangeReason,
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

import { focusForReader } from '@/components/shared/utils/focus-utils'
import { useDeviceCapabilities } from '@/hooks/use-device-capabilities'
import { useFloatingPanel } from '@/hooks/use-floating-panel'

import { searchMatcher } from '../model/facet-logic'
import type { FacetOption } from '../model/facet-types'
import type { UseFacetRowNavigationResult } from './use-facet-row-navigation'

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
 * What a facet's popover is set up from.
 */
export type UseFacetPopoverOptions<T extends FacetOption> = {
  /** Every option the facet can offer, before searching. */
  options: T[]
  /** Whether the popover takes its trigger's width, or a width of its own. */
  width: FacetPopoverWidth
}

/**
 * The popover machinery a facet needs.
 */
export type UseFacetPopoverResult<T extends FacetOption> = {
  /** Whether the popover is showing. */
  open: boolean
  /** Shows or hides the popover. */
  setOpen: (open: boolean) => void
  /** Whether the popover stands open above its trigger. */
  isOpenAbove: boolean
  /** What the user has typed into the search box. */
  query: string
  /** The term the facet is narrowed by: what the user typed, without the whitespace around it. */
  searchTerm: string
  /** Replaces what the user has typed. */
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
 * @param options - What the popover is set up from.
 * @returns The state and bindings described by {@link UseFacetPopoverResult}.
 */
export function useFacetPopover<T extends FacetOption>({
  options,
  width,
}: UseFacetPopoverOptions<T>): UseFacetPopoverResult<T> {
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

  // The term the facet is narrowed by, which whitespace alone leaves empty
  const searchTerm = query.trim()

  // The options left once the search term has been applied
  const filtered = useMemo(() => {
    // What an option's names have to carry for it to stay
    const matches = searchMatcher(searchTerm)

    // The options passing the term's matcher, or every option for an empty term
    return matches ? options.filter(matches) : options
  }, [options, searchTerm])

  // Whether the list is long enough to read better at a settled height than hugging its content
  const shouldUseMinHeight = filtered.length > MIN_HEIGHT_OPTIONS_THRESHOLD

  // Positioning: under the trigger where the page has room below it, and above it where it does not.
  // The side is pinned, since searching, collapsing a section and expanding a tree node all resize the
  // popover while it stands open.
  const { refs, floatingStyles, context, placement } = useFloatingPanel({
    open,
    onOpenChange: (nextOpen, event, reason) => {
      // An Escape a control inside has already answered, the search box emptying itself on one, is spent there
      if (!nextOpen && reason === 'escape-key' && event?.defaultPrevented) return

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

    // Pointing or tabbing somewhere else puts focus wherever the reader went, and the page stays where they left it
    if (!returnsFocus) return

    // The trigger, which is where the reader was standing before the popover took over
    const trigger = refs.domReference.current

    // Focus is moved rather than restored: Safari never focuses a button on click, so there is
    // nothing to restore to
    if (trigger instanceof HTMLElement) focusForReader(trigger)
  }, [open, refs])

  // Where focus lands as the popover opens: on a phone nowhere inside it, and everywhere else the
  // search box, falling back to the panel itself where the facet is too short to draw one
  const initialFocus = isMobileOS ? -1 : searchRef

  // Whether the popover stands open above its trigger
  const isOpenAbove = open && placement.startsWith('top')

  // The popover's state, plus everything the trigger and panel have to spread
  return {
    open,
    setOpen,
    isOpenAbove,
    query,
    searchTerm,
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

/**
 * What a facet's reset works on.
 */
export type ResetFacetOptions = {
  /** Ids of the options currently selected. */
  selected: string[]
  /** Applies a new selection. */
  onChange: (next: string[]) => void
  /** The facet's popover, holding the search box and the trigger. */
  popover: Pick<
    UseFacetPopoverResult<FacetOption>,
    'open' | 'query' | 'setQuery' | 'searchRef' | 'focusSearchBox' | 'refs'
  >
  /** The facet's list of rows. */
  list: Pick<UseFacetRowNavigationResult, 'listRef' | 'focusFirstRow'>
}

/**
 * Empties a facet's selection and its search box, moves focus off the reset that held it, and returns its list to
 * the top.
 *
 * @param options - What the reset works on.
 */
export function resetFacet({ selected, onChange, popover, list }: ResetFacetOptions) {
  // Drop the selection
  if (selected.length) onChange([])

  // Drop the search term, so every option is back
  if (popover.query.length) popover.setQuery('')

  // The reset that held focus fades once nothing is left to reset, so focus moves on before it goes
  if (popover.open) {
    // The caret back in the search box, ready to type, or the top of the list where there is no box
    if (popover.searchRef.current) popover.focusSearchBox()
    else list.focusFirstRow()
  } else {
    // The facet's trigger, where the next Tab goes on from
    const trigger = popover.refs.domReference.current

    // Focus onto the trigger
    if (trigger instanceof HTMLElement) focusForReader(trigger)
  }

  // The list may be scrolled far down, which would hide the options now on offer
  if (list.listRef.current) {
    list.listRef.current.scrollTop = 0
  }
}
