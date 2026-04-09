import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { cn } from '../../../shared/utils/css-utils'
import { CHIP_CONSTANTS } from '../constants/filter-constants'
import Chip from './Chip'

/**
 * Represents a single chip's data structure, used within {@link CollapsibleChipGroup}
 */
export type ChipData = {
  /** Unique identifier for the chip; used as React key and for tracking */
  id: string
  /** Short display text shown on the chip */
  displayName: string
  /** Optional full name displayed in tooltip when hovering over the chip */
  fullName?: string
  /** Callback invoked when user clicks the chip */
  onClick: (event: React.MouseEvent) => void
  /** Whether this chip is currently selected */
  isSelected?: boolean
}

/**
 * Config for {@link CollapsibleChipGroup}
 */
type LogicalChipsProps = {
  /** Logical mode determining which joiner symbol to display between chips */
  mode: 'and' | 'or'
  /** Callback invoked when user clicks on a joiner to toggle the logic mode */
  onModeToggle: () => void
}

/**
 * Props for the {@link CollapsibleChipGroup} component
 */
type CollapsibleChipGroupProps = {
  /** Array of chip data to display in this group */
  chips: ChipData[]
  /** Binary logic mode and toggle callback for filters where this makes sense
   * (e.g. tag/author combinations) */
  logicalChipsProps?: LogicalChipsProps
}

/**
 * Renders a group of chips with automatic collapse/expand functionality.
 * When the number of chips exceeds {@link CHIP_CONSTANTS.collapseThreshold}, it shows only
 * the first few chips plus a "... and X more" button.
 */
export function CollapsibleChipGroup({ chips, logicalChipsProps }: CollapsibleChipGroupProps) {
  // Are chips currently expnanded? Initially no
  const [isExpanded, setIsExpanded] = useState(false)

  // Should we offer an option to collapse?
  const shouldCollapse = chips.length > CHIP_CONSTANTS.collapseThreshold

  // Which chips are currntly displayed...Either only at most the limit
  // or we have expanded them and we're getting all of them
  const visibleChips =
    shouldCollapse && !isExpanded ? chips.slice(0, CHIP_CONSTANTS.collapseThreshold) : chips

  // How many hidden chips?
  const hiddenCount = chips.length - CHIP_CONSTANTS.collapseThreshold

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
        {visibleChips.length >= 2 ? (
          // More than 1 chip
          <JoinedChips items={visibleChips} logicalChipsProps={logicalChipsProps} />
        ) : (
          // 0 or 1 chip
          visibleChips.map((chip) => (
            <Chip
              key={chip.id}
              onClick={chip.onClick}
              clickable={true}
              isSelected={chip.isSelected}
              title={
                // Tooltip text, only if different from display name and given by fullName
                'fullName' in chip && chip.fullName && chip.fullName !== chip.displayName
                  ? (chip as { fullName: string }).fullName
                  : undefined
              }
            >
              {chip.displayName}
            </Chip>
          ))
        )}

        {/* Show the collapse button if we have hidden chips */}
        {shouldCollapse && (
          <span className="inline-flex items-center flex-shrink-0">
            <ExpandCollapseButton
              isExpanded={isExpanded}
              hiddenCount={hiddenCount}
              onToggle={() => setIsExpanded(!isExpanded)}
            />
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Props for the {@link ExpandCollapseButton} component.
 */
type ExpandCollapseButtonProps = {
  /** Current expansion state; true when showing all chips, false when collapsed */
  isExpanded: boolean
  /** Number of chips currently hidden from view when collapsed */
  hiddenCount: number
  /** Callback invoked when user clicks the expand/collapse button */
  onToggle: () => void
}

/**
 * Button that toggles between "show more" and "show less" states.
 * Displays the count of hidden items when collapsed.
 */
function ExpandCollapseButton({ isExpanded, hiddenCount, onToggle }: ExpandCollapseButtonProps) {
  // Get translations
  const tActions = useTranslations('ui.actions')

  return (
    <button
      onClick={onToggle}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium 
        text-focus/80 hover:bg-focus/10 hover:text-focus/70
        focus:outline-none focus-visible:ring-2 focus-visible:ring-focus
        transition-colors whitespace-nowrap"
      aria-label={isExpanded ? tActions('showLess') : tActions('showCount', { count: hiddenCount })}
      type="button"
    >
      {isExpanded ? (
        tActions('showLess')
      ) : (
        <>
          <span>... {tActions('showCount', { count: hiddenCount }).toLowerCase()}</span>
        </>
      )}
    </button>
  )
}

/**
 * Props for the {@link JoinedChips} component.
 */
type JoinedChipsProps = {
  /** Array of chip data to display */
  items: ChipData[]
  /** Optional logical mode config for AND/OR toggling */
  logicalChipsProps?: LogicalChipsProps
}

/**
 * Helper component for rendering chips, optionally with math joiners (∧ for AND, ∨ for OR).

*/
function JoinedChips({ items, logicalChipsProps }: JoinedChipsProps) {
  // Get translations for logic mode labels
  const tLogic = useTranslations('problems.filters.facets.logic')

  // Mode config - only used when we want to toggle between AND and OR logic
  const MODE_CONFIG = {
    and: {
      symbol: '∧',
      currentLabel: tLogic('andFull'),
      nextLabel: tLogic('orFull'),
    },
    or: {
      symbol: '∨',
      currentLabel: tLogic('orFull'),
      nextLabel: tLogic('andFull'),
    },
  } as const

  // Only compute labels when we have logical props
  const modeConfig = logicalChipsProps ? MODE_CONFIG[logicalChipsProps.mode] : undefined

  return (
    <>
      {items.map((item, index) => (
        <span key={item.id} className="inline-flex items-center">
          <Chip
            onClick={item.onClick}
            clickable={true}
            isSelected={item.isSelected}
            title={item.fullName && item.fullName !== item.displayName ? item.fullName : undefined}
          >
            {item.displayName}
          </Chip>
          {/* Only render joiner when logical mode is configured */}
          {index < items.length - 1 && logicalChipsProps && modeConfig && (
            <button
              onClick={logicalChipsProps.onModeToggle}
              className="cursor-pointer"
              title={tLogic('currentLogic', {
                mode: modeConfig.currentLabel,
                nextMode: modeConfig.nextLabel,
              })}
              aria-label={tLogic('switchLogic', {
                mode: modeConfig.currentLabel,
                nextMode: modeConfig.nextLabel,
              })}
              type="button"
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center mx-1.5 px-1.5 py-0.5',
                  'text-focus/80 text-[11px] font-medium leading-none',
                  'hover:text-focus/70 hover:bg-focus/10 rounded transition-colors'
                )}
              >
                {modeConfig.symbol}
              </span>
            </button>
          )}
        </span>
      ))}
    </>
  )
}
