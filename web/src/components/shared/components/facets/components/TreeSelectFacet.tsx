import { ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Fragment,
  type KeyboardEvent,
  memo,
  type MouseEvent,
  type TouchEvent,
  useMemo,
} from 'react'

import { FOCUS_RING_INSET_CLASS } from '@/components/shared/components/Button'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { isExclusiveSelection } from '@/components/shared/utils/event-utils'
import { useSmartLongPress } from '@/hooks/use-smart-long-press'

import { useFacetPopover } from '../hooks/use-facet-popover'
import { type FacetRowAction, useFacetRowNavigation } from '../hooks/use-facet-row-navigation'
import { useTreeExpansion } from '../hooks/use-tree-expansion'
import { facetOptionAccessibleName } from '../model/facet-logic'
import type { TreeCheckState, TreeNode } from '../model/facet-types'
import {
  calculateParentState,
  drawnRowIds,
  expandableRowIds,
  indexTreeById,
  isNodeEffectivelyChecked,
  toggleNodeSelection,
} from '../model/tree-logic'
import { FacetHeader } from './FacetHeader'
import { FacetItemCount, FacetItemLabel } from './FacetItem'
import { FacetList } from './FacetList'
import { FacetPopover } from './FacetPopover'
import { FacetSearchRow, SEARCH_THRESHOLD } from './FacetSearchRow'
import { FacetTrigger } from './FacetTrigger'

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
type TreeNodeRowProps = {
  /** The node this row stands for. */
  node: TreeNode
  /** How deep it sits, which drives the indent and the level it is read at. */
  level: number
  /** Where it stands among the siblings drawn beside it, counting from one. */
  positionInSet: number
  /** How many siblings are drawn at its level. */
  setSize: number
  /** Whether its children are showing. */
  isExpanded: boolean
  /** Whether it has children on show to open at all, which a search can leave a branch without. */
  isExpandable: boolean
  /** Whether this row is the one the panel offers the tab order. */
  isTabStop: boolean
  /** How its checkbox reads. */
  checkState: TreeCheckState
  /** Applies a click on the row, or the keypress standing in for one. */
  onToggle: (event: MouseEvent | TouchEvent | KeyboardEvent) => void
  /** Narrows the selection to this node alone. */
  onExclusiveSelect: () => void
  /** Shows or hides the node's children. */
  onToggleExpansion: () => void
}

/**
 * One row of the tree, and the whole of what a screen reader is handed for a node: the checkbox and
 * the expander inside it are drawings, with the state they show carried by the row itself.
 *
 * The checkbox is inert and driven entirely by the row, so a click anywhere along the row means the
 * same thing.
 */
