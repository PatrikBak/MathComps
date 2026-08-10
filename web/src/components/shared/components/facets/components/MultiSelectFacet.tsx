import { Radio, RadioGroup } from '@headlessui/react'
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { memo, type MouseEvent, type ReactNode, useCallback, useMemo, useRef } from 'react'

import { FOCUS_RING_ROW_CLASS } from '@/components/shared/components/Button'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { isExclusiveSelection } from '@/components/shared/utils/event-utils'
import { useSmartLongPress } from '@/hooks/use-smart-long-press'

import { useFacetGroups } from '../hooks/use-facet-groups'
import { type FacetPopoverWidth, useFacetPopover } from '../hooks/use-facet-popover'
import {
  type FacetRowAction,
  headingKeyOf,
  headingRowId,
  useFacetRowNavigation,
} from '../hooks/use-facet-row-navigation'
import { useRevealSelectedOption } from '../hooks/use-reveal-selected-option'
import {
  facetOptionAccessibleName,
  orderFlatOptions,
  orderGroupedOptions,
  sectionsWorthSorting,
  soleSelectionLabel,
  toggleOptionSelection,
  toVisibleSections,
} from '../model/facet-logic'
import type {
  FacetGrouping,
  FacetLogicConfig,
  FacetLogicMode,
  FacetOption,
  FacetSelectionMode,
  FacetSortMode,
  VisibleSection,
} from '../model/facet-types'
import { FacetHeader } from './FacetHeader'
import { FacetItemCount, FacetItemLabel } from './FacetItem'
import { FacetList } from './FacetList'
import { FACET_SURFACE_CLASS, FacetPopover, FacetPopoverHeader } from './FacetPopover'
import { FacetSearchRow, SEARCH_THRESHOLD } from './FacetSearchRow'
import { FacetTrigger, type FacetTriggerVariant } from './FacetTrigger'

/** The icon standing for each ordering on a section's sort button. */
const SORT_MODE_ICONS: Record<FacetSortMode, LucideIcon> = {
  alpha: ArrowDownAZ,
  'count-desc': ArrowDownWideNarrow,
  'count-asc': ArrowUpNarrowWide,
}

/**
 * How a facet draws and behaves, per the number of its options that may stand at once.
 */
type SelectionModeBehavior = {
  /** The input a row is built around. */
  inputType: 'radio' | 'checkbox'
  /** The class that styles it. */
  controlClass: string
  /** Whether picking an option unseats whatever stood before, rather than joining it. */
  replacesSelection: boolean
  /** Whether the rows' controls answer to one shared name, which makes the browser treat them as one group. */
  groupsUnderOneName: boolean
  /** Whether the options standing float to the top of their section while the popover sits idle. */
  floatsSelectedFirst: boolean
  /** Whether the list scrolls to the option standing as it appears. */
  revealsStandingOption: boolean
  /** Whether a section heading counts the options standing under it. */
  countsPerSection: boolean
}

