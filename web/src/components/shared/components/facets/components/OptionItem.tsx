import { type ChangeEvent, type KeyboardEvent, memo, type MouseEvent, useCallback } from 'react'

import { FOCUS_RING_ROW_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'
import { preventFocusLoss } from '@/components/shared/utils/dom-utils'
import { isExclusiveSelection } from '@/components/shared/utils/event-utils'
import { useSmartLongPress } from '@/hooks/use-smart-long-press'

import { FACET_ROW_ATTRIBUTE, followPressFromRow } from '../hooks/use-facet-row-navigation'
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

  // A function which applies a plain pick of the row: it adds this option to the selection, or takes it back out.
  // Where only one option may stand it unseats whatever stood before instead, and picking the one standing clears
  // the facet, the only way back to showing everything from a row.
  const onPick = useCallback(() => {
    // The pick is expressed against whatever the selection is when it lands
    onChange((previousSelected) => {
      // One option at a time: this one in, or out where it was the one standing
      if (replacesSelection) return previousSelected.includes(option.id) ? [] : [option.id]

      // Several at once: this one joins them, or leaves
      return toggleOptionSelection(option.id, previousSelected)
    })
  }, [replacesSelection, onChange, option.id])

  // A function which applies a change of the control, a click held with the modifier narrowing to this option
  const onToggle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      // The change rides on the click that made it, which says whether the modifier was down
      if (
        event.nativeEvent instanceof globalThis.MouseEvent &&
        isExclusiveSelection(event.nativeEvent)
      ) {
        // Narrow to this one option
        onExclusiveSelect()

        // The pick below is not this click's business
        return
      }

      // An ordinary pick
      onPick()
    },
    [onExclusiveSelect, onPick]
  )

  // A long-press stands in for the modifier click on a touchscreen
  const longPressHandlers = useSmartLongPress(onExclusiveSelect)

  /**
   * Answers a click landing beside the control, and the click on a standing radio that no change event follows,
   * leaving every other click to the control itself.
   *
   * @param event - The click, read for the modifier key it was made with.
   */
  function handleClick(event: MouseEvent<HTMLLabelElement>) {
    // The row's control, which is the row the keys walk
    const control = event.currentTarget.control

    // Focus on another row comes along to this one, the press itself having moved none
    if (control) followPressFromRow(control)

    // Whether the click landed on the control itself, which it has already changed by now. Such a click is never
    // cancelled, since the browser would then restore the control's old state after React drew the new one.
    const isOnControl = event.target === control

    // Beside the control, the label would hand the click on and move focus onto the control with it, which takes
    // the caret out of the search box, so the row answers the click itself
    if (!isOnControl) {
      // The control and focus both stay where they are
      event.preventDefault()

      // A modified click narrows to this option however many stand, and a plain one picks it
      if (isExclusiveSelection(event)) onExclusiveSelect()
      else onPick()

      // The click is answered
      return
    }

    // Picking the radio already standing leaves it checked, so no change event follows and the pick has to come
    // from the click, a modified one leaving the option standing alone as it already does
    if (replacesSelection && checked && !isExclusiveSelection(event)) onPick()
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 sm:gap-3 rounded-md transition-colors',
        checked ? 'bg-focus/15' : 'hover:bg-foreground/5',
        // Drawn as an edge rather than a fill, so it reads apart from the tint saying it is standing
        FOCUS_RING_ROW_CLASS,
        isZeroCount && 'opacity-50',
        'select-none'
      )}
    >
      {/* The row, which a click anywhere along means the same thing for */}
      <label
        className="flex items-center gap-2 flex-1 min-w-0 px-2.5 sm:px-3 py-1.5 sm:py-2 cursor-pointer"
        onClick={handleClick}
        // A press leaves focus where it was
        onMouseDown={preventFocusLoss}
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
          // Brought into view with the row's padding around it, so a row the keys reach shows whole, its ring
          // and all
          className={cn(controlClass, 'shrink-0 scroll-my-1.5 sm:scroll-my-2')}
          aria-label={facetOptionAccessibleName(option.displayName, option.count)}
          // Which row this is, so the walk down the list knows what it has landed on
          {...FACET_ROW_ATTRIBUTE.stamp(option.id)}
          tabIndex={isTabStop ? 0 : -1}
          onKeyDown={holdSideArrowsOff}
        />

        {/* The option's name */}
        <FacetItemLabel>{option.displayName}</FacetItemLabel>

        {/* Count trailing the row */}
        <FacetItemCount count={option.count} />
      </label>
    </div>
  )
})

/**
 * Holds Left and Right off a row's control, the list's arrows only walking its rows: a radio would otherwise step to
 * the neighbouring option and pick it.
 *
 * @param event - The keypress on the control.
 */
function holdSideArrowsOff(event: KeyboardEvent<HTMLInputElement>) {
  // A key held with a modifier stays the browser's, Alt+Left and Cmd+Left going back a page
  if (event.altKey || event.ctrlKey || event.metaKey) return

  // The side arrows lose what the browser would do with them, every other key keeping it
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') event.preventDefault()
}