const TreeNodeRow = memo(function TreeNodeRow({
  node,
  level,
  positionInSet,
  setSize,
  isExpanded,
  isExpandable,
  isTabStop,
  checkState,
  onToggle,
  onExclusiveSelect,
  onToggleExpansion,
}: TreeNodeRowProps) {
  // A long-press stands in for the modifier click on a touchscreen
  const longPressHandlers = useSmartLongPress(onExclusiveSelect)

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

    // The keys mean what a click on the row means
    onToggle(event)
  }

  return (
    <div
      {...longPressHandlers}
      role="treeitem"
      // The hierarchy is drawn as one flat run of rows, so where a row sits in it is said here or nowhere
      aria-level={level + 1}
      aria-posinset={positionInSet}
      aria-setsize={setSize}
      aria-expanded={isExpandable ? isExpanded : undefined}
      aria-checked={TREE_ITEM_ARIA_CHECKED[checkState]}
      // Named rather than read from the row's contents, which leaves the count out of the name
      aria-label={facetOptionAccessibleName(node.displayName, node.count)}
      // Which row this is, so the walk down the tree knows what it has landed on and which branch
      // the arrows opening and closing one are aimed at
      data-facet-row-id={node.id}
      tabIndex={isTabStop ? 0 : -1}
      className={cn(
        'flex items-center rounded-md px-3 py-2 transition-colors hover:bg-foreground/5 cursor-pointer',
        FOCUS_RING_INSET_CLASS,
        node.count === 0 && 'opacity-50',
        'select-none'
      )}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        // A click leaves focus where it was, so a search term half typed can go on being typed
        event.preventDefault()
      }}
    >
      {/* Indent standing in for the levels above this one */}
      <div className="shrink-0" style={{ width: `${level * INDENT_PER_LEVEL}px` }} />

      {/* Expander, holding its width even when absent so the rows stay aligned */}
      <div className="w-6 h-6 flex items-center justify-center shrink-0">
        {isExpandable && (
          <span
            // The pointer's way at a branch, the row itself being what says the branch is open
            aria-hidden="true"
            onClick={(event) => {
              // Expanding is not selecting, so keep this click off the row
              event.stopPropagation()

              // Only the branch opens or closes
              onToggleExpansion()
            }}
            className="w-5 h-5 hover:bg-foreground/10 rounded flex items-center justify-center"
          >
            <ChevronRight
              className={cn('h-4 w-4 transition-transform text-muted', isExpanded && 'rotate-90')}
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
          checked={checkState === 'checked'}
          ref={(element) => {
            // The row is on its way out, so there is nothing left to mark
            if (!element) return

            // Part-selected is a property with no attribute behind it, so it is set by hand
            element.indeterminate = checkState === 'indeterminate'
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

/**
 * The props of {@link TreeSelectFacet}.
 */
type TreeSelectFacetProps = {
  /** Name of what the facet filters by. */
  title: string
  /** The whole hierarchy it can offer. */
  options: TreeNode[]
  /** Ids of the nodes selected in their own right. */
  selected: string[]
  /** Applies a new selection. */
  onChange: (next: string[]) => void
  /** Prompt shown in the empty search box. */
  searchPlaceholder?: string
  /** What the trigger reads when nothing is selected. */
  closedLabel: string
  /** Nodes to start open, ignored for any that have no children. */
  defaultExpandedIds?: string[]
  /** Explanation offered beside the title. */
  titleTooltip?: string
}

/**
 * A facet over a hierarchy, where selecting a node stands for everything beneath it.
 *
 * Selections are held at the shallowest node that covers them, so picking a whole branch
 * records one id rather than every leaf under it. Turning a single child back off
 * therefore has to break its parent apart into the siblings that are still wanted.
 */
export function TreeSelectFacet({
  title,
  options,
  selected,
  onChange,
  searchPlaceholder,
  closedLabel,
  defaultExpandedIds = [],
  titleTooltip,
}: TreeSelectFacetProps) {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  // The unfiltered tree by id, since a searched-down node still selects its real subtree
  const nodesById = useMemo(() => indexTreeById(options), [options])

  // Every node in the hierarchy, at any depth
  const allNodes = useMemo(() => [...nodesById.values()], [nodesById])

  // The popover and the search term the tree is narrowed by
  const facet = useFacetPopover(options)

  // Which branches stand open, and what the search term has left of the hierarchy
  const tree = useTreeExpansion(options, facet.query, defaultExpandedIds)

  // The branches with something to open, judged on the hierarchy as drawn rather than the whole of it
  const expandableIds = useMemo(() => expandableRowIds(tree.visibleTree), [tree.visibleTree])

  /**
   * Applies a key pressed on a row, which for a hierarchy means opening and closing its branches.
   *
   * @param rowId - The node focus is on.
   * @param action - What the key asked of it.
   * @returns Whether the branch acted.
   */
  function onRowAction(rowId: string, action: FacetRowAction) {
    // A row with nothing on show beneath it has no branch to open or close
    if (!expandableIds.has(rowId)) return false

    // Whether the branch already stands open, which is what decides which key does anything
    const isExpanded = tree.expandedIds.has(rowId)

    // What the key asked for, each answering whether the branch was in a state to do it
    switch (action) {
      // Left closes an open branch
      case 'collapse':
        // One already closed leaves the key to the browser
        if (!isExpanded) return false

        // Close it
        tree.collapseNode(rowId)

        // The key is spoken for
        return true

      // Right opens a closed one
      case 'expand':
        // One already open leaves the key to the browser
        if (isExpanded) return false

        // Open it
        tree.expandNode(rowId)

        // The key is spoken for
        return true

      // A hierarchy has no orderings to cycle, its rows standing where the tree puts them
      case 'cycle-sort':
        return false

      // An action outside the union, which the type system rules out
      default:
        return assertNever(action)
    }
  }

  // Keyboard focus moving down the rows
  const list = useFacetRowNavigation({ onRowAction })

  // The rows the tree currently draws, in the order they appear
  const drawnNodeIds = useMemo(
    () => drawnRowIds(tree.visibleTree, tree.expandedIds),
    [tree.visibleTree, tree.expandedIds]
  )

  // The one row the panel offers the page's tab order: the node standing, so a reopened facet lands on
  // what it is already filtered by, and the top of the tree where nothing stands
  const tabStopRowId = drawnNodeIds.find((nodeId) => selected.includes(nodeId)) ?? drawnNodeIds[0]

  /** Empties the selection. */
  function clearAll() {
    // Nothing to report when the selection is already empty
    if (selected.length) onChange([])
  }

  /**
   * Renders a node and, when it is open, everything beneath it.
   *
   * @param node - The node to render.
   * @param level - How deep it sits, which drives the indent and the level it is read at.
   * @param positionInSet - Where it stands among the siblings drawn beside it, counting from one.
   * @param setSize - How many siblings are drawn at its level.
   * @returns The node's row, followed by its children's rows when it stands open.
   */
  function renderNode(node: TreeNode, level: number, positionInSet: number, setSize: number) {
    // The same node in the unfiltered tree, which is what its selection stands for
    const originalNode = nodesById.get(node.id)

    // Whether this branch stands open
    const isExpanded = tree.expandedIds.has(node.id)

    // Whether it is a branch at all, judged on the real tree rather than the narrowed one
    const hasChildren = (originalNode?.children?.length ?? 0) > 0

    // Whether it has anything on show to open, a search having possibly taken its children away
    const isExpandable = expandableIds.has(node.id)

    // What the node's subtree is doing, which is what a branch nobody selected outright reads as
    const parentState = originalNode ? calculateParentState(originalNode, selected) : 'unchecked'

    // Whether the selection covers the node, in its own right or through an ancestor
    const isChecked = isNodeEffectivelyChecked(node.id, selected, options)

    // How its checkbox reads, a covered node standing checked whatever its subtree is doing
    const checkState: TreeCheckState = isChecked ? 'checked' : parentState

    /**
     * Applies a click on the row, honouring the modifier that narrows to one node.
     *
     * @param event - The click or keypress, read for the modifier it was made with.
     */
    function handleToggle(event: MouseEvent | TouchEvent | KeyboardEvent) {
      // A node missing from the index cannot be reasoned about
      if (!originalNode) return

      // The modifier narrows the whole facet to this one node
      if (isExclusiveSelection(event)) {
        // Everything else drops out of the selection
        onChange([node.id])

        // The plain-click path below has nothing left to do
        return
      }

      // What the selection becomes once this node is toggled
      const nextSelected = toggleNodeSelection(originalNode, selected, options)

      // Whether this click has just taken a whole branch
      const justSelectedBranch =
        hasChildren && !selected.includes(node.id) && nextSelected.includes(node.id)

      // Opening it shows what the branch now covers
      if (justSelectedBranch && !isExpanded) {
        tree.expandNode(node.id)
      }

      // Hand the new selection up
      onChange(nextSelected)
    }

    // The node's own row, with its children beneath it when it stands open
    return (
      <Fragment key={node.id}>
        {/* The node's own row */}
        <TreeNodeRow
          node={node}
          level={level}
          positionInSet={positionInSet}
          setSize={setSize}
          isExpanded={isExpanded}
          isExpandable={isExpandable}
          isTabStop={node.id === tabStopRowId}
          checkState={checkState}
          onToggle={handleToggle}
          onExclusiveSelect={() => onChange([node.id])}
          onToggleExpansion={() => tree.toggleNode(node.id)}
        />

        {/* The open branch's own rows, one level further in and standing among the tree's own */}
        {isExpandable &&
          isExpanded &&
          (node.children ?? []).map((child, index, siblings) =>
            renderNode(child, level + 1, index + 1, siblings.length)
          )}
      </Fragment>
    )
  }

  return (
    <div className="w-full">
      {/* The heading naming the facet */}
      <FacetHeader
        title={title}
        labelId={facet.labelId}
        anySelected={selected.length > 0}
        onClear={clearAll}
        titleTooltip={titleTooltip}
      />

      {/* The button that opens it */}
      <FacetTrigger
        open={facet.open}
        refs={facet.refs}
        getReferenceProps={facet.getReferenceProps}
        closedLabel={closedLabel}
        selectedLabel={null}
        count={selected.length}
        title={title}
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
        initialFocus={facet.initialFocus}
        onKeyDown={list.onListKeyDown}
      >
        {/* Search row, offered once the hierarchy as a whole is big enough */}
        {allNodes.length >= SEARCH_THRESHOLD && (
          <FacetSearchRow
            query={facet.query}
            setQuery={facet.setQuery}
            searchRef={facet.searchRef}
            title={title}
            placeholder={searchPlaceholder ?? tFilters('searchPlaceholder')}
            onArrowDownToList={list.focusFirstRow}
          />
        )}

        {/* The hierarchy itself, or word that a search term matched nothing in it */}
        {tree.visibleTree.length === 0 && facet.query ? (
          <div className="px-3 py-3 text-sm text-muted">{tFilters('noResults')}</div>
        ) : (
          <FacetList role="tree" labelId={facet.labelId} listRef={list.listRef}>
            {/* The hierarchy, walked from its roots */}
            {tree.visibleTree.map((node, index, roots) =>
              renderNode(node, 0, index + 1, roots.length)
            )}
          </FacetList>
        )}
      </FacetPopover>
    </div>
  )
}
