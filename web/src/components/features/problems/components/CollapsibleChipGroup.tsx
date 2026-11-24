import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import { CHIP_CONSTANTS, OPPOSITE_LOGIC } from '../constants/filter-constants'
import type { ChipData, ChipGroupLogic } from '../types/filter-chip-types'
import type { LogicToggle } from '../types/problem-api-types'
import Chip from './Chip'

/**
 * The mark joining two chips of a group, for each way the group's values combine.
 */
const LOGIC_SYMBOLS: Record<LogicToggle, string> = {
  and: '∧',
  or: '∨',
}

/**
 * Props for the {@link CollapsibleChipGroup} component.
 */
type CollapsibleChipGroupProps = {
  /** The group's chips, in the order they read. */
  chips: ChipData[]
  /** How the group's values combine, drawn as a toggle between each two chips; null for a group with no choice. */
  logic: ChipGroupLogic | null
}

/**
 * A group of chips folding itself up past {@link CHIP_CONSTANTS.collapseThreshold} chips, showing the first few and
 * the way to see the rest.
 */
export function CollapsibleChipGroup({ chips, logic }: CollapsibleChipGroupProps) {
  // Whether the reader asked to see every chip
  const [isExpanded, setIsExpanded] = useState(false)

  // Whether there are more chips than the group shows folded
  const shouldCollapse = chips.length > CHIP_CONSTANTS.collapseThreshold

  // The chips on show: the first few while folded, and all of them otherwise
  const visibleChips =
    shouldCollapse && !isExpanded ? chips.slice(0, CHIP_CONSTANTS.collapseThreshold) : chips

  // How many chips the folding hides
  const hiddenCount = chips.length - CHIP_CONSTANTS.collapseThreshold

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
        {/* The chips, joined by the way the group combines them */}
        <JoinedChips chips={visibleChips} logic={logic} />

        {/* The way to see the rest, or to fold them back */}
        {shouldCollapse && (
          <span className="inline-flex flex-shrink-0 items-center">
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
  /** Whether every chip is showing. */
  isExpanded: boolean
  /** How many chips the folding hides. */
  hiddenCount: number
  /** Folds the group, or unfolds it. */
  onToggle: () => void
}

/**
 * The button folding a group of chips, reading how many it hides while folded.
 */
function ExpandCollapseButton({ isExpanded, hiddenCount, onToggle }: ExpandCollapseButtonProps) {
  // Translations for the shared actions
  const tActions = useTranslations('ui.actions')

  // What the button reads: the way back while unfolded, and how many more there are while folded
  const label = isExpanded ? tActions('showLess') : tActions('showCount', { count: hiddenCount })

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap',
        'text-focus/80 transition-colors hover:bg-focus/10 hover:text-focus/70',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'
      )}
      aria-label={label}
    >
      {/* Folded, the count trails the chips as a lowercase aside */}
      {isExpanded ? label : <span>... {label.toLowerCase()}</span>}
    </button>
  )
}

/**
 * Props for the {@link JoinedChips} component.
 */
type JoinedChipsProps = {
  /** The chips, in the order they read. */
  chips: ChipData[]
  /** How the chips' values combine; null for a group with no choice. */
  logic: ChipGroupLogic | null
}

/**
 * Chips side by side, each two joined by the mark of how their values combine (∧ for every one, ∨ for any) where the
 * group has that choice. Each mark is a button flipping it.
 */
function JoinedChips({ chips, logic }: JoinedChipsProps) {
  // Translations for the logic modes
  const tLogic = useTranslations('problems.filters.facets.logic')

  // Each way of combining, named in full
  const logicNames: Record<LogicToggle, string> = {
    and: tLogic('andFull'),
    or: tLogic('orFull'),
  }

  // What the joining mark says it does, in a group that has the choice
  const switchCopy = logic && {
    mode: logicNames[logic.mode],
    nextMode: logicNames[OPPOSITE_LOGIC[logic.mode]],
  }

  return (
    <>
      {chips.map((chip, index) => (
        <span key={chip.id} className="inline-flex min-w-0 max-w-full items-center">
          {/* The chip, offering its full name where that says more than the chip does, and cut short where its
              row runs out of room */}
          <Chip
            className="min-w-0"
            onClick={chip.onClick}
            title={chip.fullName && chip.fullName !== chip.displayName ? chip.fullName : undefined}
          >
            {chip.displayName}
          </Chip>

          {/* The joining mark, between two chips of a group that has the choice */}
          {index < chips.length - 1 && logic && switchCopy && (
            <button
              type="button"
              onClick={logic.onModeToggle}
              className="cursor-pointer"
              title={tLogic('currentLogic', switchCopy)}
              aria-label={tLogic('switchLogic', switchCopy)}
            >
              <span
                className={cn(
                  'mx-1.5 inline-flex items-center justify-center px-1.5 py-0.5',
                  'text-[11px] leading-none font-medium text-focus/80',
                  'rounded transition-colors hover:bg-focus/10 hover:text-focus/70'
                )}
              >
                {LOGIC_SYMBOLS[logic.mode]}
              </span>
            </button>
          )}
        </span>
      ))}
    </>
  )
}
