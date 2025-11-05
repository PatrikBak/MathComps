import { useLongPress } from '@mantine/hooks'
import { ArrowDownAZ, ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import {
  isExclusiveSelection,
  LONG_PRESS_THRESHOLD_MS,
} from '@/components/shared/utils/event-utils'

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

/**
 * Individual option component that can use hooks.
 * Defined outside the main component to ensure it's stable and doesn't need to be in dependency arrays.
 */
const OptionItem = React.memo(function OptionItem({
  option,
  checked,
  isZeroCount,
  onExclusiveSelect,
  onToggle,
  showCounts,
}: {
  option: MultiSelectFacetOption
  checked: boolean
  isZeroCount: boolean
  onExclusiveSelect: () => void
  onToggle: () => void
  showCounts: boolean
}) {
  const handleClick = (event: React.MouseEvent<HTMLLabelElement>) => {
    // Ctrl/Cmd+Click: exclusive selection (deselect all others, select only this one)
    if (isExclusiveSelection(event)) {
      event.preventDefault()
      onExclusiveSelect()
      return
    }
    // Normal click: let default behavior happen (checkbox onChange will handle it)
  }

  const handleChange = () => {
    // Normal click: toggle this option in the selection
    onToggle()
  }

  // Long-press handler for exclusive selection on mobile
  const longPressHandlers = useLongPress(
    () => {
      onExclusiveSelect()
    },
    {
      threshold: LONG_PRESS_THRESHOLD_MS,
    }
  )

  return (
    <label
      key={option.id}
      className={cn(
        facetUI.itemBase,
        // Apply selected or hover styling based on checked state
        checked ? facetUI.itemSelected : facetUI.itemHover,
        // Dim options with zero count
        isZeroCount && 'opacity-50',
        'select-none'
      )}
      onClick={handleClick}
      {...longPressHandlers}
    >
      {/* Left side: checkbox + label */}
      <div className="min-w-0 flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          className="form-checkbox"
        />
        <span
          className={facetUI.itemLabel}
          // Show full name as tooltip if it differs from display name
          title={
            option.fullName && option.fullName !== option.displayName ? option.fullName : undefined
          }
        >
          {option.displayName}
        </span>
      </div>
      {/* Right side: count badge (if enabled and available) */}
      {showCounts && typeof option.count === 'number' && (
        <span className={cn(facetUI.itemCount, 'shrink-0')} aria-hidden="true">
          {option.count}
        </span>
      )}
    </label>
  )
})
/** The logical mode for combining multiple selected options. */
type MultiSelectFacetMode = 'or' | 'and'
/** Shared sort modes configuration with order, icons, and labels */
const SORT_MODES = [
  { key: 'alpha' as const, icon: ArrowDownAZ, label: 'Zoradiť podľa názvu (A-Z)' },
  {
    key: 'count-desc' as const,
    icon: ArrowDownWideNarrow,
    label: 'Zoradiť podľa počtu (zostupne)',
  },
  { key: 'count-asc' as const, icon: ArrowUpNarrowWide, label: 'Zoradiť podľa počtu (vzostupne)' },
] as const

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
  /**
   * Configuration for grouping options into sections.
   * Provide an array of group keys in display order and a mapping of keys to labels.
   * @example { keys: ['area', 'type'], labels: { area: 'Area', type: 'Type' } }
   */
  grouping?: {
    /** Array of group keys in the order they should be displayed */
    keys: string[]
    /** Mapping of group keys to display labels */
    labels: Record<string, string>
  }
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
  grouping,
}: MultiSelectFacetProps) {
  // Create the facet which handled internal logic
  const facet = useFacetBase<MultiSelectFacetOption>({
    options,
    inputKind: 'checkbox',
    selected,
  })

  // We'll keep track of the way options are displayed since we wanna sort
  const [currentOptions, setCurrentOptions] = React.useState(options)

  // Track sort mode for each group (only used when grouping is enabled)
  const [groupSortModes, setGroupSortModes] = React.useState<
    Record<string, (typeof SORT_MODES)[number]['key']>
  >(() => {
    if (!grouping) return {}
    const initial: Record<string, (typeof SORT_MODES)[number]['key']> = {}
    grouping.keys.forEach((key) => {
      initial[key] = SORT_MODES[0].key
    })
    return initial
  })

  // Track collapsed state for each group (only used when grouping is enabled)
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>(() => {
    if (!grouping) return {}
    const initial: Record<string, boolean> = {}
    grouping.keys.forEach((key) => {
      initial[key] = false // All groups start expanded
    })
    return initial
  })

  // Capture the current selected state and filtered options without making them dependencies
  const selectedRef = React.useRef(selected)
  const filteredRef = React.useRef(facet.filtered)
  selectedRef.current = selected
  filteredRef.current = facet.filtered

  // Store the collapse state before search starts, so we can restore it when search stops
  const preSearchCollapseStateRef = React.useRef<Record<string, boolean> | null>(null)
  // Track the previous query to detect when search starts/stops
  const previousQueryRef = React.useRef<string>('')
  // Capture the current collapsed groups state to read it synchronously
  const collapsedGroupsRef = React.useRef(collapsedGroups)
  collapsedGroupsRef.current = collapsedGroups

  /**
   * Helper function to group options by their groupKey.
   * Returns a map of group keys to arrays of options.
   */
  const groupOptions = React.useCallback(
    (opts: MultiSelectFacetOption[]) => {
      if (!grouping) return {}

      // Initialize groups based on provided keys
      const groups: Record<string, MultiSelectFacetOption[]> = {}
      grouping.keys.forEach((key) => {
        groups[key] = []
      })

      // Distribute options into groups
      opts.forEach((option) => {
        if (option.groupKey && groups[option.groupKey]) {
          groups[option.groupKey].push(option)
        }
      })

      // Sort options within each group based on the group's sort mode
      Object.keys(groups).forEach((key) => {
        const sortMode = groupSortModes[key] || SORT_MODES[0].key

        groups[key].sort((a, b) => {
          switch (sortMode) {
            case 'alpha':
              return a.displayName.localeCompare(b.displayName, 'sk', { sensitivity: 'base' })

            case 'count-desc':
            case 'count-asc': {
              const aCount = typeof a.count === 'number' ? a.count : 0
              const bCount = typeof b.count === 'number' ? b.count : 0
              // If counts are equal, fall back to alphabetical
              if (aCount === bCount) {
                return a.displayName.localeCompare(b.displayName, 'sk', { sensitivity: 'base' })
              }
              return sortMode === 'count-desc' ? bCount - aCount : aCount - bCount
            }

            default:
              throw new Error(`Unknown sort mode: ${sortMode}`)
          }
        })
      })

      return groups
    },
    [grouping, groupSortModes]
  )
  // This effect handles the one-time sort when the popover opens.
  React.useEffect(() => {
    // Only run this logic when the popover transitions from closed to open
    // or when the user deleted the content of the search filter
    if (facet.open || !facet.query) {
      // Use setTimeout to make sorting asynchronous and prevent UI blocking
      const timeoutId = setTimeout(() => {
        // Skip selected-first sorting when grouping is enabled
        // (sections maintain their own alphabetical order)
        if (grouping) {
          setCurrentOptions(filteredRef.current)
        } else {
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
      }, 0)

      return () => clearTimeout(timeoutId)
    }
  }, [facet.open, facet.query, grouping])

  // This effect keeps the list in sync with the search filter.
  React.useEffect(() => {
    // If the popover is closed OR if there's a search query,
    // the displayed options should always match the filtered list.
    // This correctly resets the list when closed and allows searching to work.
    if (!facet.open || facet.query) {
      setCurrentOptions(facet.filtered)
    }
  }, [facet.filtered, facet.query, facet.open])

  // This effect manages group collapse state based on search query.
  // When searching, all groups containing matching results are expanded.
  // When search stops, groups return to their previous state before search started.
  React.useEffect(() => {
    // Only apply this logic when grouping is enabled
    if (!grouping) return

    const wasSearching = previousQueryRef.current.length > 0
    const isSearching = facet.query.length > 0

    // Detect transition from no search to search (search started)
    if (!wasSearching && isSearching) {
      // Save current collapse state before modifying it
      preSearchCollapseStateRef.current = { ...collapsedGroupsRef.current }
    }

    // Detect transition from search to no search (search stopped)
    if (wasSearching && !isSearching) {
      // Restore the previous state
      if (preSearchCollapseStateRef.current !== null) {
        setCollapsedGroups(preSearchCollapseStateRef.current)
        preSearchCollapseStateRef.current = null
      }
      // Update the previous query ref before returning
      previousQueryRef.current = facet.query
      return
    }

    // When searching: expand groups with results
    if (isSearching) {
      const groups = groupOptions(facet.filtered)
      const groupsWithResults = new Set<string>()

      // Find all groups that have matching results
      Object.keys(groups).forEach((key) => {
        if (groups[key] && groups[key].length > 0) {
          groupsWithResults.add(key)
        }
      })

      // Expand all groups with results
      setCollapsedGroups((prev) => {
        const next = { ...prev }
        grouping.keys.forEach((key) => {
          // Collapse groups without results, expand those with results
          next[key] = !groupsWithResults.has(key)
        })
        return next
      })
    }

    // Update the previous query ref
    previousQueryRef.current = facet.query
  }, [facet.query, facet.filtered, grouping, groupOptions])

  // A helper function to reset the facet
  function clearAll() {
    if (selected.length) onChange([])
    if (facet.query.length) facet.setQuery('')
    if (facet.open) facet.focusAppropriateElement()

    // Reset to original options order when reset is pressed
    setCurrentOptions(facet.filtered)
  }

  const renderOption = React.useCallback(
    (option: MultiSelectFacetOption) => {
      // Check if this option is currently selected
      const checked = selected.includes(option.id)
      // Determine if the option has zero matches (for visual dimming)
      const isZeroCount = typeof option.count === 'number' && option.count <= 0

      return (
        <OptionItem
          key={option.id}
          option={option}
          checked={checked}
          isZeroCount={isZeroCount}
          onExclusiveSelect={() => onChange([option.id])}
          onToggle={() => onChange(toggleOptionSelection(option.id, selected))}
          showCounts={showCounts}
        />
      )
    },
    [onChange, selected, showCounts]
  )

  /**
   * Toggles the collapsed state of a group
   */
  function toggleGroupCollapse(groupKey: string) {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }))
  }

  /**
   * Cycles through sort modes: alpha -> count-desc -> count-asc -> alpha
   */
  function cycleSortMode(groupKey: string) {
    setGroupSortModes((prev) => {
      const current = prev[groupKey] || SORT_MODES[0].key
      const currentIndex = SORT_MODES.findIndex((mode) => mode.key === current)
      const nextIndex = (currentIndex + 1) % SORT_MODES.length
      const next = SORT_MODES[nextIndex].key
      return { ...prev, [groupKey]: next }
    })
  }

  /**
   * Renders a sort toggle button for a group header
   */
  function GroupSortButton({ groupKey }: { groupKey: string }) {
    // Get the current sort mode for this group, defaulting to the first mode if not set
    const sortMode = groupSortModes[groupKey] || SORT_MODES[0].key

    // Find the matching sort mode configuration, or fall back to the first mode
    const currentMode =
      SORT_MODES.find((sortModeConfig) => sortModeConfig.key === sortMode) || SORT_MODES[0]

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          cycleSortMode(groupKey)
        }}
        className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        title={currentMode.label}
        aria-label={currentMode.label}
      >
        <currentMode.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </button>
    )
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
          noTopPadding={!!grouping}
        >
          {facet.filtered.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-400">Žiadne výsledky</div>
          )}
          {(() => {
            // Render options with or without sections based on grouping prop
            if (grouping) {
              const groups = groupOptions(currentOptions)
              const visibleGroups = grouping.keys
                .map((groupKey) => ({ groupKey, options: groups[groupKey] || [] }))
                .filter(({ options }) => options.length > 0)

              return (
                <>
                  {visibleGroups.map(({ groupKey, options: sectionOptions }) => {
                    const isCollapsed = collapsedGroups[groupKey] || false

                    // Count how many selected items are in this group
                    const selectedCount = sectionOptions.filter((option) =>
                      selected.includes(option.id)
                    ).length

                    return (
                      <div key={groupKey}>
                        <div
                          className="-mx-0.5 sm:-mx-1 px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-white border-b border-slate-700 bg-gray-800 sticky top-0 z-10 flex items-center gap-2 cursor-pointer"
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleGroupCollapse(groupKey)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              toggleGroupCollapse(groupKey)
                            }
                          }}
                          aria-expanded={!isCollapsed}
                          aria-label={isCollapsed ? 'Rozbaliť skupinu' : 'Zbaliť skupinu'}
                        >
                          <ChevronDown
                            className={cn(
                              'h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform duration-200',
                              isCollapsed && '-rotate-90'
                            )}
                            aria-hidden="true"
                          />
                          <span className="flex-1 text-left flex items-center gap-2">
                            {grouping.labels[groupKey]}
                            {selectedCount > 0 && (
                              <span
                                className="shrink-0 rounded-full bg-white/10 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-[11px] leading-none"
                                aria-label={`${selectedCount} vybraných`}
                              >
                                {selectedCount}
                              </span>
                            )}
                          </span>
                          <GroupSortButton groupKey={groupKey} />
                        </div>
                        {!isCollapsed && sectionOptions.map(renderOption)}
                      </div>
                    )
                  })}
                </>
              )
            } else {
              // Original linear list rendering
              return currentOptions.map(renderOption)
            }
          })()}
        </FacetListContainer>
      </FacetPopover>
    </div>
  )
}
