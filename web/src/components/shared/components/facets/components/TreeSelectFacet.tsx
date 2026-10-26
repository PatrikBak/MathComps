import { useMemo } from 'react'

import { resetFacet, useFacetPopover } from '../hooks/use-facet-popover'
import { useFacetRowNavigation } from '../hooks/use-facet-row-navigation'
import { useRevealSelectedOption } from '../hooks/use-reveal-selected-option'
import { useTreeExpansion } from '../hooks/use-tree-expansion'
import { useTreeSelection } from '../hooks/use-tree-selection'
import { facetTabStopRowId } from '../model/facet-logic'
import type { FacetSearchConfig, TreeNode } from '../model/facet-types'
import { indexTreeById, treeRowsStandingForSelection } from '../model/tree-logic'
import { FacetHeader } from './FacetHeader'
import { FacetList, FacetNoResults } from './FacetList'
import { FacetPopover, FacetPopoverHeader } from './FacetPopover'
import { FacetSearchRow, SEARCH_THRESHOLD } from './FacetSearchRow'
import { FacetTrigger } from './FacetTrigger'
import { TreeNodeRow } from './TreeNodeRow'

/**
 * The props of {@link TreeSelectFacet}.
 */
type TreeSelectFacetProps = {
  /** Name of what the facet filters by. */
  title: string
  /** The whole hierarchy it can offer. */
  options: TreeNode[]
  /** Ids of the nodes selected in their own right, none of them under another. */
  selected: string[]
  /** Applies a new selection. */
  onChange: (next: string[]) => void
  /** The search over the hierarchy. */
  search: FacetSearchConfig
  /** What the trigger reads when nothing is selected. */
  closedLabel: string
  /** Nodes to start open, ignored for any that have no children. */
  defaultExpandedIds: string[]
}

/**
 * A facet over a hierarchy, where selecting a node stands for everything beneath it. What picking a node does to
 * the selection is {@link useTreeSelection}'s, and which branches stand open is {@link useTreeExpansion}'s.
 */
export function TreeSelectFacet({
  title,
  options,
  selected,
  onChange,
  search,
  closedLabel,
  defaultExpandedIds,
}: TreeSelectFacetProps) {
  // The popover and the search term the tree is narrowed by
  const facet = useFacetPopover({ options, width: 'trigger' })

  // Which branches stand open, and the rows the tree draws with what the search term has left of it
  const tree = useTreeExpansion({
    nodes: options,
    searchTerm: facet.searchTerm,
    defaultExpandedIds,
  })

  // Keyboard focus moving down the rows, Left and Right closing and opening the branches
  const list = useFacetRowNavigation({ isOpen: facet.open, onRowAction: tree.onRowAction })

  // How each node's checkbox reads, and what picking one does to the selection
  const selection = useTreeSelection({
    nodes: options,
    selected,
    onChange,
    onPicked: tree.keepInView,
  })

  // The rows standing for the selection
  const standingRowIds = treeRowsStandingForSelection(selected, tree.rows, options)

  // The one row the panel offers the page's tab order
  const tabStopRowId = facetTabStopRowId(
    tree.rows.map((row) => row.node.id),
    standingRowIds,
    list.lastFocusedRowId
  )

  // How many nodes the hierarchy holds, at every depth
  const nodeCount = useMemo(() => indexTreeById(options).size, [options])

  // The first checked row scrolled to as the tree appears, since the tree keeps every node where it stands
  useRevealSelectedOption({ listRef: list.listRef, isActive: facet.open, optionCount: nodeCount })

  // A function which resets the facet
  const clearAll = () => resetFacet({ selected, onChange, popover: facet, list })

  return (
    <div className="w-full">
      {/* The heading naming the facet */}
      <FacetHeader
        title={title}
        labelId={facet.labelId}
        anySelected={selected.length > 0}
        onClear={clearAll}
        suppressClear={facet.isOpenAbove}
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
        {/* The header, standing in for the heading above the trigger once the panel opens over it */}
        {facet.isOpenAbove && (
          <FacetPopoverHeader
            title={title}
            titleId={undefined}
            onClear={clearAll}
            count={selected.length}
          />
        )}

        {/* Search row, offered once the hierarchy as a whole is big enough */}
        {nodeCount >= SEARCH_THRESHOLD && (
          <FacetSearchRow
            query={facet.query}
            setQuery={facet.setQuery}
            searchRef={facet.searchRef}
            title={title}
            placeholder={search.placeholder}
            onArrowDownToList={list.focusFirstRow}
          />
        )}

        {/* The hierarchy itself, or word that a search term matched nothing in it */}
        {tree.rows.length === 0 && facet.searchTerm ? (
          <FacetNoResults />
        ) : (
          <FacetList
            role="tree"
            labelId={facet.labelId}
            listRef={list.listRef}
            onFocus={list.onListFocus}
            onBlur={list.onListBlur}
          >
            {/* One row per node the tree draws */}
            {tree.rows.map((row) => (
              <TreeNodeRow
                key={row.node.id}
                {...row}
                isTabStop={row.node.id === tabStopRowId}
                checkState={selection.checkStateOf(row.node.id)}
                onToggle={selection.toggle}
                onExclusiveSelect={selection.selectOnly}
                onToggleExpansion={tree.toggleNode}
              />
            ))}
          </FacetList>
        )}
      </FacetPopover>
    </div>
  )
}
