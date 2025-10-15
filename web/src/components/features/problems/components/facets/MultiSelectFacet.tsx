import * as React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import type { FacetOption } from './facet-shared'
import {
  FacetHeader,
  FacetListContainer,
  FacetPopover,
  FacetPopoverHeader,
  FacetSearchRow,
  FacetTrigger,
  facetUI,
  SEARCH_THRESHOLD,
  useFacetBase,
} from './facet-shared'
import { toggleOptionSelection } from './utils/facet-logic'

/** An option for the `MultiSelectFacet`. It extends the base `FacetOption`. */
export type MultiSelectFacetOption = FacetOption
/** The logical mode for combining multiple selected options. */
type MultiSelectFacetMode = 'or' | 'and'

/** Configuration for logic toggle behavior. */
type MultiSelectFacetLogicConfig = {
  /** When true, the logic toggle is enabled. @default true */
  enabled?: boolean
  /** The current logic mode ('or' or 'and'). */
  mode: MultiSelectFacetMode
  /** Callback to handle mode changes. */
  onChange: (next: MultiSelectFacetMode) => void
  /** Custom labels for the toggle buttons. */
  labels?: {
    or?: string
    and?: string
  }
}

type MultiSelectFacetProps = {
  /** The title of the facet, displayed above the trigger. */
  title: string
  /** The list of options to display in the facet. */
  options: MultiSelectFacetOption[]
  /** An array of the currently selected option IDs. */
  selected: string[]
  /** Callback function invoked when the selected values change. */
  onChange: (next: string[]) => void
  /** Placeholder text for the search input. */
  searchPlaceholder?: string
  /** Additional CSS class name to apply to the root element. */
  className?: string
  /** Whether to show the search input in the popover. @default true */
  showSearch?: boolean
  /** When true, the facet is rendered but cannot be opened/changed. */
  disabled?: boolean
  /** Text to show on the closed trigger button. */
  closedLabel: string
  /** Configuration for the AND/OR logic toggle. */
  logic?: MultiSelectFacetLogicConfig
  /** Show search when option count ≥ this threshold. @default SEARCH_THRESHOLD */
  searchThreshold?: number
  /** When false, hides per-option counts from the list UI. @default true */
  showCounts?: boolean
  /** Optional text to display in a tooltip next to the title. */
  titleTooltip?: string
}

/**
 * A facet component that allows selecting multiple values from a list of options.
 * It includes features like searching, clearing selections, and an optional logic toggle
 * for AND/OR filtering.
 *
 * @param {MultiSelectFacetProps} props - The props for the component.
 */