/** How each selection mode draws and behaves. */
const SELECTION_MODE_BEHAVIORS: Record<FacetSelectionMode, SelectionModeBehavior> = {
  single: {
    inputType: 'radio',
    controlClass: 'form-radio',
    replacesSelection: true,
    groupsUnderOneName: true,
    floatsSelectedFirst: false,
    revealsStandingOption: true,
    countsPerSection: false,
  },
  multiple: {
    inputType: 'checkbox',
    controlClass: 'form-checkbox',
    replacesSelection: false,
    groupsUnderOneName: false,
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
 * The props of {@link OptionItem}.
 */
type OptionItemProps = {
  /** The option this row stands for. */
  option: FacetOption
  /** Whether it is currently selected. */
  checked: boolean
  /** Whether it would match nothing, in which case the row is dimmed. */
  isZeroCount: boolean
  /** How many of the facet's options may stand at once. */
  selectionMode: FacetSelectionMode
  /** The name every row of this one facet answers to, unique to it across the page. */
  groupName: string
  /** Whether this row is the one the panel offers the tab order. */
  isTabStop: boolean
  /** Applies a change to the whole selection. */
  onChange: (next: (previous: string[]) => string[]) => void
}

/**
 * One selectable row. Ctrl-clicking or long-pressing narrows the selection to just this
 * option, which is far quicker than clearing and re-picking when a list runs long.
 */
const OptionItem = memo(function OptionItem({
  option,
  checked,
  isZeroCount,
  selectionMode,
  groupName,
  isTabStop,
  onChange,
}: OptionItemProps) {
  // How this row is drawn, and what a click on it does
  const { inputType, controlClass, replacesSelection, groupsUnderOneName } =
    SELECTION_MODE_BEHAVIORS[selectionMode]

  // A function which adds this option to the selection, or takes it back out; where only one option may
  // stand it unseats whatever stood before instead
  const onToggle = useCallback(() => {
    // The change is expressed against whatever the selection is when it lands
    onChange((previousSelected) =>
      replacesSelection ? [option.id] : toggleOptionSelection(option.id, previousSelected)
    )
  }, [replacesSelection, onChange, option.id])

  // A function which clears the facet
  const onClearSelection = useCallback(() => {
    // Whatever stood before is going, so the previous value goes unread
    onChange(() => [])
  }, [onChange])

  // A function which drops every other option from the selection
  const onExclusiveSelect = useCallback(() => {
    // Whatever was selected before is irrelevant, so the previous value goes unread
    onChange(() => [option.id])
  }, [onChange, option.id])

  // A long-press stands in for the modifier click on a touchscreen
  const longPressHandlers = useSmartLongPress(onExclusiveSelect)

  /**
   * Intercepts a modified click, and the click on a standing radio that no change event follows, leaving every
   * other plain click to the control itself.
   *
   * @param event - The click, read for the modifier key it was made with.
   */
  function handleClick(event: MouseEvent<HTMLLabelElement>) {
    // A modified click narrows to this option however many stand
    if (isExclusiveSelection(event)) {
      // The label would otherwise toggle the control on top of the narrowing
      event.preventDefault()

      // Narrow to this one option
      onExclusiveSelect()

      // The plain-click paths below are not this click's business
      return
    }

    // Picking the radio already standing leaves it checked, so no change event follows and clearing the facet
    // has to happen from the click. It is the only way back to showing everything from a row.
    if (replacesSelection && checked) {
      // The label would otherwise hand the click on to a control that has nothing left to say
      event.preventDefault()

      // Back to showing everything
      onClearSelection()
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 sm:gap-3 rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2 transition-colors',
        checked ? 'bg-focus/15' : 'hover:bg-foreground/5',
        // Drawn as an edge rather than a fill, so it reads apart from the tint saying it is standing
        FOCUS_RING_ROW_CLASS,
        isZeroCount && 'opacity-50',
        'select-none'
      )}
    >
      {/* The row, which a click anywhere along means the same thing for */}
      <label
        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
        onClick={handleClick}
        {...longPressHandlers}
      >
        <input
          type={inputType}
          // Radios only stand for one choice between them once they answer to the same name, which is
          // what has a reader told it is on the third of five rather than on a switch of its own
          name={groupsUnderOneName ? groupName : undefined}
          checked={checked}
          onChange={onToggle}
          className={cn(controlClass, 'shrink-0')}
          aria-label={facetOptionAccessibleName(option.displayName, option.count)}
          // Which row this is, so the walk down the list knows what it has landed on
          data-facet-row-id={option.id}
          tabIndex={isTabStop ? 0 : -1}
        />
        <FacetItemLabel>{option.displayName}</FacetItemLabel>

        {/* Count trailing the row */}
        <FacetItemCount count={option.count} />
      </label>
    </div>
  )
})

/**
 * The props of {@link GroupSortButton}.
 */
type GroupSortButtonProps = {
  /** The ordering the section is under. */
  sortMode: FacetSortMode
  /** Advances the section to the next ordering. */
  onCycle: () => void
}

/**
 * The button in a section header that cycles how that section is ordered.
 */
function GroupSortButton({ sortMode, onCycle }: GroupSortButtonProps) {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  // The icon standing for the ordering the section is currently under
  const Icon = SORT_MODE_ICONS[sortMode]

  // What the button currently does
  const label = (() => {
    switch (sortMode) {
      // Ordered by name
      case 'alpha':
        return tFilters('sortAlphabetically')

      // Ordered by count, largest first
      case 'count-desc':
        return tFilters('sortByCountDesc')

      // Ordered by count, smallest first
      case 'count-asc':
        return tFilters('sortByCountAsc')

      // A mode outside the union, which the type system rules out
      default:
        return assertNever(sortMode)
    }
  })()

  return (
    <button
      type="button"
      onClick={onCycle}
      // Out of the tab order, the same ordering being cycled from the keyboard on the heading itself
      tabIndex={-1}
      className="shrink-0 p-1 rounded hover:bg-foreground/5 text-muted hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      title={label}
      aria-label={label}
    >
      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
    </button>
  )
}

/**
 * The props of {@link LogicToggle}.
 */
type LogicToggleProps = {
  /** How the selected options are currently combined. */
  value: FacetLogicMode
  /** Applies the mode the user picked. */
  onChange: (mode: FacetLogicMode) => void
  /** Wording for the two modes, when the generic copy doesn't fit the facet. */
  labels?: FacetLogicConfig['labels']
}

/**
 * The render state a {@link Radio} hands its className. HeadlessUI does not export the
 * full shape, so only the field in use is declared.
 */
type RadioRenderState = {
  /** Whether this mode is the one in force. */
  checked: boolean
}

/**
 * The choice between matching any of the selected options and matching all of them.
 */
function LogicToggle({ value, onChange, labels }: LogicToggleProps) {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  // A function which styles one mode, lit up when it is the one in force
  const modeClass = ({ checked }: RadioRenderState) =>
    cn(
      'inline-flex items-center justify-center cursor-pointer px-2 sm:px-2.5 h-6 sm:h-7 rounded-md text-[11px] sm:text-xs font-medium focus:outline-none data-focus:ring-2 data-focus:ring-focus',
      checked && 'bg-foreground/10 text-foreground'
    )

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 border-b border-foreground/10 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs text-muted',
        FACET_SURFACE_CLASS
      )}
    >
      {/* What the choice is about */}
      <span className="whitespace-nowrap">{tFilters('logic')}</span>

      {/* The two modes */}
      <RadioGroup
        value={value}
        onChange={onChange}
        aria-label={tFilters('selectionLogic')}
        className="inline-flex items-center gap-0.5 sm:gap-1 rounded-lg border border-foreground/10 p-0.5"
      >
        <Radio value="or" className={modeClass}>
          {labels?.or ?? tFilters('logicAtLeastOne')}
        </Radio>
        <Radio value="and" className={modeClass}>
          {labels?.and ?? tFilters('logicAll')}
        </Radio>
      </RadioGroup>
    </div>
  )
}

