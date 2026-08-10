import { ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Fragment, memo, type MouseEvent, type TouchEvent, useMemo } from 'react'

import { FOCUS_RING_INSET_CLASS, FOCUS_RING_ROW_CLASS } from '@/components/shared/components/Button'
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

/**
 * The props of {@link TreeNodeRow}.
 */
type TreeNodeRowProps = {
  /** The node this row stands for. */
  node: TreeNode
  /** How deep it sits, which drives the indent. */
  level: number
  /** Whether its children are showing. */
  isExpanded: boolean
  /** Whether it has children in the unfiltered tree. */
  hasChildren: boolean
  /** Whether to offer an expander at all, which a search can suppress. */
  showChevron: boolean
  /** Whether the selection covers it, in its own right or through an ancestor. */
  isChecked: boolean
  /** Whether this row is the one the panel offers the tab order. */
  isTabStop: boolean
  /** How its checkbox should read. */
  parentState: TreeCheckState
  /** Applies a click on the row. */
  onToggle: (event: MouseEvent | TouchEvent) => void
  /** Narrows the selection to this node alone. */
  onExclusiveSelect: () => void
  /** Shows or hides the node's children. */
  onToggleExpansion: () => void
}

/**
 * One row of the tree. The checkbox is inert and driven entirely by the row, so a click
 * anywhere along the row means the same thing.
 */
const TreeNodeRow = memo(function TreeNodeRow({
  node,
  level,
  isExpanded,
  hasChildren,
  showChevron,
  isChecked,
  isTabStop,
  parentState,
  onToggle,
  onExclusiveSelect,
  onToggleExpansion,
}: TreeNodeRowProps) {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  // A long-press stands in for the modifier click on a touchscreen
  const longPressHandlers = useSmartLongPress(onExclusiveSelect)

  return (
    <div
      className={cn(
        'flex items-center rounded-md px-3 py-2 transition-colors hover:bg-foreground/5 cursor-pointer',
        FOCUS_RING_ROW_CLASS,
        node.count === 0 && 'opacity-50',
        'select-none'
      )}
      onClick={onToggle}
      {...longPressHandlers}
    >
      {/* Indent standing in for the levels above this one */}
      <div className="shrink-0" style={{ width: `${level * INDENT_PER_LEVEL}px` }} />

      {/* Expander, holding its width even when absent so the rows stay aligned */}
      <div className="w-6 h-6 flex items-center justify-center shrink-0">
        {showChevron && (
          <button
            type="button"
            onClick={(event) => {
              // Expanding is not selecting, so keep this click off the row
              event.stopPropagation()

              // Only the branch opens or closes
              onToggleExpansion()
            }}
            className={cn(
              'w-5 h-5 hover:bg-foreground/10 rounded flex items-center justify-center',
              FOCUS_RING_INSET_CLASS
            )}
            // Out of the tab order, the same branch being opened and closed from the keyboard on the row
            tabIndex={-1}
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? tFilters('collapseNode', { name: node.displayName })
                : tFilters('expandNode', { name: node.displayName })
            }
          >
            <ChevronRight
              className={cn('h-4 w-4 transition-transform text-muted', isExpanded && 'rotate-90')}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {/* Checkbox */}
      <div className="flex items-center shrink-0 mr-2">
        <input
          type="checkbox"
          className="form-checkbox pointer-events-none"
          // Which row this is, so the walk down the tree knows what it has landed on and which branch
          // the arrows opening and closing one are aimed at
          data-facet-row-id={node.id}
          tabIndex={isTabStop ? 0 : -1}
          checked={isChecked}
          aria-label={facetOptionAccessibleName(node.displayName, node.count)}
          ref={(element) => {
            // The row is on its way out, so there is nothing left to mark
            if (!element) return

            // Only a parent can be part-selected, and only when it isn't covered outright
            if (hasChildren) {
              element.indeterminate = !isChecked && parentState === 'indeterminate'
            }
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

  /**
   * Applies a key pressed on a row, which for a hierarchy means opening and closing its branches.
   *
   * @param rowId - The node focus is on.
   * @param action - What the key asked of it.
   * @returns Whether the branch acted.
   */
  function onRowAction(rowId: string, action: FacetRowAction) {
    // The node in the unfiltered tree, which is what its branch is judged on
    const node = nodesById.get(rowId)

    // A leaf has no branch to open or close
    if (!node?.children?.length) return false

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
   * @param level - How deep it sits, which drives the indent.
   * @returns The node's row, followed by its children's rows when it stands open.
   */
  function renderNode(node: TreeNode, level: number) {
    // The same node in the unfiltered tree, which is what its selection stands for
    const originalNode = nodesById.get(node.id)

    // Whether this branch stands open
    const isExpanded = tree.expandedIds.has(node.id)

    // Whether it is a branch at all, judged on the real tree rather than the narrowed one
    const hasChildren = (originalNode?.children?.length ?? 0) > 0

    // While searching, only the surviving children are reachable, so an emptied subtree gets no expander
    const showChevron = facet.query ? (node.children?.length ?? 0) > 0 : hasChildren

    // How the checkbox reads, which for a branch folds in what its subtree is doing
    const parentState = originalNode ? calculateParentState(originalNode, selected) : 'unchecked'

    // Whether the selection covers the node, in its own right or through an ancestor
    const isChecked = isNodeEffectivelyChecked(node.id, selected, options)

    /**
     * Applies a click on the row, honouring the modifier that narrows to one node.
     *
     * @param event - The click, read for the modifier key it was made with.
     */
    function handleToggle(event: MouseEvent | TouchEvent) {
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
          isExpanded={isExpanded}
          hasChildren={hasChildren}
          showChevron={showChevron}
          isChecked={isChecked}
          isTabStop={node.id === tabStopRowId}
          parentState={parentState}
          onToggle={handleToggle}
          onExclusiveSelect={() => onChange([node.id])}
          onToggleExpansion={() => tree.toggleNode(node.id)}
        />

        {/* The open branch's own rows, one level further in */}
        {hasChildren && isExpanded && node.children && node.children.length > 0 && (
          <div>{node.children.map((child) => renderNode(child, level + 1))}</div>
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

        {/* The hierarchy itself */}
        <FacetList labelId={facet.labelId} listRef={list.listRef}>
          {/* Empty state, for a search term nothing matched */}
          {tree.visibleTree.length === 0 && facet.query && (
            <div className="px-3 py-3 text-sm text-muted">{tFilters('noResults')}</div>
          )}

          {/* The hierarchy, walked from its roots */}
          {tree.visibleTree.map((node) => renderNode(node, 0))}
        </FacetList>
      </FacetPopover>
    </div>
  )
}
