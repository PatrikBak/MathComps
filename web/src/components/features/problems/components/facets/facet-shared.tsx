import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { useIsomorphicEffect } from '@mantine/hooks'
import { ChevronDown, ChevronUp, FilterX, HelpCircle, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Tooltip } from '@/components/shared/components/Tooltip'
import { TruncatedText } from '@/components/shared/components/TruncatedText'
import { cn } from '@/components/shared/utils/css-utils'
import { useDeviceCapabilities } from '@/hooks/use-device-capabilities'

import { filterOptionsBySearch, getVisibleOptions } from './utils/facet-logic'

// #region Types

/**
 * Represents a selectable option in a facet filter.
 *
 * @property id - Unique identifier for the option.
 * @property displayName - Display name for the option.
 * @property fullName - Optional full name (for tooltips or details).
 * @property count - Optional count of items matching this option.
 * @property groupKey - Optional key for grouping options into sections.
 */
export type FacetOption = {
  id: string
  displayName: string
  fullName?: string
  count?: number
  groupKey?: string
}

/** The type of input to render for each item in the facet list. */
type InputKind = 'checkbox' | 'radio'

// #endregion

// #region UI constants

/** Minimum number of options required to show search functionality. */
export const SEARCH_THRESHOLD = 12

/** Minimum number of visible options required to trigger min height behavior. */
const MIN_HEIGHT_OPTIONS_THRESHOLD = 10

/** Minimum height for facet popovers when threshold is exceeded, in pixels. */
const POPOVER_MIN_HEIGHT = 360

/** Maximum height for facet popovers in pixels. */
const POPOVER_MAX_HEIGHT = 520

/** Centralized Tailwind CSS class names for consistent facet component styling. */
export const facetUI = {
  headerRow: 'flex items-center justify-between gap-2 mb-1 sm:mb-1.5',

  title: 'flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-semibold text-foreground',

  trigger:
    'w-full flex items-center justify-between gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg border border-muted/30 bg-surface/95 text-xs sm:text-sm text-muted-foreground outline-none transition-all hover:border-muted/60 focus:border-focus/60 focus:ring-2 focus:ring-focus/35',

  triggerIconBox: 'shrink-0 text-muted-foreground',

  popover:
    'z-[1000] flex flex-col overflow-hidden rounded-lg border border-foreground/10 bg-surface/95 shadow-2xl backdrop-blur',

  popoverHeader:
    'sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-foreground/10 bg-surface/95 px-2.5 sm:px-3 py-1.5 sm:py-2',

  searchRow:
    'relative flex items-center gap-2 border-b border-foreground/10 bg-surface/95 px-2.5 sm:px-3 py-1.5 sm:py-2',

  searchInputWrapper: 'relative flex-1',
  searchInput:
    'h-8 sm:h-9 w-full rounded-md border border-foreground/10 bg-surface-inset/40 px-2.5 sm:px-3 text-xs sm:text-sm text-foreground placeholder-muted focus:border-focus/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-focus/70',
  searchInputWithClear: 'pr-8 sm:pr-9',
  searchClearButton:
    'absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 rounded text-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus transition-colors',

  itemBase:
    'flex items-center justify-between gap-2 sm:gap-3 rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2 transition-colors',

  itemHover: 'hover:bg-foreground/5',

  itemSelected: 'bg-focus/10 ring-1 ring-inset ring-focus/30',

  itemLabel: 'truncate text-xs sm:text-sm font-medium',

  itemCount: 'text-right text-[10px] sm:text-xs tabular-nums text-muted shrink-0 ml-auto',
}

// #endregion

// #region Core hook

