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

import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { isExclusiveSelection } from '@/components/shared/utils/event-utils'
import { useSmartLongPress } from '@/hooks/use-smart-long-press'

import { useFacetGroups } from '../hooks/use-facet-groups'
import { useFacetListNavigation } from '../hooks/use-facet-list-navigation'
import { useFacetPopover } from '../hooks/use-facet-popover'
import {
  facetOptionAccessibleName,
  orderFlatOptions,
  orderGroupedOptions,
  toggleOptionSelection,
  toVisibleSections,
} from '../model/facet-logic'
import type {
  FacetGrouping,
  FacetLogicConfig,
  FacetLogicMode,
  FacetOption,
  FacetSortMode,
  VisibleSection,
} from '../model/facet-types'
import { FacetHeader } from './FacetHeader'
import { FacetItemCount, FacetItemLabel } from './FacetItem'
import { FacetList } from './FacetList'
import { FacetPopover, FacetPopoverHeader } from './FacetPopover'
import { FacetSearchRow, SEARCH_THRESHOLD } from './FacetSearchRow'
import { FacetTrigger } from './FacetTrigger'

/** The icon standing for each ordering on a section's sort button. */
const SORT_MODE_ICONS: Record<FacetSortMode, LucideIcon> = {
  alpha: ArrowDownAZ,
  'count-desc': ArrowDownWideNarrow,
  'count-asc': ArrowUpNarrowWide,
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
  onChange,
}: OptionItemProps) {
  // A function which adds this option to the selection, or takes it back out
  const onToggle = useCallback(() => {
    // The change is expressed against whatever the selection is when it lands
    onChange((previousSelected) => toggleOptionSelection(option.id, previousSelected))
  }, [onChange, option.id])

  // A function which drops every other option from the selection
  const onExclusiveSelect = useCallback(() => {
    // Whatever was selected before is irrelevant, so the previous value goes unread
    onChange(() => [option.id])
  }, [onChange, option.id])

  // A long-press stands in for the modifier click on a touchscreen
  const longPressHandlers = useSmartLongPress(onExclusiveSelect)

  /**
   * Intercepts a modified click, leaving a plain one to the checkbox.
   *
   * @param event - The click, read for the modifier key it was made with.
   */
  function handleClick(event: MouseEvent<HTMLLabelElement>) {
    // Only the modified click is this handler's business
    if (isExclusiveSelection(event)) {
      // The label would otherwise toggle the checkbox on top of the narrowing
      event.preventDefault()

      // Narrow to this one option
      onExclusiveSelect()
    }
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 sm:gap-3 rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2 transition-colors',
        checked ? 'bg-focus/10 ring-1 ring-inset ring-focus/30' : 'hover:bg-foreground/5',
        isZeroCount && 'opacity-50',
        'select-none'
      )}
    >
      {/* Checkbox and name, which a click anywhere along means the same thing for */}
      <label
        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
        onClick={handleClick}
        {...longPressHandlers}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="form-checkbox shrink-0"
          aria-label={facetOptionAccessibleName(option.displayName, option.count)}
        />
        <FacetItemLabel>{option.displayName}</FacetItemLabel>
      </label>

      {/* Count trailing the row */}
      <FacetItemCount count={option.count} />
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
      onClick={(event) => {
        // The header itself collapses the section, which a click on the sort button must not do
        event.stopPropagation()

        // Only the ordering moves
        onCycle()
      }}
      className="p-1 rounded hover:bg-foreground/5 text-muted hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
    <div className="flex items-center justify-between gap-2 border-b border-foreground/10 bg-surface/95 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs text-muted">
      <span className="whitespace-nowrap">{tFilters('logic')}</span>
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
  /** How many of them are selected. */
  selectedCount: number
  /** Whether the section is rolled up. */
  isCollapsed: boolean
  /** The ordering it is under. */
  sortMode: FacetSortMode
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
  onToggleCollapsed,
  onCycleSortMode,
  renderOption,
}: GroupSectionProps) {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  return (
    <div>
      {/* Section heading, which also rolls the section up */}
      <div
        className="-mx-0.5 sm:-mx-1 px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-foreground border-b border-foreground/10 bg-surface sticky top-0 z-10 flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        role="button"
        tabIndex={0}
        onClick={onToggleCollapsed}
        onKeyDown={(event) => {
          // The header stands in for a button, so both activation keys have to work on it
          if (event.key === 'Enter' || event.key === ' ') {
            // Space would otherwise scroll the list under the header
            event.preventDefault()

            // Roll the section up, or unroll it
            onToggleCollapsed()
          }
        }}
        aria-expanded={!isCollapsed}
        aria-label={
          isCollapsed
            ? tFilters('expandGroup', { name: label })
            : tFilters('collapseGroup', { name: label })
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
          {label}
          {selectedCount > 0 && (
            <span
              className="shrink-0 rounded-full bg-foreground/10 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-[11px] leading-none"
              aria-label={tFilters('selectedInGroup', { count: selectedCount })}
            >
              {selectedCount}
            </span>
          )}
        </span>
        <GroupSortButton sortMode={sortMode} onCycle={onCycleSortMode} />
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
}

/**
 * A facet offering many values at once, optionally split into sections that each carry
 * their own ordering and can be rolled up.
 *
 * Selected options float to the top of their section while the popover sits idle, but
 * hold their place during a search, so results don't jump around as the user types.
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
}: MultiSelectFacetProps) {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  // The active locale
  const locale = useLocale()

  // The popover and the search term narrowing what it shows
  const facet = useFacetPopover(options)

  // Keyboard focus moving down the option rows
  const list = useFacetListNavigation()

  // Per-section ordering and collapse, left idle by a flat facet
  const groups = useFacetGroups(grouping, facet.query, facet.filtered)

  // The options in the order they should render
  const displayOptions = useMemo(() => {
    // A closed or actively searched list keeps the incoming order, so nothing shifts under the caret
    if (!facet.open || facet.query) {
      return facet.filtered
    }

    // Grouped: every section under its own ordering, concatenated in the configured key order
    if (grouping) {
      return orderGroupedOptions(facet.filtered, grouping, groups.sortModes, selected, locale)
    }

    // Flat: selected options lead, and the rest hold their incoming order
    return orderFlatOptions(facet.filtered, selected)
  }, [facet.open, facet.query, facet.filtered, grouping, groups.sortModes, selected, locale])

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
        onChange={applySelectionChange}
      />
    ),
    [applySelectionChange, selected]
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

  // The sections that currently have something to show, empty for a flat facet
  const visibleSections: VisibleSection[] = useMemo(
    () => (grouping ? toVisibleSections(displayOptions, grouping) : []),
    [grouping, displayOptions]
  )

  return (
    <div className="w-full">
      <FacetHeader
        title={title}
        labelId={facet.labelId}
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
        count={selected.length}
        title={title}
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
        {/* Flipped upwards, the header outside the popover is off-screen, so repeat it here */}
        {facet.placement.startsWith('top') && (
          <FacetPopoverHeader title={title} onClear={clearAll} count={selected.length} />
        )}

        {/* Search row, once the list is long enough to be worth searching */}
        {showSearch && options.length >= SEARCH_THRESHOLD && (
          <FacetSearchRow
            query={facet.query}
            setQuery={facet.setQuery}
            searchRef={facet.searchRef}
            title={title}
            placeholder={searchPlaceholder ?? tFilters('searchPlaceholder')}
            onArrowDownToList={list.focusFirstItem}
          />
        )}

        {/* AND/OR control */}
        {logic && (
          <LogicToggle value={logic.mode} onChange={logic.onChange} labels={logic.labels} />
        )}

        <FacetList
          labelId={facet.labelId}
          listRef={list.listRef}
          onKeyDown={list.onListKeyDown}
          noTopPadding={!!grouping}
        >
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
                    sectionOptions.filter((option) => selected.includes(option.id)).length
                  }
                  isCollapsed={groups.collapsed[groupKey] || false}
                  sortMode={groups.sortModes[groupKey]}
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
