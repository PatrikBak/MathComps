import { useCallback, useRef } from 'react'

import { useFacetGroups } from '../hooks/use-facet-groups'
import { useFacetOptionRows } from '../hooks/use-facet-option-rows'
import { type FacetPopoverWidth, resetFacet, useFacetPopover } from '../hooks/use-facet-popover'
import { useFacetRowNavigation } from '../hooks/use-facet-row-navigation'
import { useRevealSelectedOption } from '../hooks/use-reveal-selected-option'
import { headingRowId, soleSelectionLabel } from '../model/facet-logic'
import type {
  FacetGrouping,
  FacetLogicConfig,
  FacetOption,
  FacetSearchConfig,
  FacetSelectionMode,
} from '../model/facet-types'
import { FacetHeader } from './FacetHeader'
import { FacetList, FacetNoResults } from './FacetList'
import { FacetPopover, FacetPopoverHeader } from './FacetPopover'
import { FacetSearchRow, SEARCH_THRESHOLD } from './FacetSearchRow'
import { FacetTrigger, type FacetTriggerVariant } from './FacetTrigger'
import { GroupSection } from './GroupSection'
import { LogicToggle } from './LogicToggle'
import { OptionItem } from './OptionItem'

/**
 * How a facet's panel behaves, per the number of its options that may stand at once.
 */
type SelectionModeBehavior = {
  /** Whether the options standing as the popover opens lead their section until it closes. */
  floatsSelectedFirst: boolean
  /** Whether the list scrolls to the option standing as it appears. */
  revealsStandingOption: boolean
  /** Whether an unrolled section's heading counts the options standing under it, as a rolled-up one always does. */
  countsPerSection: boolean
}

/**
 * How each selection mode behaves. A facet holding one value leaves it where its options were authored: the
 * trigger already names it, and lifting it out of that order reads as a sorting fault.
 */
const SELECTION_MODE_BEHAVIORS: Record<FacetSelectionMode, SelectionModeBehavior> = {
  single: {
    floatsSelectedFirst: false,
    revealsStandingOption: true,
    countsPerSection: false,
  },
  multiple: {
    floatsSelectedFirst: true,
    revealsStandingOption: false,
    countsPerSection: true,
  },
}

/**
 * How a facet's shape lays itself out around its trigger.
 */
type FacetVariantLayout = {
  /** Where the popover takes its width from. */
  popoverWidth: FacetPopoverWidth
  /** The width the facet takes where it stands. */
  widthClass: string
  /** Whether a heading naming the facet stands above the trigger. */
  hasHeadingAbove: boolean
}

/** How each shape lays itself out. */
const FACET_VARIANT_LAYOUTS: Record<FacetTriggerVariant, FacetVariantLayout> = {
  stacked: { popoverWidth: 'trigger', widthClass: 'w-full', hasHeadingAbove: true },
  pill: { popoverWidth: 'content', widthClass: 'w-auto', hasHeadingAbove: false },
}

/**
 * The props of {@link MultiSelectFacet}.
 */
type MultiSelectFacetProps = {
  /** Name of what the facet filters by. */
  title: string
  /** Every option it can offer. */
  options: FacetOption[]
  /** Ids of the options currently selected. */
  selected: string[]
  /** Applies a new selection. */
  onChange: (next: string[]) => void
  /** The search over the options, on a facet offering one. */
  search?: FacetSearchConfig
  /** What the trigger reads when nothing is selected. */
  closedLabel: string
  /** The AND/OR control, for facets where combining selections has a choice to it. */
  logic?: FacetLogicConfig
  /** Explanation offered beside the title. */
  titleTooltip?: string
  /** Splits the options into labelled sections. */
  grouping?: FacetGrouping
  /** How the facet sits on the page. */
  variant?: FacetTriggerVariant
  /** How many options may stand at once; many unless the facet's field only holds one. */
  selectionMode?: FacetSelectionMode
}

/**
 * A facet offering a flat list of values, one or several of which may stand at once, optionally
 * split into sections that each carry their own ordering and can be rolled up. Its rows are laid out by
 * {@link useFacetOptionRows}.
 */
