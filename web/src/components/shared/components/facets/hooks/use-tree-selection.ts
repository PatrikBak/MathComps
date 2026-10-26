import { type KeyboardEvent, type MouseEvent, type TouchEvent, useMemo } from 'react'

import { isExclusiveSelection } from '@/components/shared/utils/event-utils'

import type { TreeCheckState, TreeNode } from '../model/facet-types'
import { indexTreeById, toggleNodeSelection, treeCheckState } from '../model/tree-logic'

/**
 * What a tree facet's selection is read and changed against.
 */
export type UseTreeSelectionOptions = {
  /** The whole tree, before searching. */
  nodes: TreeNode[]
  /** Ids of the nodes selected in their own right. */
  selected: string[]
  /** Applies a new selection. */
  onChange: (next: string[]) => void
  /** Keeps a node the new selection names in its own right in view once a search is emptied. */
  onPicked: (nodeId: string) => void
}

/**
 * How each node of a tree facet reads, and what picking one does to the selection.
 */
export type UseTreeSelectionResult = {
  /** How a node's checkbox reads, as {@link treeCheckState} decides it. */
  checkStateOf: (nodeId: string) => TreeCheckState
  /** Applies a click on a node's row, or the keypress standing in for one, the modifier narrowing to the node. */
  toggle: (nodeId: string, event: MouseEvent | TouchEvent | KeyboardEvent) => void
  /** Narrows the selection to one node alone. */
  selectOnly: (nodeId: string) => void
}

/**
 * Reads and changes a tree facet's selection, where selecting a node stands for everything beneath it.
 *
 * A selection names no node under another, so picking a whole branch records one id rather than every leaf
 * under it.
 *
 * @param options - What the selection is read and changed against.
 * @returns The readings and handlers described by {@link UseTreeSelectionResult}.
 */
export function useTreeSelection({
  nodes,
  selected,
  onChange,
  onPicked,
}: UseTreeSelectionOptions): UseTreeSelectionResult {
  // The unfiltered tree by id, since a searched-down node still selects its real subtree
  const nodesById = useMemo(() => indexTreeById(nodes), [nodes])

  /**
   * Reads how a node's checkbox stands.
   *
   * @param nodeId - The node.
   * @returns The state its checkbox reads in.
   */
  function checkStateOf(nodeId: string): TreeCheckState {
    // The same node in the unfiltered tree, which is what its selection stands for
    const originalNode = nodesById.get(nodeId)

    // Read against its whole subtree, whatever a search has left of it on screen
    return originalNode ? treeCheckState(originalNode, selected, nodes) : 'unchecked'
  }

  /**
   * Hands a new selection up, keeping the node in view where the selection names it.
   *
   * @param nodeId - The node the selection was changed from.
   * @param nextSelected - The selection to apply.
   */
  function applySelection(nodeId: string, nextSelected: string[]) {
    // A node the new selection names, picked or narrowed to, is kept in view
    if (nextSelected.includes(nodeId)) onPicked(nodeId)

    // Hand the new selection up
    onChange(nextSelected)
  }

  /**
   * Narrows the selection to one node.
   *
   * @param nodeId - The node to keep.
   */
  function selectOnly(nodeId: string) {
    // Everything else drops out of the selection
    applySelection(nodeId, [nodeId])
  }

  /**
   * Applies a click on a node's row, honouring the modifier that narrows to one node.
   *
   * @param nodeId - The node whose row was clicked.
   * @param event - The click or keypress, read for the modifier it was made with.
   */
  function toggle(nodeId: string, event: MouseEvent | TouchEvent | KeyboardEvent) {
    // The same node in the unfiltered tree, which is what its selection stands for
    const originalNode = nodesById.get(nodeId)

    // A node missing from the index cannot be reasoned about
    if (!originalNode) return

    // The modifier narrows the whole facet to this one node
    if (isExclusiveSelection(event)) {
      // Everything else drops out of the selection
      selectOnly(nodeId)

      // The plain-click path below has nothing left to do
      return
    }

    // The node toggled within the selection standing
    applySelection(nodeId, toggleNodeSelection(originalNode, selected, nodes))
  }

  // The readings and the ways to change the selection
  return { checkStateOf, toggle, selectOnly }
}