function useFacetBase<T extends FacetOption>(config: {
  options: T[]
  inputKind: InputKind
  selected: string[]
}) {
  const { options, inputKind, selected } = config
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const searchRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const labelId = React.useId()
  const popoverId = React.useId()

  // Detect mobile operating systems where virtual keyboards are intrusive
  const { isMobileOS } = useDeviceCapabilities()

  // Auto-focus input on mount, but only on desktop devices
  // Mobile devices are excluded because virtual keyboards take up significant screen space
  // and can cause jarring layout shifts when triggered automatically
  const focusAppropriateElement = React.useCallback(() => {
    // Skip auto-focus on mobile OS to prevent unwanted keyboard popup
    if (isMobileOS) {
      ;(document.activeElement as HTMLElement)?.blur()
      return
    }

    // Focus search input for better UX
    if (searchRef.current) {
      searchRef.current.focus()
    }
  }, [isMobileOS])

  // Apply auto-focus on component mount
  useIsomorphicEffect(() => {
    focusAppropriateElement()
  }, [focusAppropriateElement])

  const { refs, floatingStyles, context, placement } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({
        fallbackPlacements: ['top-start'],
        padding: 8,
      }),
      shift({ padding: 8 }),
      size({
        apply({ availableHeight, rects, elements }) {
          Object.assign(elements.floating.style, {
            // Enforce min height if there's too many items
            // (so there isn't a very small scroll area for them)
            minHeight: shouldUseMinHeight ? POPOVER_MIN_HEIGHT + 'px' : 'auto',

            // Ensure the popover isn't too large
            maxHeight: Math.min(POPOVER_MAX_HEIGHT, availableHeight),

            // Nothing special to do with the width, just follow the parent
            width: rects.reference.width + 'px',
          })
        },
        padding: 8,
      }),
    ],
  })

  const click = useClick(context)
  const dismiss = useDismiss(context, { outsidePress: true, escapeKey: true })
  const role = useRole(context, { role: 'dialog' })
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role])

  React.useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => {
        focusAppropriateElement()
      }, 10)
      return () => window.clearTimeout(id)
    } else {
      // When closing, immediately blur any focused element to prevent focus ring flash
      if (document.activeElement && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }
    setQuery('')
  }, [open, focusAppropriateElement])

  const filtered = React.useMemo(() => {
    return filterOptionsBySearch(options, query)
  }, [options, query])

  // Calculate visible options count for min height logic
  const visibleOptionsCount = React.useMemo(() => {
    return getVisibleOptions(options, new Set(selected), query).length
  }, [options, selected, query])

  // We wanna use the minimal height iff there's too many components
  const shouldUseMinHeight = React.useMemo(() => {
    return visibleOptionsCount > MIN_HEIGHT_OPTIONS_THRESHOLD
  }, [visibleOptionsCount])

  function focusFirstItem() {
    const first = listRef.current?.querySelector<HTMLInputElement>(`input[type="${inputKind}"]`)
    first?.focus({ preventScroll: true })
  }

  function onListKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.target instanceof HTMLInputElement && e.target.type === 'text') return
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp']
    if (!keys.includes(e.key)) return
    e.preventDefault()

    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLInputElement>(`input[type="${inputKind}"]`) ?? []
    )
    if (items.length === 0) return

    let idx = items.findIndex((el) => el === document.activeElement)
    if (idx === -1) idx = 0

    const page = Math.max(1, Math.floor(items.length / 10))
    switch (e.key) {
      case 'ArrowDown':
        idx = Math.min(items.length - 1, idx + 1)
        break
      case 'ArrowUp':
        idx = Math.max(0, idx - 1)
        break
      case 'Home':
        idx = 0
        break
      case 'End':
        idx = items.length - 1
        break
      case 'PageDown':
        idx = Math.min(items.length - 1, idx + page)
        break
      case 'PageUp':
        idx = Math.max(0, idx - page)
        break
    }
    items[idx]?.focus({ preventScroll: true })
  }

  return {
    open,
    setOpen,
    placement,
    query,
    setQuery,
    filtered,
    visibleOptionsCount,
    searchRef,
    listRef,
    labelId,
    popoverId,
    refs,
    floatingStyles,
    context,
    getReferenceProps,
    getFloatingProps,
    focusFirstItem,
    focusAppropriateElement,
    onListKeyDown,
  }
}

// #endregion

// #region Presentational components

