import { useMemo, useState } from 'react'

import { useKeyedState } from '@/hooks/use-keyed-state'

import { applyCollapsibleRowAction } from '../model/facet-logic'
import type { FacetRowAction, FacetRowActionHandler, TreeNode } from '../model/facet-types'
import {
  type DrawnTreeRow,
  drawnTreeRows,
  filterTreeBySearch,
  getAllAncestorIds,
} from '../model/tree-logic'

/** No node at all. */
const NO_NODES: ReadonlySet<string> = new Set()

/**
 * What a tree facet's open branches are worked out from.
 */
export type UseTreeExpansionOptions = {
  /** The whole tree, before searching. */
  nodes: TreeNode[]
  /** The term the tree is narrowed by. */
  searchTerm: string
  /** Nodes to start open on the first render. */
  defaultExpandedIds: string[]
}

/**
 * Which parts of a tree facet are open, and the rows the tree draws with what the search term has left of it.
 */
export type UseTreeExpansionResult = {
  /** The rows the tree narrowed to the current search term draws, top to bottom. */
  rows: DrawnTreeRow[]
  /** Opens a node, or closes it. */
  toggleNode: (nodeId: string) => void
  /** Opens every branch above a node in the reader's own tree, so it stays in view once a search is cleared. */
  keepInView: (nodeId: string) => void
  /**
   * Applies a key's action to a node's row: Left closes its branch, or climbs to the branch above where nothing
   * beneath it is open, and Right opens it, or steps into it where it stands open.
   */
  onRowAction: FacetRowActionHandler
}

/**
 * Owns which nodes of a tree facet stand open, narrows the tree to the search term, and lays out the rows the two
 * leave drawn.
 *
 * A search forces open whatever sits above a match, but does so on top of the user's own
 * expansions rather than replacing them, so clearing the box leaves the tree as they had it, opened down to
 * anything picked under the search.
 * Opening and closing a branch under a search acts on the tree on screen and lasts as long as
 * the term does, the next term opening everything above its own matches afresh.
 *
 * @param options - What the open branches are worked out from.
 * @returns The state and handlers described by {@link UseTreeExpansionResult}.
 */
export function useTreeExpansion({
  nodes,
  searchTerm,
  defaultExpandedIds,
}: UseTreeExpansionOptions): UseTreeExpansionResult {
  // The reader's own open branches, seeded with whatever should start open
  const [userExpandedIds, setUserExpandedIds] = useState(() => new Set(defaultExpandedIds))

  // The branches the reader has closed under the search on screen, forgotten once the term changes
  const [searchCollapsedIds, setSearchCollapsedIds] = useKeyedState(searchTerm, NO_NODES)

  // The surviving nodes, plus whatever has to be open for them to be reachable
  const { tree, expandedIds: searchExpandedIds } = useMemo(
    () => filterTreeBySearch(nodes, searchTerm),
    [nodes, searchTerm]
  )

  // The branches that render open
  const expandedIds = useMemo(() => {
    // With no search there is nothing to force open
    if (!searchTerm) return userExpandedIds

    // The user's own expansions plus whatever the search forced open, less what the reader closed under it
    return new Set(
      [...userExpandedIds, ...searchExpandedIds].filter((id) => !searchCollapsedIds.has(id))
    )
  }, [userExpandedIds, searchTerm, searchExpandedIds, searchCollapsedIds])

  // The rows the tree draws, an open branch drawing its children under it
  const rows = useMemo(() => drawnTreeRows(tree, expandedIds), [tree, expandedIds])

  /**
   * Opens one node, leaving an already-open one alone.
   *
   * @param nodeId - The node to open.
   */
  function expandNode(nodeId: string) {
    // Under a search the node opens on screen alone, the reader's own tree waiting for the box to clear
    if (searchTerm) {
      // No longer one of the closes made under the term
      setSearchCollapsedIds((current) => new Set([...current].filter((id) => id !== nodeId)))

      // The reader's own tree stays as they had it
      return
    }

    // Adding an already-open node changes nothing
    setUserExpandedIds((current) => new Set([...current, nodeId]))
  }

  /**
   * Closes one node, leaving an already-closed one alone.
   *
   * @param nodeId - The node to close.
   */
  function collapseNode(nodeId: string) {
    // Under a search the node closes on screen alone, the reader's own tree waiting for the box to clear
    if (searchTerm) {
      // One of the closes made under the term
      setSearchCollapsedIds((current) => new Set([...current, nodeId]))

      // The reader's own tree stays as they had it
      return
    }

    // Dropping a node that isn't open changes nothing
    setUserExpandedIds((current) => new Set([...current].filter((id) => id !== nodeId)))
  }

  /**
   * Flips one node between open and closed, as the tree on screen has it.
   *
   * @param nodeId - The node to flip.
   */
  function toggleNode(nodeId: string) {
    // An open node closes, and any other opens
    if (expandedIds.has(nodeId)) collapseNode(nodeId)
    else expandNode(nodeId)
  }

  /**
   * Keeps a node in view once a search is cleared, opening the branches above it in the reader's own tree, since a
   * search may be all that holds them open now.
   *
   * @param nodeId - The node to keep in view.
   */
  function keepInView(nodeId: string) {
    // The path down to it open for good, whatever a search is doing
    setUserExpandedIds((current) => new Set([...current, ...getAllAncestorIds(nodeId, nodes)]))
  }

  /**
   * Applies a key pressed on a node's row, which for a hierarchy means opening and closing its branch, climbing to
   * the branch above from a row with nothing open beneath it, and stepping onto the first row beneath one open.
   *
   * @param rowId - The node focus is on.
   * @param action - What the key asked of it.
   * @param focusRow - Moves focus onto another row.
   * @returns Whether the row acted.
   */
  function onRowAction(rowId: string, action: FacetRowAction, focusRow: (rowId: string) => void) {
    // Where the row sits among those drawn
    const rowIndex = rows.findIndex((row) => row.node.id === rowId)

    // A row the tree no longer draws has nothing to answer with
    if (rowIndex === -1) return false

    // How deep the row sits, and whether its branch stands open
    const { level, expanded: isOpen } = rows[rowIndex]

    // Left on a row with nothing open beneath it climbs to the branch above, as it does in any tree
    if (action === 'collapse' && !isOpen) {
      // The branch above, the nearest row drawn before this one a level further out
      const parent = rows.slice(0, rowIndex).findLast((row) => row.level === level - 1)

      // A root has nowhere to climb, and the key goes back to the browser
      if (!parent) return false

      // Up onto the branch
      focusRow(parent.node.id)

      // The key is spoken for
      return true
    }

    // Right on an open branch steps onto its first row, the row drawn straight beneath it
    if (action === 'expand' && isOpen) {
      // Down onto it
      focusRow(rows[rowIndex + 1].node.id)

      // The key is spoken for
      return true
    }

    // A row with nothing on show beneath it has nothing else to open or close
    if (isOpen === undefined) return false

    // The branch opens and closes, a hierarchy having no orderings to cycle since its rows stand where it puts them
    return applyCollapsibleRowAction(action, {
      isOpen,
      toggleOpen: () => toggleNode(rowId),
      cycleSort: null,
    })
  }

  // What to render, and the ways the caller can move a node
  return { rows, toggleNode, keepInView, onRowAction }
}