export default function MultiSelectFacet({
  title,
  options,
  selected,
  onChange,
  searchPlaceholder = 'Hľadať…',
  className,
  showSearch = true,
  disabled = false,
  closedLabel,
  logic,
  searchThreshold = SEARCH_THRESHOLD,
  showCounts = true,
  titleTooltip,
}: MultiSelectFacetProps) {
  // Create the facet which handled internal logic
  const facet = useFacetBase<MultiSelectFacetOption>({
    options,
    inputKind: 'checkbox',
    selected,
  })

  // We'll keep track of the way options are displayed since we wanna sort
  const [currentOptions, setCurrentOptions] = React.useState(options)

  // Capture the current selected state and filtered options without making them dependencies
  const selectedRef = React.useRef(selected)
  const filteredRef = React.useRef(facet.filtered)
  selectedRef.current = selected
  filteredRef.current = facet.filtered

  // This effect handles the one-time sort when the popover opens.
  React.useEffect(() => {
    // Only run this logic when the popover transitions from closed to open
    // or when the user deleted the content of the search filter
    if (facet.open || !facet.query) {
      // Sort with selected items first - use refs to get current state
      setCurrentOptions(
        [...filteredRef.current].sort((a, b) => {
          const aSelected = selectedRef.current.includes(a.id)
          const bSelected = selectedRef.current.includes(b.id)

          // If both are selected or both are unselected, maintain original order
          if (aSelected === bSelected) return 0

          // Selected items come first
          return aSelected ? -1 : 1
        })
      )
    }
  }, [facet.open, facet.query])

  // This effect keeps the list in sync with the search filter.
  React.useEffect(() => {
    // If the popover is closed OR if there's a search query,
    // the displayed options should always match the filtered list.
    // This correctly resets the list when closed and allows searching to work.
    if (!facet.open || facet.query) {
      setCurrentOptions(facet.filtered)
    }
  }, [facet.filtered, facet.query, facet.open])

  // A helper function to reset the facet
  function clearAll() {
    if (selected.length) onChange([])
    if (facet.query.length) facet.setQuery('')
    if (facet.open) facet.focusAppropriateElement()

    // Reset to original options order when reset is pressed
    setCurrentOptions(facet.filtered)
  }

  function LogicToggle(props: {
    value: MultiSelectFacetMode
    onChange: (m: MultiSelectFacetMode) => void
    disabled: boolean
  }) {
    const { value, onChange, disabled } = props
    const baseBtn =
      'px-2 sm:px-2.5 h-6 sm:h-7 rounded-md text-[11px] sm:text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
    return (
      <div className="flex items-center justify-between gap-2 border-b border-slate-700 bg-gray-800/95 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs text-slate-400">
        <span className="whitespace-nowrap">Logika</span>
        <div
          className={cn(
            'inline-flex items-center gap-0.5 sm:gap-1 rounded-lg border border-slate-600 p-0.5',
            disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
          )}
          role="radiogroup"
          aria-label="Logika výberu"
          title={disabled ? 'Platí pri ≥ 2 vybraných' : undefined}
        >
          <button
            type="button"
            className={cn(baseBtn, value === 'or' && 'bg-indigo-900 text-white')}
            onClick={() => !disabled && onChange('or')}
            aria-pressed={value === 'or'}
          >
            {logic?.labels?.or ?? 'Aspoň jeden'}
          </button>
          <button
            type="button"
            className={cn(baseBtn, value === 'and' && 'bg-indigo-900 text-white')}
            onClick={() => !disabled && onChange('and')}
            aria-pressed={value === 'and'}
          >
            {logic?.labels?.and ?? 'Všetci'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      <FacetHeader
        title={title}
        labelId={facet.labelId}
        selectedCount={selected.length}
        anySelected={selected.length > 0}
        onClear={clearAll}
        suppressClear={facet.open && facet.placement.startsWith('top')}
        titleTooltip={titleTooltip}
      />

      <FacetTrigger
        open={facet.open}
        refs={facet.refs}
        getReferenceProps={facet.getReferenceProps}
        closedLabel={closedLabel}
        title={title}
        disabled={disabled}
        count={selected.length}
      />

      <FacetPopover
        open={facet.open}
        context={facet.context}
        refs={facet.refs}
        floatingStyles={facet.floatingStyles}
        getFloatingProps={facet.getFloatingProps}
        popoverId={facet.popoverId}
        labelId={facet.labelId}
      >
        {facet.placement.startsWith('top') && (
          <FacetPopoverHeader title={title} onClear={clearAll} count={() => selected.length} />
        )}

        {showSearch && options.length >= searchThreshold && (
          <FacetSearchRow
            query={facet.query}
            setQuery={facet.setQuery}
            searchRef={facet.searchRef}
            title={title}
            placeholder={searchPlaceholder}
            onArrowDownToList={facet.focusFirstItem}
          />
        )}

        {logic && (logic.enabled ?? true) && (
          <LogicToggle
            value={logic.mode}
            onChange={logic.onChange}
            disabled={selected.length <= 1}
          />
        )}

        <FacetListContainer
          role="group"
          labelId={facet.labelId}
          listRef={facet.listRef}
          onKeyDown={facet.onListKeyDown}
        >
          {facet.filtered.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-400">Žiadne výsledky</div>
          )}
          {(() => {
            return currentOptions.map((option) => {
              const checked = selected.includes(option.id)
              const isZeroCount = typeof option.count === 'number' && option.count <= 0
              return (
                <label
                  key={option.id}
                  className={cn(
                    facetUI.itemBase,
                    checked ? facetUI.itemSelected : facetUI.itemHover,
                    isZeroCount && 'opacity-50'
                  )}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onChange(toggleOptionSelection(option.id, selected))}
                      className="h-4 w-4 accent-indigo-400"
                    />
                    <span
                      className={facetUI.itemLabel}
                      title={
                        option.fullName && option.fullName !== option.displayName
                          ? option.fullName
                          : undefined
                      }
                    >
                      {option.displayName}
                    </span>
                  </div>
                  {showCounts && typeof option.count === 'number' && (
                    <span className={cn(facetUI.itemCount, 'shrink-0')} aria-hidden="true">
                      {option.count}
                    </span>
                  )}
                </label>
              )
            })
          })()}
        </FacetListContainer>
      </FacetPopover>
    </div>
  )
}