type FacetHeaderProps = {
  /** The title displayed at the top of the facet. */
  title: string
  /** A unique ID for the h3 element, used for ARIA labeling. */
  labelId: string
  /** The number of currently selected options. */
  selectedCount: number
  /** Whether any options are currently selected. */
  anySelected: boolean
  /** Callback to clear all selections. */
  onClear: () => void
  /**
   * Hides the "Clear" button while preserving its layout space.
   * Useful for popovers that open upwards, where the header is at the bottom.
   * @default false
   */
  suppressClear?: boolean
  /** Optional text to display in a tooltip next to the title. */
  titleTooltip?: string
  /** Optional custom CSS class for the title container. */
  titleClassName?: string
}

/**
 * Renders the header for a facet, including the title, an optional tooltip,
 * and a "Clear" button.
 */
export function FacetHeader({
  title,
  labelId,
  anySelected: isDirty,
  onClear,
  suppressClear = false,
  titleTooltip,
  titleClassName,
}: FacetHeaderProps) {
  const showClearVisible = isDirty && !suppressClear
  const tFilters = useTranslations('ui.filters')

  return (
    <div className={facetUI.headerRow}>
      <div className={cn(facetUI.title, titleClassName)}>
        <h3 id={labelId} className="flex-1">
          {title}
        </h3>
        {titleTooltip && (
          <Tooltip placement="top" content={titleTooltip}>
            <HelpCircle className="h-4 w-4 cursor-help text-muted/80" />
          </Tooltip>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClear}
            className={cn(
              'inline-flex h-6 sm:h-7 items-center gap-0.5 sm:gap-1 rounded-md px-1.5 sm:px-2 text-[11px] sm:text-[12px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus whitespace-nowrap',
              !showClearVisible && 'invisible pointer-events-none'
            )}
            aria-label={tFilters('resetSelection', { name: title })}
            title={tFilters('reset')}
          >
            <FilterX className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="hidden sm:inline">{tFilters('reset')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

type FacetTriggerProps = {
  open: boolean
  refs: ReturnType<typeof useFloating>['refs']
  getReferenceProps: ReturnType<typeof useInteractions>['getReferenceProps']
  closedLabel: string
  title?: string
  /** Optional selected-count badge shown inside the trigger when > 0. */
  count?: number
  /** When true, the trigger is visually disabled and non-interactive. */
  disabled?: boolean
}

/** Trigger button that opens/closes the facet popover. */
function FacetTrigger(props: FacetTriggerProps) {
  const { open, refs, getReferenceProps, closedLabel, title, disabled = false, count = 0 } = props
  const tFilters = useTranslations('ui.filters')
  return (
    <button
      ref={refs.setReference}
      {...getReferenceProps()}
      type="button"
      className={cn(
        facetUI.trigger,
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
      )}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={
        open
          ? tFilters('closePopover')
          : title
            ? tFilters('openPopover', { name: title.toLowerCase() })
            : undefined
      }
      aria-disabled={disabled || undefined}
      disabled={disabled}
    >
      {/* Left: constant label + dynamic count pill */}
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

      {/* Right: chevron state icon */}
      <span className={facetUI.triggerIconBox}>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
        )}
      </span>
    </button>
  )
}

type FacetPopoverProps = {
  open: boolean
  context: ReturnType<typeof useFloating>['context']
  refs: ReturnType<typeof useFloating>['refs']
  floatingStyles: React.CSSProperties
  getFloatingProps: ReturnType<typeof useInteractions>['getFloatingProps']
  popoverId: string
  labelId: string
  children: React.ReactNode
}

function FacetPopover(props: FacetPopoverProps) {
  const { open, context, refs, floatingStyles, getFloatingProps, popoverId, labelId, children } =
    props

  if (!open) return null

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal={true} returnFocus={false}>
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps({ id: popoverId, 'aria-labelledby': labelId })}
          className={cn(facetUI.popover, 'facet-popover-override')}
        >
          {children}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  )
}

type FacetPopoverHeaderProps = {
  title: string
  onClear: () => void
  count: () => number
}

