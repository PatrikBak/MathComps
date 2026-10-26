import { ChevronRight } from 'lucide-react'
import { type KeyboardEvent, memo, type MouseEvent, type TouchEvent, useRef } from 'react'

import { FOCUS_RING_INSET_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'
import { preventFocusLoss } from '@/components/shared/utils/dom-utils'
import { useSmartLongPress } from '@/hooks/use-smart-long-press'

import { FACET_ROW_ATTRIBUTE, followPressFromRow } from '../hooks/use-facet-row-navigation'
import { facetOptionAccessibleName } from '../model/facet-logic'
import type { TreeCheckState } from '../model/facet-types'
import type { DrawnTreeRow } from '../model/tree-logic'
import { FacetItemCount, FacetItemLabel } from './FacetItem'

/** How far one level of nesting indents a row, in pixels. */
const INDENT_PER_LEVEL = 16

/** How a row announces the state its checkbox reads in. */
const TREE_ITEM_ARIA_CHECKED: Record<TreeCheckState, boolean | 'mixed'> = {
  checked: true,
  indeterminate: 'mixed',
  unchecked: false,
}

/**
 * The props of {@link TreeNodeRow}.
 */
type TreeNodeRowProps = DrawnTreeRow & {
  /** Whether this row is the one the panel offers the tab order. */
  isTabStop: boolean
  /** How its checkbox reads. */
  checkState: TreeCheckState
  /** Applies a click on a node's row, or the keypress standing in for one. */
  onToggle: (nodeId: string, event: MouseEvent | TouchEvent | KeyboardEvent) => void
  /** Narrows the selection to one node alone. */
  onExclusiveSelect: (nodeId: string) => void
  /** Shows or hides a node's children. */
  onToggleExpansion: (nodeId: string) => void
}

/**
 * One row of the tree, and the whole of what a screen reader is handed for a node: the checkbox and
 * the expander inside it are drawings, with the state they show carried by the row itself.
 *
 * The checkbox is inert and driven entirely by the row, so a click anywhere along the row but its arrow
 * means the same thing.
 */
export const TreeNodeRow = memo(function TreeNodeRow({
  node,
  level,
  positionInSet,
  setSize,
  expanded,
  isTabStop,
  checkState,
  onToggle,
  onExclusiveSelect,
  onToggleExpansion,
}: TreeNodeRowProps) {
  // The row itself
  const rowRef = useRef<HTMLDivElement>(null)

  // A long-press stands in for the modifier click on a touchscreen
  const longPressHandlers = useSmartLongPress(() => onExclusiveSelect(node.id))

  /**
   * Applies the keys that stand for a click on the row.
   *
   * @param event - The keypress, read for the modifier that narrows to this node alone.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Every other key belongs to the walk between the rows, or to the browser
    if (event.key !== ' ' && event.key !== 'Enter') return

    // Space would otherwise scroll the list out from under the row
    event.preventDefault()

    // A key held down answers once, the way a checkbox does
    if (event.repeat) return

    // The keys mean what a click on the row means
    onToggle(node.id, event)
  }

  /**
   * Applies a click on the row.
   *
   * @param event - The click, read for the modifier that narrows to this node alone.
   */
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    // Focus on another row comes along to this one, the press itself having moved none
    followPressFromRow(event.currentTarget)

    // The click picks the node, or narrows to it
    onToggle(node.id, event)
  }

  /**
   * Opens or closes the branch from its arrow. Focus on a row comes along to this one, so closing the branch over
   * the focused row keeps focus in the panel.
   *
   * @param event - The click on the arrow.
   */
  function handleExpanderClick(event: MouseEvent<HTMLSpanElement>) {
    // Expanding is not selecting, so keep this click off the row
    event.stopPropagation()

    // Focus on a row comes along to the branch
    if (rowRef.current) followPressFromRow(rowRef.current)

    // Only the branch opens or closes
    onToggleExpansion(node.id)
  }

  return (
    <div
      ref={rowRef}
      {...longPressHandlers}
      role="treeitem"
      // The hierarchy is drawn as one flat run of rows, so where a row sits in it is said here or nowhere
      aria-level={level + 1}
      aria-posinset={positionInSet}
      aria-setsize={setSize}
      aria-expanded={expanded}
      aria-checked={TREE_ITEM_ARIA_CHECKED[checkState]}
      // Named rather than read from the row's contents, which leaves the count out of the name
      aria-label={facetOptionAccessibleName(node.displayName, node.count)}
      // Which row this is, so the walk down the tree knows what it has landed on and which branch
      // the arrows opening and closing one are aimed at
      {...FACET_ROW_ATTRIBUTE.stamp(node.id)}
      tabIndex={isTabStop ? 0 : -1}
      className={cn(
        'flex items-center rounded-md px-3 py-2 transition-colors hover:bg-foreground/5 cursor-pointer',
        FOCUS_RING_INSET_CLASS,
        node.count === 0 && 'opacity-50',
        'select-none'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      // A press leaves focus where it was
      onMouseDown={preventFocusLoss}
    >
      {/* Indent standing in for the levels above this one */}
      <div className="shrink-0" style={{ width: `${level * INDENT_PER_LEVEL}px` }} />

      {/* Expander, holding its width even when absent so the rows stay aligned */}
      <div className="w-6 h-6 flex items-center justify-center shrink-0">
        {expanded !== undefined && (
          <span
            // The pointer's way at a branch, the row itself being what says the branch is open
            aria-hidden="true"
            onClick={handleExpanderClick}
            // A press held on the arrow is still a press on the arrow, never the row's long press narrowing to it
            onPointerDown={(event) => event.stopPropagation()}
            className="w-5 h-5 hover:bg-foreground/10 rounded flex items-center justify-center"
          >
            <ChevronRight
              className={cn('h-4 w-4 transition-transform text-muted', expanded && 'rotate-90')}
            />
          </span>
        )}
      </div>

      {/* Checkbox */}
      <div className="flex items-center shrink-0 mr-2">
        <input
          type="checkbox"
          className="form-checkbox pointer-events-none"
          // A drawing of what the row announces itself, and a second checkbox to anyone reading it aloud
          aria-hidden="true"
          tabIndex={-1}
          checked={TREE_ITEM_ARIA_CHECKED[checkState] === true}
          ref={(element) => {
            // The row is on its way out, so there is nothing left to mark
            if (!element) return

            // Part-selected is a property with no attribute behind it, so it is set by hand
            element.indeterminate = TREE_ITEM_ARIA_CHECKED[checkState] === 'mixed'
          }}
          readOnly
        />
      </div>

      {/* The node's name, taking whatever width the row has left */}
      <div className="flex flex-grow min-w-0 items-center">
        <FacetItemLabel>{node.displayName}</FacetItemLabel>
      </div>

      {/* Count trailing the row */}
      <FacetItemCount count={node.count} />
    </div>
  )
})