/**
 * The props of {@link GroupSection}.
 */
type GroupSectionProps = {
  /** Heading shown on the section. */
  label: string
  /** The options belonging to it, already ordered. */
  options: FacetOption[]
  /** How many of them are selected, absent on a facet whose sections carry no such badge. */
  selectedCount: number | undefined
  /** Whether the section is rolled up. */
  isCollapsed: boolean
  /** The ordering it is under. */
  sortMode: FacetSortMode
  /** Whether the section offers a control over that ordering. */
  showSortButton: boolean
  /** The section, which is what its heading answers to as a row. */
  groupKey: string
  /** Whether the heading is the row the panel offers the tab order. */
  isTabStop: boolean
  /** Rolls the section up, or unrolls it. */
  onToggleCollapsed: () => void
  /** Advances the section to the next ordering. */
  onCycleSortMode: () => void
  /** Renders one of the section's options. */
  renderOption: (option: FacetOption) => ReactNode
}

/**
 * One labelled block of options, which can be rolled up and reordered on its own.
 */
function GroupSection({
  label,
  options,
  selectedCount,
  isCollapsed,
  sortMode,
  showSortButton,
  groupKey,
  isTabStop,
  onToggleCollapsed,
  onCycleSortMode,
  renderOption,
}: GroupSectionProps) {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  return (
    <div>
      {/* Section heading */}
      <div
        // The bleed is one-sided: the list pads its left only, so pulling the heading out on both would push
        // it past the right edge and leave the whole list with a horizontal scrollbar for those few pixels
        className={cn(
          '-ml-0.5 sm:-ml-1 px-3 sm:px-4 py-1.5 sm:py-2 border-b border-foreground/10 sticky top-0 z-10 flex items-center gap-2',
          FACET_SURFACE_CLASS
        )}
      >
        {/* The name, which rolls the section up and unrolls it */}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!isCollapsed}
          // The heading is a row of the list in its own right, so the arrows reach it like any option
          data-facet-row-id={headingRowId(groupKey)}
          tabIndex={isTabStop ? 0 : -1}
          className="flex flex-1 min-w-0 items-center gap-2 rounded-sm text-left text-[11px] sm:text-xs font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 transition-transform duration-200',
              isCollapsed && '-rotate-90'
            )}
            aria-hidden="true"
          />
          <span className="min-w-0">{label}</span>

          {/* How many of the section's options are standing */}
          {selectedCount !== undefined && selectedCount > 0 && (
            <span
              className="shrink-0 rounded-full bg-focus/20 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-[11px] leading-none"
              aria-label={tFilters('selectedInGroup', { count: selectedCount })}
            >
              {selectedCount}
            </span>
          )}
        </button>

        {/* The ordering, offered where the sections are long enough for it to move anything */}
        {showSortButton && <GroupSortButton sortMode={sortMode} onCycle={onCycleSortMode} />}
      </div>

      {/* The section's options, hidden while it is rolled up */}
      {!isCollapsed && options.map(renderOption)}
    </div>
  )
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
  /** Prompt shown in the empty search box. */
  searchPlaceholder?: string
  /** Whether a long enough list may offer a search box. */
  showSearch?: boolean
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
 * split into sections that each carry their own ordering and can be rolled up.
 *
 * Where several may stand, the selected options float to the top of their section while the popover
 * sits idle, but hold their place during a search, so results don't jump around as the user types.
 */
