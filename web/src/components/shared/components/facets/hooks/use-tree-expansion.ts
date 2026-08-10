import { useDeferredValue, useMemo, useState } from 'react'

import type { TreeNode } from '../model/facet-types'
import { filterTreeBySearch, toggleExpansion } from '../model/tree-logic'

/**
 * Which parts of a tree facet are open, and what the search term has left of it.
 */
export type UseTreeExpansionResult = {
  /** The tree narrowed to the current search term. */
  visibleTree: TreeNode[]
  /** Every node that should render open, whether the user opened it or a match forced it. */
  expandedIds: Set<string>
  /** Opens a node, or closes it. */
  toggleNode: (nodeId: string) => void
  /** Opens a node, leaving an already-open one alone. */
  expandNode: (nodeId: string) => void
  /** Closes a node the reader opened, leaving one a search forced open alone. */
  collapseNode: (nodeId: string) => void
}

/**
 * Owns which nodes of a tree facet stand open, and narrows the tree to the search term.
 *
 * A search forces open whatever sits above a match, but does so on top of the user's own
 * expansions rather than replacing them, so clearing the box leaves the tree as they had it.
 *
 * @param nodes - The whole tree, before searching.
 * @param query - The current search term.
 * @param defaultExpandedIds - Nodes to start open on the first render.
 * @returns The state and handlers described by {@link UseTreeExpansionResult}.
 */
export function useTreeExpansion(
  nodes: TreeNode[],
  query: string,
  defaultExpandedIds: string[]
): UseTreeExpansionResult {
  // The nodes the user has opened by hand, seeded with whatever should start open
  const [userExpandedIds, setUserExpandedIds] = useState(() => new Set(defaultExpandedIds))

  // Walking a deep tree is the expensive part of a keystroke, so let it lag the typing
  const deferredQuery = useDeferredValue(query)

  // The surviving nodes, plus whatever has to be open for them to be reachable
  const { tree, expandedIds: searchExpandedIds } = useMemo(
    () => filterTreeBySearch(nodes, deferredQuery),
    [nodes, deferredQuery]
  )

  // What actually renders open: the user's own expansions, widened while a search is running
  const expandedIds = useMemo(() => {
    // With no search there is nothing to force open
    if (!deferredQuery) return userExpandedIds

    // The user's own expansions plus whatever the search forced open
    return new Set([...userExpandedIds, ...searchExpandedIds])
  }, [userExpandedIds, deferredQuery, searchExpandedIds])

  /**
   * Flips one node between open and closed.
   *
   * @param nodeId - The node to flip.
   */
  function toggleNode(nodeId: string) {
    // Add the node when it is closed, drop it when it is open
    setUserExpandedIds((current) => new Set(toggleExpansion(nodeId, [...current])))
  }

  /**
   * Opens one node, leaving an already-open one alone.
   *
   * @param nodeId - The node to open.
   */
  function expandNode(nodeId: string) {
    // Adding an already-open node changes nothing
    setUserExpandedIds((current) => new Set([...current, nodeId]))
  }

  /**
   * Closes one node, as far as the reader's own expansions go.
   *
   * A node standing open only because the search reached under it is left alone: it is open on the
   * search's account rather than the reader's, and recording a close against it would put it in the
   * set that survives the search being cleared, leaving the tree sprawled open instead of closed.
   *
   * @param nodeId - The node to close.
   */
  function collapseNode(nodeId: string) {
    // Dropping a node the reader never opened changes nothing
    setUserExpandedIds((current) => new Set([...current].filter((id) => id !== nodeId)))
  }

  // What to render, and the three ways the caller can move a node
  return { visibleTree: tree, expandedIds, toggleNode, expandNode, collapseNode }
}
