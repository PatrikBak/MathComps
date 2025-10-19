import { ChevronRight } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import type { FacetOption } from './facet-shared'
import {
  FacetHeader,
  FacetListContainer,
  FacetPopover,
  FacetSearchRow,
  FacetTrigger,
  facetUI,
  SEARCH_THRESHOLD,
  useFacetBase,
} from './facet-shared'
import {
  calculateParentState,
  isNodeEffectivelyChecked,
  toggleExpansion,
  toggleNodeSelection,
  type TreeNode,
} from './utils/tree-logic'

/**
 * Represents a node in a hierarchical facet structure. It extends the base `TreeNode`
 * from tree-logic utilities and includes FacetOption properties.
 */
export type TreeSelectFacetOption = TreeNode & FacetOption

type TreeSelectFacetProps = {
  /** The title of the facet, displayed above the trigger. */
  title: string
  /** The hierarchical list of options to display in the facet. */
  options: TreeSelectFacetOption[]
  /** An array of the currently selected option IDs. */
  selected: string[]
  /** Callback function invoked when the selected values change. */
  onChange: (next: string[]) => void
  /** Placeholder text for the search input. */
  searchPlaceholder?: string
  /** Additional CSS class name to apply to the root element. */
  className?: string
  /**
   * An array of node IDs that should be expanded by default on the first render.
   * Nodes without children are ignored.
   */
  defaultExpandedIds?: string[]
  /** Whether to show the search input in the popover. @default true */
  showSearch?: boolean
  /** When true, the facet is rendered but cannot be opened/changed. */
  disabled?: boolean
  /** Text to show on the closed trigger button. */
  closedLabel: string
  /** Show search when option count ≥ this threshold. @default SEARCH_THRESHOLD */
  searchThreshold?: number
  /** When false, hides per-option counts from the list UI. @default true */
  showCounts?: boolean
  /** Optional tooltip to show next to the title. */
  titleTooltip?: string
}

/**
 * A facet component that renders a hierarchical, multi-select tree.
 * Parent nodes act as "select all" toggles for their descendants.
 * The component supports searching, which filters the tree to show only matching
 * nodes and their ancestors.
 *
 * @param {TreeSelectFacetProps} props - The props for the component.
 */
