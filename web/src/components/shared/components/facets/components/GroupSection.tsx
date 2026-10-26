import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { MouseEvent, ReactNode } from 'react'

import { FLOATING_PANEL_FILL_CLASS } from '@/components/shared/components/DropdownMenu'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { preventFocusLoss } from '@/components/shared/utils/dom-utils'

import { FACET_ROW_ATTRIBUTE, followPressFromRow } from '../hooks/use-facet-row-navigation'
import { headingRowId } from '../model/facet-logic'
import type { FacetOption, FacetSortMode } from '../model/facet-types'

/** The icon standing for each ordering on a section's sort button. */
const SORT_MODE_ICONS: Record<FacetSortMode, LucideIcon> = {
  alpha: ArrowDownAZ,
  'count-desc': ArrowDownWideNarrow,
  'count-asc': ArrowUpNarrowWide,
}

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
      case 'alpha':
        return tFilters('sortAlphabetically')
      case 'count-desc':
        return tFilters('sortByCountDesc')
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
 * The props of {@link GroupSection}.
 */
type GroupSectionProps = {
  /** Heading shown on the section. */
  label: string
  /** The options belonging to it, already ordered. */
  options: FacetOption[]
  /** How many of them are selected, absent where the heading carries no such badge. */
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
export function GroupSection({
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

  /**
   * Rolls the section up or out from its heading, focus on any row, one about to be rolled away included, moving
   * to the heading.
   *
   * @param event - The click, or the key standing in for one.
   */
  function handleHeadingClick(event: MouseEvent<HTMLButtonElement>) {
    // Focus on a row comes along to the heading
    followPressFromRow(event.currentTarget)

    // The section rolls up, or out
    onToggleCollapsed()
  }

  return (
    <div>
      {/* Section heading */}
      <div
        // The bleed is one-sided: the list pads its left only, so pulling the heading out on both would push
        // it past the right edge and leave the whole list with a horizontal scrollbar for those few pixels
        className={cn(
          '-ml-0.5 sm:-ml-1 px-3 sm:px-4 py-1.5 sm:py-2 border-b border-foreground/10 sticky top-0 z-10 flex items-center gap-2',
          FLOATING_PANEL_FILL_CLASS
        )}
        // A press anywhere along the heading leaves focus where it was
        onMouseDown={preventFocusLoss}
      >
        {/* The name, which rolls the section up and unrolls it */}
        <button
          type="button"
          onClick={handleHeadingClick}
          aria-expanded={!isCollapsed}
          // The heading is a row of the list in its own right, so the arrows reach it like any option
          {...FACET_ROW_ATTRIBUTE.stamp(headingRowId(groupKey))}
          tabIndex={isTabStop ? 0 : -1}
          className="flex flex-1 min-w-0 items-center gap-2 rounded-sm text-left text-[11px] sm:text-xs font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {/* The chevron, turned aside while the section is rolled up */}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 transition-transform duration-200',
              isCollapsed && '-rotate-90'
            )}
            aria-hidden="true"
          />

          {/* The section's name */}
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

        {/* The ordering, where the section offers one */}
        {showSortButton && <GroupSortButton sortMode={sortMode} onCycle={onCycleSortMode} />}
      </div>

      {/* The section's options, hidden while it is rolled up */}
      {!isCollapsed && options.map(renderOption)}
    </div>
  )
}