export function MultiSelectFacet({
  title,
  options,
  selected,
  onChange,
  search,
  closedLabel,
  logic,
  titleTooltip,
  grouping,
  variant = 'stacked',
  selectionMode = 'multiple',
}: MultiSelectFacetProps) {
  // How this facet's shape lays itself out
  const { popoverWidth, widthClass, hasHeadingAbove } = FACET_VARIANT_LAYOUTS[variant]

  // How the facet behaves, per the number of its options that may stand at once
  const selectionBehavior = SELECTION_MODE_BEHAVIORS[selectionMode]

  // The popover and the search term narrowing what it shows
  const facet = useFacetPopover({ options, width: popoverWidth })

  // Per-section ordering and collapse, and the keys the headings answer, left idle by a flat facet
  const groups = useFacetGroups({ grouping, options, searchTerm: facet.searchTerm })

  // Keyboard focus moving down the rows, Left and Right rolling the sections up and out
  const list = useFacetRowNavigation({ isOpen: facet.open, onRowAction: groups.onRowAction })

  // The standing option scrolled to as the list appears
  useRevealSelectedOption({
    listRef: list.listRef,
    isActive: facet.open && selectionBehavior.revealsStandingOption,
    optionCount: options.length,
  })

  // The rows in the order they render, the sections holding them, and the one the tab order reaches
  const { displayOptions, visibleSections, tabStopRowId } = useFacetOptionRows({
    isOpen: facet.open,
    filteredOptions: facet.filtered,
    grouping,
    sortModes: groups.sortModes,
    collapsed: groups.collapsed,
    selected,
    floatsSelectedFirst: selectionBehavior.floatsSelectedFirst,
    lastFocusedRowId: list.lastFocusedRowId,
  })

  // The newest selection, held in a ref so the row callbacks stay stable
  const selectedRef = useRef(selected)
  selectedRef.current = selected

  // A function which applies a row's change against the newest selection
  const applySelectionChange = useCallback(
    (next: (previous: string[]) => string[]) => {
      // The row hands up a function, so it never has to hold the selection itself
      onChange(next(selectedRef.current))
    },
    [onChange]
  )

  // A function which renders one option row
  const renderOption = useCallback(
    (option: FacetOption) => (
      <OptionItem
        key={option.id}
        option={option}
        checked={selected.includes(option.id)}
        isZeroCount={typeof option.count === 'number' && option.count <= 0}
        selectionMode={selectionMode}
        groupName={facet.popoverId}
        isTabStop={option.id === tabStopRowId}
        onChange={applySelectionChange}
      />
    ),
    [applySelectionChange, facet.popoverId, selected, selectionMode, tabStopRowId]
  )

  // A function which resets the facet
  const clearAll = () => resetFacet({ selected, onChange, popover: facet, list })

  // The one option standing, where exactly one is
  const selectedLabel = soleSelectionLabel(selected, options, title)

  return (
    <div className={widthClass}>
      {/* The heading naming the facet, which the popover carries instead where there is none */}
      {hasHeadingAbove && (
        <FacetHeader
          title={title}
          labelId={facet.labelId}
          anySelected={selected.length > 0}
          onClear={clearAll}
          suppressClear={facet.isOpenAbove}
          titleTooltip={titleTooltip}
        />
      )}

      {/* The button that opens it */}
      <FacetTrigger
        open={facet.open}
        refs={facet.refs}
        getReferenceProps={facet.getReferenceProps}
        closedLabel={closedLabel}
        selectedLabel={selectedLabel}
        count={selected.length}
        title={title}
        variant={variant}
      />

      {/* And what it opens */}
      <FacetPopover
        open={facet.open}
        context={facet.context}
        refs={facet.refs}
        floatingStyles={facet.floatingStyles}
        getFloatingProps={facet.getFloatingProps}
        popoverId={facet.popoverId}
        labelId={facet.labelId}
        variant={variant}
        initialFocus={facet.initialFocus}
        onKeyDown={list.onListKeyDown}
      >
        {/* The header, always where no heading stands above the trigger to name the facet, and otherwise
            only where the popover opens above the trigger, over that heading */}
        {(!hasHeadingAbove || facet.isOpenAbove) && (
          <FacetPopoverHeader
            title={title}
            titleId={hasHeadingAbove ? undefined : facet.labelId}
            onClear={clearAll}
            count={selected.length}
          />
        )}

        {/* Search row, on a facet offering one, once the list is long enough to be worth searching */}
        {search && options.length >= SEARCH_THRESHOLD && (
          <FacetSearchRow
            query={facet.query}
            setQuery={facet.setQuery}
            searchRef={facet.searchRef}
            title={title}
            placeholder={search.placeholder}
            onArrowDownToList={list.focusFirstRow}
          />
        )}

        {/* AND/OR control */}
        {logic && (
          <LogicToggle
            value={logic.mode}
            onChange={logic.onChange}
            labels={logic.labels}
            searchRef={facet.searchRef}
          />
        )}

        {/* The options themselves */}
        <FacetList
          role="group"
          labelId={facet.labelId}
          listRef={list.listRef}
          onFocus={list.onListFocus}
          onBlur={list.onListBlur}
          hasStickyHeadings={!!grouping}
        >
          {/* Empty state, when there is nothing left to show */}
          {facet.filtered.length === 0 && <FacetNoResults />}

          {/* Option rows, under their section headings when the facet is grouped */}
          {grouping
            ? visibleSections.map(({ groupKey, sectionOptions }) => (
                <GroupSection
                  key={groupKey}
                  label={grouping.labels[groupKey]}
                  options={sectionOptions}
                  selectedCount={
                    // One selection across the whole facet is already told by the row carrying it, until the
                    // section rolls up over that row
                    selectionBehavior.countsPerSection || groups.collapsed[groupKey]
                      ? sectionOptions.filter((option) => selected.includes(option.id)).length
                      : undefined
                  }
                  isCollapsed={groups.collapsed[groupKey] || false}
                  sortMode={groups.sortModes[groupKey]}
                  showSortButton={groups.showSortButtons}
                  groupKey={groupKey}
                  isTabStop={headingRowId(groupKey) === tabStopRowId}
                  onToggleCollapsed={() => groups.toggleCollapsed(groupKey)}
                  onCycleSortMode={() => groups.cycleSortMode(groupKey)}
                  renderOption={renderOption}
                />
              ))
            : displayOptions.map(renderOption)}
        </FacetList>
      </FacetPopover>
    </div>
  )
}