export default function TreeSelectFacet({
  title,
  options,
  selected,
  onChange,
  searchPlaceholder = 'Hľadať…',
  className,
  defaultExpandedIds = [],
  showSearch = true,
  disabled = false,
  closedLabel,
  searchThreshold = SEARCH_THRESHOLD,
  showCounts = true,
  titleTooltip,
}: TreeSelectFacetProps) {
  const facet = useFacetBase<TreeSelectFacetOption>({ options, inputKind: 'checkbox', selected })
  const isDirty = selected.length > 0

  /**
   * State for managing the set of expanded node IDs.
   */
  const [expandedIds, setExpandedIds] = React.useState(() => new Set<string>(defaultExpandedIds))

  /**
   * A memoized index of the original, unfiltered tree.
   * This is used for selection logic that needs to consider the entire hierarchy,
   * even when the view is filtered by a search query.
   */
  const originalNodeIndex = React.useMemo(() => {
    const map = new Map<string, TreeSelectFacetOption>()
    const visit = (nodes: TreeSelectFacetOption[]) => {
      for (const n of nodes) {
        map.set(n.id, n)
        if (n.children && n.children.length) visit(n.children)
      }
    }
    visit(options)
    return map
  }, [options])

  /**
   * Filters the tree based on the current search query.
   * The filtered tree includes nodes that match the query and their ancestors.
   * It also returns a set of node IDs that should be expanded to reveal the search results.
   */
  const { filteredTree, searchExpandedIds } = React.useMemo(() => {
    const query = facet.query.trim().toLowerCase()
    if (!query) return { filteredTree: options, searchExpandedIds: new Set<string>() }

    const expanded = new Set<string>()

    function filterNodes(nodes: TreeSelectFacetOption[]): TreeSelectFacetOption[] {
      const result: TreeSelectFacetOption[] = []
      for (const node of nodes) {
        const labelMatches =
          node.displayName.toLowerCase().includes(query) ||
          (node.fullName && node.fullName.toLowerCase().includes(query))
        const childMatches = node.children ? filterNodes(node.children) : []
        if (labelMatches) {
          // Node's label matches the query. Include it and any of its children that also match.
          const nextNode: TreeSelectFacetOption = {
            ...node,
            children: childMatches.length > 0 ? childMatches : undefined,
          }
          if ((nextNode.children?.length ?? 0) > 0) {
            expanded.add(node.id)
          }
          result.push(nextNode)
          continue
        }
        if (childMatches.length > 0) {
          // Node's label doesn't match, but it has descendants that do.
          // Include the node, but only with its matching descendants.
          const nextNode: TreeSelectFacetOption = { ...node, children: childMatches }
          expanded.add(node.id)
          result.push(nextNode)
          continue
        }
        // Neither this node nor its descendants match; skip it.
      }
      return result
    }

    return { filteredTree: filterNodes(options), searchExpandedIds: expanded }
  }, [options, facet.query])

  /**
   * The set of effectively expanded node IDs.
   * When a search query is active, this merges the user's explicitly expanded nodes
   * with the nodes that need to be expanded to show the search results.
   */
  const effectiveExpandedIds = React.useMemo(() => {
    if (!facet.query) return expandedIds
    const merged = new Set<string>(expandedIds)
    for (const id of searchExpandedIds) merged.add(id)
    return merged
  }, [expandedIds, facet.query, searchExpandedIds])

  /**
   * Toggles the expanded state of a single node using utility function.
   *
   * @param id - The ID of the node to toggle.
   */
  function toggleNodeExpansion(id: string) {
    setExpandedIds((current) => {
      const currentArray = Array.from(current)
      const nextArray = toggleExpansion(id, currentArray)
      return new Set(nextArray)
    })
  }

  /**
   * Clears all selections.
   */
  function clearAll() {
    if (selected.length) onChange([])
  }

  /**
   * Recursively renders a node and its children.
   *
   * @param node - The node to render.
   * @param level - The current depth of the node in the tree, for indentation.
   * @returns A React fragment containing the rendered node and its children.
   */
  const renderNode = (node: TreeSelectFacetOption, level: number) => {
    const isExpanded = effectiveExpandedIds.has(node.id)
    const hasChildren = (originalNodeIndex.get(node.id)?.children?.length ?? 0) > 0
    const showChevron = facet.query ? (node.children?.length ?? 0) > 0 : hasChildren

    // Determine the state of the parent checkbox using utility function
    const originalNode = originalNodeIndex.get(node.id)
    const parentState = originalNode ? calculateParentState(originalNode, selected) : 'unchecked'

    const isChecked = isNodeEffectivelyChecked(node.id, selected, options)

    /**
     * Handles toggling the selection of a node using utility function.
     * Uses the shared tree logic that properly handles parent-child selection relationships.
     */
    function handleParentToggle() {
      if (!originalNode) return

      // Use the utility function with the full tree context
      const nextSelected = toggleNodeSelection(originalNode, selected, options)

      // Expand to show context if this is a parent being selected
      if (
        hasChildren &&
        !selected.includes(originalNode.id) &&
        nextSelected.includes(originalNode.id)
      ) {
        if (!isExpanded) {
          setExpandedIds((current) => new Set([...current, node.id]))
        }
      }

      onChange(nextSelected)
    }

    return (
      <React.Fragment key={node.id}>
        <div
          className={cn(
            'flex items-center rounded-md px-3 py-2 transition-colors hover:bg-slate-700/50 cursor-pointer',
            node.count === 0 && 'opacity-50'
          )}
          onClick={handleParentToggle}
        >
          {/* Indentation spacer */}
          <div className="shrink-0" style={{ width: `${level * 16}px` }} />

          {/* Expander Chevron: fixed width to prevent layout shift */}
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            {showChevron && (
              <button
                onClick={(e) => {
                  e.stopPropagation() // Prevent triggering the row's selection handler
                  toggleNodeExpansion(node.id)
                }}
                className="w-5 h-5 hover:bg-slate-100/10 rounded flex items-center justify-center"
              >
                <ChevronRight
                  className={cn(
                    'h-4 w-4 transition-transform text-slate-400',
                    isExpanded && 'rotate-90'
                  )}
                />
              </button>
            )}
          </div>

          {/* Checkbox - fixed position */}
          <div className="flex items-center shrink-0 mr-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-indigo-400 pointer-events-none"
              checked={isChecked}
              ref={(element) => {
                if (!element) return
                // Indeterminate only when not explicitly selected and some descendants are
                if (hasChildren) {
                  element.indeterminate = !isChecked && parentState === 'indeterminate'
                }
              }}
              readOnly
            />
          </div>

          {/* Label - grows to fill space */}
          <div className="flex flex-grow min-w-0 items-center">
            <span
              className={facetUI.itemLabel}
              title={
                node.fullName && node.fullName !== node.displayName ? node.fullName : undefined
              }
            >
              {node.displayName}
            </span>
          </div>

          {/* Count - pushed to the right */}
          {showCounts && (
            <span className={cn(facetUI.itemCount, 'shrink-0 ml-auto')}>{node.count}</span>
          )}
        </div>
        {/* Render Children if Expanded */}
        {hasChildren && isExpanded && node.children && node.children.length > 0 && (
          <div>{node.children.map((child) => renderNode(child, level + 1))}</div>
        )}
      </React.Fragment>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      <FacetHeader
        title={title}
        labelId={facet.labelId}
        selectedCount={selected.length}
        anySelected={isDirty}
        onClear={clearAll}
        titleTooltip={titleTooltip}
      />

      <FacetTrigger
        open={facet.open}
        refs={facet.refs}
        getReferenceProps={facet.getReferenceProps}
        closedLabel={closedLabel}
        title={title}
        disabled={disabled}
        count={selected.length}
      />

      <FacetPopover
        open={facet.open}
        context={facet.context}
        refs={facet.refs}
        floatingStyles={facet.floatingStyles}
        getFloatingProps={facet.getFloatingProps}
        popoverId={facet.popoverId}
        labelId={facet.labelId}
      >
        {showSearch && options.length >= searchThreshold && (
          <FacetSearchRow
            query={facet.query}
            setQuery={facet.setQuery}
            searchRef={facet.searchRef}
            title={title}
            placeholder={searchPlaceholder}
            onArrowDownToList={facet.focusFirstItem}
          />
        )}
        <FacetListContainer
          role="group"
          labelId={facet.labelId}
          listRef={facet.listRef}
          onKeyDown={facet.onListKeyDown}
        >
          {filteredTree.length === 0 && facet.query && (
            <div className="px-3 py-3 text-sm text-slate-400">Žiadne výsledky</div>
          )}
          {filteredTree.map((option) => renderNode(option, 0))}
        </FacetListContainer>
      </FacetPopover>
    </div>
  )
}