export function MultiSelectFacet({
  title,
  options,
  selected,
  onChange,
  searchPlaceholder,
  showSearch = true,
  closedLabel,
  logic,
  titleTooltip,
  grouping,
  variant = 'stacked',
  selectionMode = 'multiple',
}: MultiSelectFacetProps) {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  // The active locale
  const locale = useLocale()

  // How this facet's shape lays itself out
  const { popoverWidth, widthClass, hasHeadingAbove } = FACET_VARIANT_LAYOUTS[variant]

  // And how it behaves, per the number of its options that may stand at once
  const selectionBehavior = SELECTION_MODE_BEHAVIORS[selectionMode]

  // The popover and the search term narrowing what it shows
  const facet = useFacetPopover(options, popoverWidth)

  // Per-section ordering and collapse, left idle by a flat facet
  const groups = useFacetGroups(grouping, facet.query, facet.filtered)

  /**
   * Applies a key pressed on a section's heading, every other row having nothing of its own to do.
   *
   * @param rowId - The row focus is on.
   * @param action - What the key asked of it.
   * @returns Whether the section acted.
   */
  function onRowAction(rowId: string, action: FacetRowAction) {
    // The section the row heads, absent on an option
    const groupKey = headingKeyOf(rowId)

    // Only a heading has any of this to offer
    if (!groupKey) return false

    // Whether the section is currently rolled up, which decides what the two arrows do
    const isCollapsed = groups.collapsed[groupKey] || false

    // What the key asked for, each answering whether the section was in a state to do it
    switch (action) {
      // Left rolls an open section up
      case 'collapse':
        // One already rolled up leaves the key to the browser
        if (isCollapsed) return false

        // Roll it up
        groups.toggleCollapsed(groupKey)

        // The key is spoken for
        return true

      // Right unrolls a closed one
      case 'expand':
        // One already showing leaves the key to the browser
        if (!isCollapsed) return false

        // Unroll it
        groups.toggleCollapsed(groupKey)

        // The key is spoken for
        return true

      // And the ordering advances, where the facet offers one at all
      case 'cycle-sort':
        // A facet whose sections are too short to be worth reordering has nothing to advance
        if (!showSortButtons) return false

        // On to the next ordering
        groups.cycleSortMode(groupKey)

        // The key is spoken for
        return true

      // An action outside the union, which the type system rules out
      default:
        return assertNever(action)
    }
  }

  // Keyboard focus moving down the rows
  const list = useFacetRowNavigation({ onRowAction })

  // The standing option scrolled to as the list appears
  useRevealSelectedOption(
    list.listRef,
    facet.open && selectionBehavior.revealsStandingOption,
    facet.filtered.length
  )

  // The options in the order they should render
  const displayOptions = useMemo(() => {
    // A closed or actively searched list keeps the incoming order, so nothing shifts under the caret
    if (!facet.open || facet.query) {
      return facet.filtered
    }

    // Which options float to the top. Only a facet several may stand in floats them, where they would
    // otherwise be scattered down a list with no way to see what is on. One value is already named on the
    // trigger, and lifting it out of the order its options were authored in reads as a sorting fault.
    const leadingIds = selectionBehavior.floatsSelectedFirst ? selected : []

    // Grouped: every section under its own ordering, concatenated in the configured key order
    if (grouping) {
      return orderGroupedOptions(facet.filtered, grouping, groups.sortModes, leadingIds, locale)
    }

    // Flat: the leading options first, and the rest hold their incoming order
    return orderFlatOptions(facet.filtered, leadingIds)
  }, [
    facet.open,
    facet.query,
    facet.filtered,
    grouping,
    groups.sortModes,
    selected,
    selectionBehavior,
    locale,
  ])

  // The sections that currently have something to show, empty for a flat facet
  const visibleSections: VisibleSection[] = useMemo(
    () => (grouping ? toVisibleSections(displayOptions, grouping) : []),
    [grouping, displayOptions]
  )

  // The one row the panel offers the page's tab order: the option standing, so a reopened facet lands on
  // what it is already filtered by, and the top of the list where nothing stands. Read off the rows
  // actually drawn, since an option inside a rolled-up section is not there to be focused.
  const tabStopRowId = useMemo(() => {
    // The options on show, which under a grouped facet excludes whatever the rolled-up sections hold
    const drawnOptions = grouping
      ? visibleSections
          .filter((section) => !groups.collapsed[section.groupKey])
          .flatMap((section) => section.sectionOptions)
      : displayOptions

    // The first of them standing, which is the row worth landing on
    const standing = drawnOptions.find((option) => selected.includes(option.id))

    // Which is where the tab order goes when there is one
    if (standing) return standing.id

    // Otherwise the top of a grouped list, which is its first section's heading
    if (grouping) return visibleSections[0] && headingRowId(visibleSections[0].groupKey)

    // And the first option of a flat one
    return displayOptions[0]?.id
  }, [displayOptions, grouping, groups.collapsed, selected, visibleSections])

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

  /** Empties the selection and the search box, and returns to the top of the list. */
  function clearAll() {
    // Drop the selection
    if (selected.length) onChange([])

    // Drop the search term, so the full list is back
    if (facet.query.length) facet.setQuery('')

    // An open popover keeps the caret where the user would type next
    if (facet.open) facet.focusSearchBox()

    // The list may be scrolled far down, which would hide the options now on offer
    if (list.listRef.current) {
      list.listRef.current.scrollTop = 0
    }
  }

  // Whether the section headings offer a control over their ordering, read off every option the facet has
  // rather than the ones a search left standing, so the control doesn't come and go as the user types
  const showSortButtons = useMemo(
    () => (grouping ? sectionsWorthSorting(options, grouping) : false),
    [grouping, options]
  )

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
          suppressClear={facet.open && facet.placement.startsWith('top')}
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
            only where that heading has been flipped off-screen */}
        {(!hasHeadingAbove || facet.placement.startsWith('top')) && (
          <FacetPopoverHeader
            title={title}
            titleId={hasHeadingAbove ? undefined : facet.labelId}
            onClear={clearAll}
            count={selected.length}
          />
        )}

        {/* Search row, once the list is long enough to be worth searching */}
        {showSearch && options.length >= SEARCH_THRESHOLD && (
          <FacetSearchRow
            query={facet.query}
            setQuery={facet.setQuery}
            searchRef={facet.searchRef}
            title={title}
            placeholder={searchPlaceholder ?? tFilters('searchPlaceholder')}
            onArrowDownToList={list.focusFirstRow}
          />
        )}

        {/* AND/OR control */}
        {logic && (
          <LogicToggle value={logic.mode} onChange={logic.onChange} labels={logic.labels} />
        )}

        {/* The options themselves */}
        <FacetList labelId={facet.labelId} listRef={list.listRef} noTopPadding={!!grouping}>
          {/* Empty state, when there is nothing left to show */}
          {facet.filtered.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted">{tFilters('noResults')}</div>
          )}

          {/* Option rows, under their section headings when the facet is grouped */}
          {grouping
            ? visibleSections.map(({ groupKey, sectionOptions }) => (
                <GroupSection
                  key={groupKey}
                  label={grouping.labels[groupKey]}
                  options={sectionOptions}
                  selectedCount={
                    // One selection across the whole facet is already told by the row carrying it
                    selectionBehavior.countsPerSection
                      ? sectionOptions.filter((option) => selected.includes(option.id)).length
                      : undefined
                  }
                  isCollapsed={groups.collapsed[groupKey] || false}
                  sortMode={groups.sortModes[groupKey]}
                  showSortButton={showSortButtons}
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
