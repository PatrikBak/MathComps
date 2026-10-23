import { type ChangeEvent, memo, type MouseEvent, useCallback } from 'react'

import { FOCUS_RING_ROW_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'
import { isExclusiveSelection } from '@/components/shared/utils/event-utils'
import { useSmartLongPress } from '@/hooks/use-smart-long-press'

import { facetOptionAccessibleName, toggleOptionSelection } from '../model/facet-logic'
import type { FacetOption, FacetSelectionMode } from '../model/facet-types'
import { FacetItemCount, FacetItemLabel } from './FacetItem'

/**
 * How a row draws its control and answers a click on it, per the number of its facet's options that may stand at
 * once.
 */
type SelectionModeRow = {
  /** The input a row is built around. */
  inputType: 'radio' | 'checkbox'
  /** The class that styles it. */
  controlClass: string
  /** Whether picking an option unseats whatever stood before, rather than joining it. */
  replacesSelection: boolean
  /** Whether the rows' controls answer to one shared name, which makes the browser treat them as one group. */
  groupsUnderOneName: boolean
}

/** How each selection mode draws a row. */
const SELECTION_MODE_ROWS: Record<FacetSelectionMode, SelectionModeRow> = {
  single: {
    inputType: 'radio',
    controlClass: 'form-radio',
    replacesSelection: true,
    groupsUnderOneName: true,
  },
  multiple: {
    inputType: 'checkbox',
    controlClass: 'form-checkbox',
    replacesSelection: false,
    groupsUnderOneName: false,
  },
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
 * One selectable row. A click with Ctrl (Cmd on a Mac) or a long press narrows the selection to just this
 * option, which is far quicker than clearing and re-picking when a list runs long.
 */
export const OptionItem = memo(function OptionItem({
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
    SELECTION_MODE_ROWS[selectionMode]

  // A function which drops every other option from the selection
  const onExclusiveSelect = useCallback(() => {
    // Whatever was selected before is irrelevant, so the previous value goes unread
    onChange(() => [option.id])
  }, [onChange, option.id])

  // A function which applies a change of the control: it adds this option to the selection, or takes it back
  // out, and where only one option may stand it unseats whatever stood before instead. A click held with the
  // modifier narrows to this option.
  const onToggle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      // The change rides on the click that made it, which says whether the modifier was down
      if (
        event.nativeEvent instanceof globalThis.MouseEvent &&
        isExclusiveSelection(event.nativeEvent)
      ) {
        // Narrow to this one option
        onExclusiveSelect()

        // The toggle below is not this click's business
        return
      }

      // The change is expressed against whatever the selection is when it lands
      onChange((previousSelected) =>
        replacesSelection ? [option.id] : toggleOptionSelection(option.id, previousSelected)
      )
    },
    [replacesSelection, onChange, onExclusiveSelect, option.id]
  )

  // A function which clears the facet
  const onClearSelection = useCallback(() => {
    // Whatever stood before is going, so the previous value goes unread
    onChange(() => [])
  }, [onChange])

  // A long-press stands in for the modifier click on a touchscreen
  const longPressHandlers = useSmartLongPress(onExclusiveSelect)

  /**
   * Intercepts a modified click landing beside the control, and the click on a standing radio that no change
   * event follows, leaving every other click to the control itself.
   *
   * @param event - The click, read for the modifier key it was made with.
   */
  function handleClick(event: MouseEvent<HTMLLabelElement>) {
    // Whether the click landed on the control itself, which it has already changed by now. Such a click is never
    // cancelled, since the browser would then restore the control's old state after React drew the new one.
    const isOnControl = event.target === event.currentTarget.control

    // A modified click narrows to this option however many stand
    if (isExclusiveSelection(event)) {
      // One on the control is narrowed by the change event that follows it
      if (isOnControl) return

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
      if (!isOnControl) event.preventDefault()

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
        {/* The checkbox, or the radio where only one option may stand */}
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

        {/* The option's name */}
        <FacetItemLabel>{option.displayName}</FacetItemLabel>

        {/* Count trailing the row */}
        <FacetItemCount count={option.count} />
      </label>
    </div>
  )
})
