import { useState } from 'react'

import { cn } from '../../../shared/utils/css-utils'
import { CHIP_CONSTANTS } from '../constants/filter-constants'
import Chip from './Chip'

/**
 * Represents a single chip's data structure.
 * Used for both competition chips and regular filter chips.
 */
export type ChipData = {
  /** Unique identifier for the chip; used as React key and for tracking */
  id: string
  /** Short display text shown on the chip */
  displayName: string
  /** Optional full name displayed in tooltip when hovering over the chip */
  fullName?: string
  /** Callback invoked when user clicks the chip (supports Ctrl/Cmd+Click for exclusive selection) */
  onClick: (event: React.MouseEvent) => void
  /** Whether this chip is currently selected (for visual highlighting) */
  isSelected?: boolean
}

/**
 * Controls how a group of filter chips is displayed and whether they collapse
 * when exceeding the threshold.
 */
type CollapsibleChipGroupProps = {
  /** Array of chip data to display in this group */
  chips: ChipData[]
  /** Logical mode determining which joiner symbol to display between chips */
  mode?: 'and' | 'or'
  /** Optional callback invoked when user clicks on a joiner to toggle the logic mode */
  onModeToggle?: () => void
}

/**
 * Renders a group of chips with automatic collapse/expand functionality.
 * When the number of chips exceeds CHIP_COLLAPSE_THRESHOLD, it shows only
 * the first few chips plus a "... and X more" button.
 */
export function CollapsibleChipGroup({ chips, mode, onModeToggle }: CollapsibleChipGroupProps) {
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
      {mode && visibleChips.length >= 2 ? (
        // Chips with joiners
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
          <JoinedChips items={visibleChips} mode={mode} onModeToggle={onModeToggle} />
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
      ) : (
        // Chips without joiners
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
          {visibleChips.map((chip) => (
            <Chip
              key={chip.id}
              onClick={chip.onClick}
              clickable={true}
              isSelected={chip.isSelected}
              title={
                'fullName' in chip && chip.fullName && chip.fullName !== chip.displayName
                  ? (chip as { fullName: string }).fullName
                  : undefined
              }
            >
              {chip.displayName}
            </Chip>
          ))}
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
      )}
    </div>
  )
}

/**
 * Controls the button that toggles between showing all chips or a limited subset.
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
  return (
    <button
      onClick={onToggle}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium 
        text-indigo-300 hover:bg-indigo-400/10 hover:text-indigo-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
        transition-colors whitespace-nowrap"
      aria-label={isExpanded ? 'Zobraziť menej' : `Zobraziť ${hiddenCount} ďalších`}
      type="button"
    >
      {isExpanded ? (
        'Zobraziť menej'
      ) : (
        <>
          <span>... a {hiddenCount} ďalších</span>
        </>
      )}
    </button>
  )
}

/**
 * Props for the JoinedChips component that renders chips with logical joiners.
 */
type JoinedChipsProps = {
  /** Array of chip data to render with joiners between them */
  items: ChipData[]
  /** Logical mode: 'and' displays ∧ symbol, 'or' displays ∨ symbol */
  mode: 'and' | 'or'
  /** Optional callback invoked when user clicks on a joiner to toggle the logic mode */
  onModeToggle?: () => void
}

/**
 * Helper component for rendering chips with math joiners (∧ for AND, ∨ for OR).
 * Used for logical tag/author combinations.
 * Joiners are clickable when onModeToggle is provided, allowing users to toggle
 * between AND and OR logic.
 */
function JoinedChips({ items, mode, onModeToggle }: JoinedChipsProps) {
  const joinerSymbol = mode === 'and' ? '∧' : '∨'
  const nextModeLabel = mode === 'and' ? 'OR (aspoň jedno)' : 'AND (všetky)'
  const currentModeLabel = mode === 'and' ? 'AND (všetky)' : 'OR (aspoň jedno)'

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
          {index < items.length - 1 && (
            <button
              onClick={onModeToggle}
              className={onModeToggle ? 'cursor-pointer' : 'cursor-default'}
              title={
                onModeToggle
                  ? `Aktuálne: ${currentModeLabel}. Kliknutím prepnete na ${nextModeLabel}`
                  : undefined
              }
              aria-label={
                onModeToggle
                  ? `Prepnúť logiku z ${currentModeLabel} na ${nextModeLabel}`
                  : `Logika: ${currentModeLabel}`
              }
              type="button"
              disabled={!onModeToggle}
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center mx-1.5 px-1.5 py-0.5',
                  'text-indigo-100 text-[11px] font-medium leading-none',
                  onModeToggle &&
                    'hover:text-indigo-200 hover:bg-indigo-400/10 rounded transition-colors'
                )}
              >
                {joinerSymbol}
              </span>
            </button>
          )}
        </span>
      ))}
    </>
  )
}
