import { ArrowDownAZ, ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import * as React from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { isExclusiveSelection } from '@/components/shared/utils/event-utils'
import { useSmartLongPress } from '@/hooks/use-smart-long-press'

import type { FacetOption } from './facet-shared'
import {
  FacetHeader,
  FacetItemLabel,
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

/**
 * Option data consumed by {@link MultiSelectFacet}. It extends the shared {@link FacetOption}.
 */
export type MultiSelectFacetOption = FacetOption

/**
 * Props for the {@link OptionItem} component that renders a selectable facet option.
 */
type OptionItemProps = {
  /** Facet data from {@link MultiSelectFacetOption} that provides labels, identifiers, and counts. */
  option: MultiSelectFacetOption
  /** Indicates whether this {@link MultiSelectFacetOption} is currently selected. */
  checked: boolean
  /** Flags that the option has no matching results and should appear muted in {@link OptionItem}. */
  isZeroCount: boolean
  /** Callback function that updates the selected option identifiers for {@link MultiSelectFacet}. */
  onChange: (next: (previous: string[]) => string[]) => void
}

/**
 * Individual option renderer used inside {@link MultiSelectFacet}.
 *
 * @param props - Component properties defined by {@link OptionItemProps}.
 * @returns React element that renders a selectable option row within {@link FacetListContainer}.
 */
const OptionItem = React.memo(function OptionItem({
  option,
  checked,
  isZeroCount,
  onChange,
}: OptionItemProps) {
  // A function to toggle the selection state of this option (add if not selected, remove if selected)
  const onToggle = React.useCallback(() => {
    onChange((previousSelected) => toggleOptionSelection(option.id, previousSelected))
  }, [onChange, option.id])

  // A function to exclusively select this option (deselect all others)
  const onExclusiveSelect = React.useCallback(() => {
    onChange(() => [option.id])
  }, [onChange, option.id])
  // A function to handle mouse click on the option label
  const handleClick = (event: React.MouseEvent<HTMLLabelElement>) => {
    // Handle execlusive selectton, i.e. only this option intended to be selected
    if (isExclusiveSelection(event)) {
      event.preventDefault()
      onExclusiveSelect()
      return
    }
    // Otherwise, fall through: normal click lets the checkbox handle selection
  }

  // A long-press handler for exclusive selection on touch screens
  const longPressHandlers = useSmartLongPress(() => {
    onExclusiveSelect()
  })

  // A function to handle checkbox state change (user toggled the selection)
  const handleChange = () => {
    onToggle()
  }

  return (
    <div
      className={cn(
        facetUI.itemBase,
        // Highlight style: use "selected" style if checked, otherwise "hover" style
        checked ? facetUI.itemSelected : facetUI.itemHover,
        // Visually dim the option if it has a count of zero (no matches)
        isZeroCount && 'opacity-50',
        'select-none'
      )}
    >
      <label
        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
        onClick={handleClick}
        {...longPressHandlers}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          className="form-checkbox shrink-0"
        />
        <FacetItemLabel>{option.displayName}</FacetItemLabel>
      </label>
      {/* Count badge at the right (if enabled and count is present) */}
      {typeof option.count === 'number' && (
        <span className={facetUI.itemCount} aria-hidden="true">
          {option.count}
        </span>
      )}
    </div>
  )
})

/** Logical modes supported by {@link LogicToggle} within {@link MultiSelectFacet}. */
type MultiSelectFacetMode = 'or' | 'and'

/** Configuration object for the logic toggle rendered by {@link LogicToggle}. */
type MultiSelectFacetLogicConfig = {
  /** When true, the logic toggle is enabled within {@link MultiSelectFacet}. @default true */
  enabled?: boolean
  /** The current logic mode applied by {@link LogicToggle}. */
  mode: MultiSelectFacetMode
  /** Callback to handle mode changes emitted by {@link LogicToggle}. */
  onChange: (next: MultiSelectFacetMode) => void
  /** Custom labels for the buttons inside {@link LogicToggle}. */
  labels?: {
    /** Label displayed when {@link LogicToggle} is in the OR state. */
    or?: string
    /** Label displayed when {@link LogicToggle} is in the AND state. */
    and?: string
  }
}

/** Props consumed by the {@link MultiSelectFacet} component. */
type MultiSelectFacetProps = {
  /** The title displayed in {@link FacetHeader} and {@link FacetTrigger}. */
  title: string
  /** The list of {@link MultiSelectFacetOption} entries to display in the facet. */
  options: MultiSelectFacetOption[]
  /** Array of selected option identifiers drawn from {@link MultiSelectFacetOption.id}. */
  selected: string[]
  /** Callback invoked when selection changes within {@link MultiSelectFacet}. */
  onChange: (next: string[]) => void
  /** Additional CSS class name(s) to apply to the outermost <div> element that wraps the entire {@link MultiSelectFacet} component. */
  className?: string
  /** Placeholder text for the {@link FacetSearchRow} input. */
  searchPlaceholder?: string
  /**
   * Whether to render {@link FacetSearchRow} inside the popover when theres too many options,
   * specifically at least {@link SEARCH_THRESHOLD}.
   */
  showSearch?: boolean
  /** Text displayed on the closed {@link FacetTrigger}. */
  closedLabel: string
  /** Configuration for the AND/OR logic toggle provided by {@link MultiSelectFacetLogicConfig}. */
  logic?: MultiSelectFacetLogicConfig
  /** Optional tooltip text displayed next to the title inside {@link FacetHeader}. */
  titleTooltip?: string
  /**
   * Configuration for grouping options into sections rendered by {@link MultiSelectFacet}.
   * Provide an array of group keys in display order and a mapping of keys to labels.
   * @example { keys: ['area', 'type'], labels: { area: 'Area', type: 'Type' } }
   */
  grouping?: {
    /** Array of group keys in the order they should be displayed, matching {@link MultiSelectFacetOption.groupKey}. */
    keys: string[]
    /** Mapping of group keys to display labels shown in section headers. */
    labels: Record<string, string>
  }
}

/** Sort mode keys used to look up translated labels. */
type SortModeKey = 'alpha' | 'count-desc' | 'count-asc'

/** Preconfigured sort modes icons. Labels are fetched via translations. */
const SORT_MODE_CONFIG: { key: SortModeKey; icon: typeof ArrowDownAZ }[] = [
  { key: 'alpha', icon: ArrowDownAZ },
  { key: 'count-desc', icon: ArrowDownWideNarrow },
  { key: 'count-asc', icon: ArrowUpNarrowWide },
]

/**
 * Facet component that allows selecting multiple values from a list of {@link MultiSelectFacetOption}s.
 * It includes search, clear, grouping, and AND/OR logic toggling via {@link LogicToggle}.
 *
 * @param props - The props consumed by {@link MultiSelectFacet}.
 * @returns React element that renders the full multi-select facet surface.
 */
export default function MultiSelectFacet({
  title,
  options,
  selected,
  onChange,
  searchPlaceholder,
  className,
  showSearch = true,
  closedLabel,
  logic,
  titleTooltip,
  grouping,
}: MultiSelectFacetProps) {
  // Get translations
  const tFilters = useTranslations('ui.filters')

  // We the current locale (for locale-based sorting)
  const locale = useLocale()

  // Create the facet whfich handled internal logic
  const facet = useFacetBase<MultiSelectFacetOption>({
    options,
    inputKind: 'checkbox',
    selected,
  })

  // Track sort mode for each group (only used when grouping is enabled)
  const [groupSortModes, setGroupSortModes] = React.useState<Record<string, SortModeKey>>(() => {
    if (!grouping) return {}
    const initial: Record<string, SortModeKey> = {}
    grouping.keys.forEach((key) => {
      initial[key] = SORT_MODE_CONFIG[0].key
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

  // Store the collapse state before search starts, so we can restore it when search stops
  const preSearchCollapseStateRef = React.useRef<Record<string, boolean> | null>(null)
  // Track the previous query to detect when search starts/stops
  const previousQueryRef = React.useRef<string>('')
  // Capture the current collapsed groups state to read it synchronously
  const collapsedGroupsRef = React.useRef(collapsedGroups)
  collapsedGroupsRef.current = collapsedGroups
  // Keep the latest selection in a ref so callbacks can stay stable while observing fresh values
  const selectedRef = React.useRef(selected)
  selectedRef.current = selected

  /**
   * Groups options by their `groupKey` and applies the appropriate {@link SORT_MODES} ordering.
   *
   * @param opts - Options generated by {@link useFacetBase} for {@link MultiSelectFacet}.
   * @returns Mapping of group keys to grouped {@link MultiSelectFacetOption} arrays.
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
        const sortMode = groupSortModes[key] || SORT_MODE_CONFIG[0].key

        groups[key].sort((a, b) => {
          switch (sortMode) {
            case 'alpha':
              return a.displayName.localeCompare(b.displayName, locale)

            case 'count-desc':
            case 'count-asc': {
              const aCount = typeof a.count === 'number' ? a.count : 0
              const bCount = typeof b.count === 'number' ? b.count : 0
              // If counts are equal, fall back to alphabetical
              if (aCount === bCount) {
                return a.displayName.localeCompare(b.displayName, locale)
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
    [grouping, groupSortModes, locale]
  )
  /**
   * Sorts options within a group based on the group's current sort mode selection.
   *
   * @param options - Options scoped to a single group within {@link MultiSelectFacet}.
   * @param sortMode - Key of the sort mode provided by {@link SORT_MODE_CONFIG}.
   * @returns New array of {@link MultiSelectFacetOption} sorted for rendering.
   */
  const sortOptionsByMode = React.useCallback(
    (options: MultiSelectFacetOption[], sortMode: SortModeKey) => {
      return [...options].sort((a, b) => {
        switch (sortMode) {
          case 'alpha':
            return a.displayName.localeCompare(b.displayName, locale)

          case 'count-desc':
          case 'count-asc': {
            const aCount = typeof a.count === 'number' ? a.count : 0
            const bCount = typeof b.count === 'number' ? b.count : 0
            // If counts are equal, fall back to alphabetical
            if (aCount === bCount) {
              return a.displayName.localeCompare(b.displayName, locale)
            }
            // Otherwise comparing by count asc/desc
            return sortMode === 'count-desc' ? bCount - aCount : aCount - bCount
          }

          default:
            throw new Error(`Unknown sort mode: ${sortMode}`)
        }
      })
    },
    [locale]
  )

  // This memo returns the list of display options for the facet,
  // respecting current open/search state and grouping configuration.
  const displayOptions = React.useMemo(() => {
    // If the dropdown is closed, or if searching, just show current filtered options in order.
    if (!facet.open || facet.query) {
      return facet.filtered
    }

    // If grouping is enabled, preserve group order from `grouping.keys`
    if (grouping) {
      // Group options according to grouping.keys, sorted within groups.
      const groups = groupOptions(facet.filtered)

      // This will accumulate all options in the defined order, selected first in each group.
      const sortedOptions: MultiSelectFacetOption[] = []

      // For every groupKey, preserve display order specified in `grouping.keys`
      grouping.keys.forEach((groupKey) => {
        // Get all options for this group (may be empty array)
        const groupOptionsList = groups[groupKey]
        // Get this group's sort mode (e.g. alpha, count-desc)
        const sortMode = groupSortModes[groupKey]

        // Separate out selected/unselected for "selected first" behavior
        const selectedInGroup = groupOptionsList.filter((option) => selected.includes(option.id))
        const unselectedInGroup = groupOptionsList.filter((option) => !selected.includes(option.id))

        // Sort each partition within the group by group's sort mode
        const sortedSelected = sortOptionsByMode(selectedInGroup, sortMode)
        const sortedUnselected = sortOptionsByMode(unselectedInGroup, sortMode)

        // Add to overall array: selected first, then unselected
        sortedOptions.push(...sortedSelected, ...sortedUnselected)
      })

      // Final flattened result
      return sortedOptions
    } else {
      // No grouping: selected options first, then unselected, order otherwise unchanged
      return [...facet.filtered].sort((a, b) => {
        const aSelected = selected.includes(a.id)
        const bSelected = selected.includes(b.id)

        // If both are selected or both unselected, retain original order
        if (aSelected === bSelected) return 0
        // Otherwise, selected options first
        return aSelected ? -1 : 1
      })
    }
  }, [
    facet.open,
    facet.query,
    facet.filtered,
    grouping,
    groupOptions,
    groupSortModes,
    selected,
    sortOptionsByMode,
  ])

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

    // Scroll to top of the list container
    if (facet.listRef.current) {
      facet.listRef.current.scrollTop = 0
    }
  }

  // Internal wrapper that converts function-form updates to direct array updates (expected by OptionItem)
  const internalOnChange = React.useCallback(
    (next: (_previous: string[]) => string[]) => {
      const nextArray = next(selectedRef.current)
      onChange(nextArray)
    },
    [onChange]
  )

  // A function to create an option item component from its properties
  const renderOption = React.useCallback(
    (option: MultiSelectFacetOption) => (
      <OptionItem
        key={option.id}
        option={option}
        checked={selected.includes(option.id)}
        isZeroCount={typeof option.count === 'number' && option.count <= 0}
        onChange={internalOnChange}
      />
    ),
    [internalOnChange, selected]
  )

  /**
   * Toggles the collapsed state of a group header within {@link MultiSelectFacet}.
   *
   * @param groupKey - Identifier of the group defined in {@link MultiSelectFacetProps.grouping}.
   */
  function toggleGroupCollapse(groupKey: string) {
    setCollapsedGroups((previous) => ({
      ...previous,
      [groupKey]: !previous[groupKey],
    }))
  }

  /**
   * Cycles through sort modes defined in {@link SORT_MODE_CONFIG} for a given group.
   *
   * @param groupKey - Identifier of the group defined in {@link MultiSelectFacetProps.grouping}.
   */
  function cycleSortMode(groupKey: string) {
    setGroupSortModes((prev) => {
      const current = prev[groupKey] || SORT_MODE_CONFIG[0].key
      const currentIndex = SORT_MODE_CONFIG.findIndex((mode) => mode.key === current)
      const nextIndex = (currentIndex + 1) % SORT_MODE_CONFIG.length
      const next = SORT_MODE_CONFIG[nextIndex].key
      return { ...prev, [groupKey]: next }
    })
  }

  /**
   * Renders the sort toggle button used in each group header within {@link MultiSelectFacet}.
   *
   * @param props - Component props for the {@link GroupSortButton}.
   * @param props.groupKey - Identifier of the group defined in {@link MultiSelectFacetProps.grouping}.
   * @returns Button element that cycles the group's sort mode.
   */
  function GroupSortButton({ groupKey }: { groupKey: string }) {
    // Get the current sort mode for this group, defaulting to the first mode if not set
    const sortMode = groupSortModes[groupKey] || SORT_MODE_CONFIG[0].key

    // Find the matching sort mode configuration, or fall back to the first mode
    const currentMode =
      SORT_MODE_CONFIG.find((sortModeConfig) => sortModeConfig.key === sortMode) ||
      SORT_MODE_CONFIG[0]

    // Get translated label based on sort mode key
    const getSortLabel = (key: SortModeKey) => {
      switch (key) {
        case 'alpha':
          return tFilters('sortAlphabetically')
        case 'count-desc':
          return tFilters('sortByCountDesc')
        case 'count-asc':
          return tFilters('sortByCountAsc')
      }
    }
    const label = getSortLabel(currentMode.key)

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          cycleSortMode(groupKey)
        }}
        className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        title={label}
        aria-label={label}
      >
        <currentMode.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </button>
    )
  }

  /**
   * Logic toggle control that switches between {@link MultiSelectFacetMode} values.
   *
   * @param props - Control props specifying current value and change handler.
   * @param props.value - Current {@link MultiSelectFacetMode} applied in {@link MultiSelectFacet}.
   * @param props.onChange - Callback invoked when the mode toggles within {@link LogicToggle}.
   * @returns React element rendering the AND/OR toggle.
   */
  function LogicToggle(props: {
    value: MultiSelectFacetMode
    onChange: (mode: MultiSelectFacetMode) => void
  }) {
    const { value, onChange } = props
    const baseBtn =
      'px-2 sm:px-2.5 h-6 sm:h-7 rounded-md text-[11px] sm:text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
    return (
      <div className="flex items-center justify-between gap-2 border-b border-slate-700 bg-gray-800/95 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs text-slate-400">
        <span className="whitespace-nowrap">{tFilters('logic')}</span>
        <div
          className="inline-flex items-center gap-0.5 sm:gap-1 rounded-lg border border-slate-600 p-0.5"
          role="radiogroup"
          aria-label={tFilters('selectionLogic')}
        >
          <button
            type="button"
            className={cn(baseBtn, value === 'or' && 'bg-indigo-900 text-white')}
            onClick={() => onChange('or')}
            aria-pressed={value === 'or'}
          >
            {logic?.labels?.or ?? tFilters('logicAtLeastOne')}
          </button>
          <button
            type="button"
            className={cn(baseBtn, value === 'and' && 'bg-indigo-900 text-white')}
            onClick={() => onChange('and')}
            aria-pressed={value === 'and'}
          >
            {logic?.labels?.and ?? tFilters('logicAll')}
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

        {/* Only show the search row when the option count meets the configured threshold. */}
        {showSearch && options.length >= SEARCH_THRESHOLD && (
          <FacetSearchRow
            query={facet.query}
            setQuery={facet.setQuery}
            searchRef={facet.searchRef}
            title={title}
            placeholder={searchPlaceholder ?? tFilters('searchPlaceholder')}
            onArrowDownToList={facet.focusFirstItem}
          />
        )}

        {logic && (logic.enabled ?? true) && (
          <LogicToggle value={logic.mode} onChange={logic.onChange} />
        )}

        <FacetListContainer
          role="group"
          labelId={facet.labelId}
          listRef={facet.listRef}
          onKeyDown={facet.onListKeyDown}
          noTopPadding={!!grouping}
        >
          {facet.filtered.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-400">{tFilters('noResults')}</div>
          )}
          {(() => {
            // Render options with or without sections based on grouping prop
            if (grouping) {
              // Group currentOptions without re-sorting
              const groups: Record<string, MultiSelectFacetOption[]> = {}
              grouping.keys.forEach((key) => {
                groups[key] = []
              })

              // Distribute currentOptions into groups, preserving their order
              displayOptions.forEach((option) => {
                if (option.groupKey && groups[option.groupKey]) {
                  groups[option.groupKey].push(option)
                }
              })

              // Find the visible groups
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
                          aria-label={
                            isCollapsed ? tFilters('expandGroup') : tFilters('collapseGroup')
                          }
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
                                aria-label={tFilters('selectedInGroup', { count: selectedCount })}
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
              return displayOptions.map(renderOption)
            }
          })()}
        </FacetListContainer>
      </FacetPopover>
    </div>
  )
}