function FacetPopoverHeader({ title, onClear, count }: FacetPopoverHeaderProps) {
  const tFilters = useTranslations('ui.filters')
  return (
    <div className={facetUI.popoverHeader}>
      <div className="min-w-0">
        <span className="text-xs sm:text-sm font-medium text-foreground">{title}</span>
      </div>
      <div className="w-[80px] sm:w-[96px] flex justify-end">
        <button
          type="button"
          onClick={onClear}
          className={cn(
            'inline-flex h-7 sm:h-8 items-center gap-1 rounded-md px-1.5 sm:px-2 text-[11px] sm:text-xs text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus whitespace-nowrap',
            count() == 0 && 'invisible pointer-events-none'
          )}
          aria-label={tFilters('resetFilter')}
          title={tFilters('reset')}
        >
          <FilterX className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          <span>
            {tFilters('reset')} ({count()})
          </span>
        </button>
      </div>
    </div>
  )
}

type FacetSearchRowProps = {
  query: string
  setQuery: (v: string) => void
  searchRef: React.RefObject<HTMLInputElement | null>
  title: string
  placeholder?: string
  onArrowDownToList: () => void
}

/**
 * Search input row component for facet filters.
 * Includes a clear button that appears when there's text in the search field.
 *
 * @param props - Component properties defined by {@link FacetSearchRowProps}.
 * @returns React element rendering a search input with optional clear button.
 */
function FacetSearchRow(props: FacetSearchRowProps) {
  const { query, setQuery, searchRef, title, placeholder, onArrowDownToList } = props
  const tFilters = useTranslations('ui.filters')

  // A function to clear the searchbox
  const handleClear = React.useCallback(() => {
    // Setup empty query
    setQuery('')
    // Refocus the input after clearing for better UX
    searchRef.current?.focus()
  }, [setQuery, searchRef])

  return (
    <div className={facetUI.searchRow}>
      <div className={facetUI.searchInputWrapper}>
        <input
          ref={searchRef as React.RefObject<HTMLInputElement>}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Arrow-down goes to the list
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              onArrowDownToList()
            }
            // Allow Escape key to clear the search
            if (event.key === 'Escape' && query.length > 0) {
              event.preventDefault()
              handleClear()
            }
          }}
          aria-label={tFilters('searchIn', { name: title.toLowerCase() })}
          placeholder={placeholder ?? tFilters('search')}
          className={cn(facetUI.searchInput, query.length > 0 && facetUI.searchInputWithClear)}
        />
        {/** The X button */}
        {query.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className={facetUI.searchClearButton}
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

type FacetListContainerProps = {
  role: 'group' | 'radiogroup'
  labelId: string
  listRef: React.RefObject<HTMLDivElement | null>
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
  children: React.ReactNode
  /** When true, removes top padding from the container. Useful when grouping is enabled. */
  noTopPadding?: boolean
}

function FacetListContainer(props: FacetListContainerProps) {
  const { role, labelId, listRef, onKeyDown, children, noTopPadding = false } = props
  return (
    <div
      ref={listRef}
      className={cn(
        'max-h-[32vh] overflow-y-auto',
        noTopPadding ? 'px-0.5 sm:px-1 pb-0.5 sm:pb-1' : 'p-0.5 sm:p-1'
      )}
      role={role}
      aria-labelledby={labelId}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  )
}

/**
 * Wrapper for TruncatedText that ensures proper flex behavior in facet items.
 * The min-w-0 wrapper allows the text to shrink below its content width,
 * enabling proper truncation in flex containers.
 *
 * @param children - The text content to display
 */
function FacetItemLabel({ children }: { children: string }) {
  return (
    <div className="min-w-0 pr-3">
      <TruncatedText className={facetUI.itemLabel}>{children}</TruncatedText>
    </div>
  )
}

// #endregion

// #region Exports

export {
  FacetItemLabel,
  FacetListContainer,
  FacetPopover,
  FacetPopoverHeader,
  FacetSearchRow,
  FacetTrigger,
  useFacetBase,
}

// #endregion
