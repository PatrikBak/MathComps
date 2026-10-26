import { searchMatcher } from './facet-logic'
import type { TreeCheckState, TreeNode } from './facet-types'

/**
 * Collects the ids beneath a node.
 *
 * @param node - The node to walk.
 * @param includeNode - Whether the node's own id joins the result.
 * @returns The ids in depth-first order.
 */
function getAllDescendantIds(node: TreeNode, includeNode = false): string[] {
  // The node itself leads the list when asked for
  const selfIds = includeNode ? [node.id] : []

  // Each subtree contributes its own node and everything below it
  const descendantIds = (node.children ?? []).flatMap((child) => getAllDescendantIds(child, true))

  // Hand back the node ahead of its subtree, so the order reads top-down
  return [...selfIds, ...descendantIds]
}

/**
 * Collects the ids on the path from the root down to a node, excluding the node.
 *
 * @param nodeId - The node to locate.
 * @param allNodes - The roots of the tree to search.
 * @returns The ancestor ids from the outermost inwards, or an empty array when the node is absent.
 */
export function getAllAncestorIds(nodeId: string, allNodes: TreeNode[]): string[] {
  /**
   * Walks the tree carrying the path taken to reach the current level.
   *
   * @param nodes - The nodes at the level being walked.
   * @param path - The ids passed through to reach that level.
   * @returns The ancestors of the sought node, or null if this branch does not hold it.
   */
  function findPath(nodes: TreeNode[], path: string[]): string[] | null {
    // Every node of this level is a candidate, and a hit below one of them ends the walk
    for (const node of nodes) {
      // Reaching the node means the path so far is exactly its ancestry
      if (node.id === nodeId) return path

      // Otherwise keep descending, extending the path by the node just passed
      const deeper = node.children ? findPath(node.children, [...path, node.id]) : null

      // A hit anywhere below propagates straight back up
      if (deeper !== null) return deeper
    }

    // Nothing in this branch holds the node
    return null
  }

  // An id the tree has never heard of has no ancestry
  return findPath(allNodes, []) ?? []
}

/**
 * Decides how a node reads from its own selection and its subtree's, any selected ancestor set aside. A node
 * selected in its own right counts as checked whatever its descendants do, which is what lets one selected
 * parent stand in for its whole subtree.
 *
 * @param node - The node to judge.
 * @param selectedIds - The ids selected in their own right.
 * @returns The state its checkbox should show.
 */
export function calculateParentState(node: TreeNode, selectedIds: string[]): TreeCheckState {
  // A leaf has nothing below it, so only its own selection matters
  if (!node.children || node.children.length === 0) {
    return selectedIds.includes(node.id) ? 'checked' : 'unchecked'
  }

  // An explicitly selected node reads as checked regardless of its subtree
  if (selectedIds.includes(node.id)) {
    return 'checked'
  }

  // Failing that, the subtree decides, so everything under the node is what counts
  const allDescendants = getAllDescendantIds(node)

  // How much of that subtree the selection actually reaches
  const selectedDescendants = allDescendants.filter((id) => selectedIds.includes(id))

  // Every descendant selected reads the same as the node itself being selected
  if (selectedDescendants.length === allDescendants.length && allDescendants.length > 0) {
    return 'checked'
  }

  // Some but not all is the mixed state, which is what invites opening the branch
  if (selectedDescendants.length > 0) {
    return 'indeterminate'
  }

  // Nothing below is selected, so the node is untouched
  return 'unchecked'
}

/**
 * Whether a node counts as selected, either in its own right or by inheriting a
 * selected ancestor.
 *
 * @param nodeId - The node to judge.
 * @param selectedIds - The ids selected in their own right.
 * @param allNodes - The roots of the tree the node belongs to.
 * @returns True when the node is covered by the selection.
 */
export function isNodeEffectivelyChecked(
  nodeId: string,
  selectedIds: string[],
  allNodes: TreeNode[]
): boolean {
  // Selected in its own right, which needs no further checking
  if (selectedIds.includes(nodeId)) {
    return true
  }

  // Failing that, it is covered only if something above it is selected
  const ancestors = getAllAncestorIds(nodeId, allNodes)

  // One selected ancestor anywhere up the path is enough
  return ancestors.some((ancestorId) => selectedIds.includes(ancestorId))
}

/**
 * Decides how a node's checkbox reads in a tree. A node the selection covers, in its own right or through an
 * ancestor, reads checked whatever its subtree is doing; any other node reads as its subtree does.
 *
 * @param node - The node to judge, with its whole subtree.
 * @param selectedIds - The ids selected in their own right.
 * @param allNodes - The roots of the tree the node belongs to.
 * @returns The state its checkbox should show.
 */
export function treeCheckState(
  node: TreeNode,
  selectedIds: string[],
  allNodes: TreeNode[]
): TreeCheckState {
  // Covered by the selection, which outranks whatever lies beneath
  if (isNodeEffectivelyChecked(node.id, selectedIds, allNodes)) return 'checked'

  // Otherwise the subtree decides
  return calculateParentState(node, selectedIds)
}

/**
 * Applies a click on a node to the selection. Deselecting a node that is only covered
 * by a selected ancestor has to break that ancestor apart, replacing it with each of
 * its leaves outside the node being turned off.
 *
 * @param node - The node that was clicked.
 * @param currentSelected - The ids selected in their own right, none of them under another.
 * @param allNodes - The roots of the tree the node belongs to.
 * @returns The resulting selection, as a new array.
 */
export function toggleNodeSelection(
  node: TreeNode,
  currentSelected: string[],
  allNodes: TreeNode[]
): string[] {
  // Selected in its own right, so it can simply be dropped
  if (currentSelected.includes(node.id)) {
    return currentSelected.filter((id) => id !== node.id)
  }

  // Failing that, the whole path above it is where a stand-in could be sitting
  const ancestors = getAllAncestorIds(node.id, allNodes)

  // The one actually selected, which is what stands in for this node, a selection naming no node under another
  const selectedAncestor = ancestors.find((ancestorId) => currentSelected.includes(ancestorId))

  // Covered by an ancestor, which now has to be expressed as its individual leaves
  if (selectedAncestor) {
    // The ancestor goes, since it can no longer stand for a subtree with a hole in it
    const withoutAncestor = currentSelected.filter((id) => id !== selectedAncestor)

    // The ancestor's real node, which is what says who it was standing for
    const ancestorNode = findNodeById(allNodes, selectedAncestor)

    // Always there and a branch, having been reached through its children, though the type cannot tell
    if (!ancestorNode?.children) {
      return withoutAncestor
    }

    // Only leaves, since an intermediate node above the one being turned off would re-cover it
    const leafDescendants = getAllDescendantIds(ancestorNode).filter((id) => {
      // The id's real node, which is what says whether anything hangs off it
      const descendant = findNodeById(allNodes, id)

      // Only a node the tree holds and that has nothing under it counts
      return descendant && (!descendant.children || descendant.children.length === 0)
    })

    // The node being turned off, with everything under it
    const turnedOffIds = getAllDescendantIds(node, true)

    // The ancestor gives way to every leaf under it outside the node being turned off
    return [...withoutAncestor, ...leafDescendants.filter((id) => !turnedOffIds.includes(id))]
  }

  // Descendants the node will supersede, so one branch is never recorded twice over
  const allDescendants = getAllDescendantIds(node)

  // Everything the node does not already stand for, which is what survives alongside it
  const unrelated = currentSelected.filter((id) => !allDescendants.includes(id))

  // The node joins the selection, standing for everything under it
  return [...unrelated, node.id]
}

/**
 * The result of narrowing a tree to a search term.
 */
export type FilteredTree = {
  /** The surviving nodes, keeping the shape of the original tree. */
  tree: TreeNode[]
  /** Ids of the nodes that have to be open for the matches to be reachable. */
  expandedIds: Set<string>
}

/**
 * Narrows a tree to the nodes carrying a term, as {@link searchMatcher} reads it, keeping each match's ancestors
 * so the result stays navigable.
 *
 * @param nodes - The roots of the tree to narrow.
 * @param searchTerm - What the user typed; an empty term returns the tree untouched.
 * @returns The narrowed tree and the ids that have to be expanded to reveal the matches.
 */
export function filterTreeBySearch(nodes: TreeNode[], searchTerm: string): FilteredTree {
  // What a node's own names have to carry for it to match
  const matches = searchMatcher(searchTerm)

  // An empty term narrows nothing, and the same array back means no node is recreated
  if (!matches) {
    return { tree: nodes, expandedIds: new Set() }
  }

  // Filled in as the walk finds nodes that have to be open
  const expandedIds = new Set<string>()

  /**
   * Keeps the nodes that match, plus any ancestor leading to a match.
   *
   * @param candidates - The nodes at the level being narrowed.
   * @returns Those worth keeping, each carrying whichever children survived.
   */
  const keepMatching = (candidates: TreeNode[]): TreeNode[] =>
    // Each node either survives, survives trimmed, or disappears
    candidates.flatMap((node) => {
      // Whether the node's own names carry the term
      const labelMatches = matches(node)

      // Whatever survives below, which decides whether the node is worth keeping as a path
      const matchingChildren = node.children ? keepMatching(node.children) : []

      // The node matches, so it survives carrying whichever children matched as well
      if (labelMatches) {
        // No survivors below leaves the children absent, so the node reads as a leaf
        const children = matchingChildren.length > 0 ? matchingChildren : undefined

        // Only a node that kept children needs opening
        if (children) expandedIds.add(node.id)

        // The node stands, carrying whatever survived beneath it
        return [{ ...node, children }]
      }

      // The node itself misses but leads to a match, so it survives purely as a path to it
      if (matchingChildren.length > 0) {
        // The matches below are only reachable with this node open
        expandedIds.add(node.id)

        // The node stands purely to carry the matches below it
        return [{ ...node, children: matchingChildren }]
      }

      // Neither the node nor anything below it matched, so the whole branch goes
      return []
    })

  // The narrowed tree, plus the ids the walk marked for opening
  return { tree: keepMatching(nodes), expandedIds }
}

/**
 * Indexes a whole tree by node id.
 *
 * A node's real children decide what selecting it stands for, so the lookup has to reach
 * the whole tree even when only part of it is on screen.
 *
 * @param nodes - The roots to walk.
 * @returns Every node in the tree, keyed by its id.
 */
export function indexTreeById(nodes: TreeNode[]): Map<string, TreeNode> {
  // Filled in as the walk reaches each node
  const index = new Map<string, TreeNode>()

  /**
   * Records a level, then descends into whatever hangs off it.
   *
   * @param candidates - The nodes at the level being recorded.
   */
  function visit(candidates: TreeNode[]) {
    // Every node of this level goes into the index
    candidates.forEach((node) => {
      // The node under its own id
      index.set(node.id, node)

      // Only branches are worth descending into
      if (node.children) visit(node.children)
    })
  }

  // Walk from the roots, which reaches every node exactly once
  visit(nodes)

  // Every node in the tree, whatever its depth
  return index
}

/**
 * One row a hierarchy draws, and where it sits in the hierarchy as drawn.
 */
export type DrawnTreeRow = {
  /** The node this row stands for, as a search left it. */
  node: TreeNode
  /** How deep it sits, the roots being at zero. */
  level: number
  /** Where it stands among the siblings drawn beside it, counting from one. */
  positionInSet: number
  /** How many siblings are drawn at its level. */
  setSize: number
  /**
   * Whether its children are showing, or undefined where it has none on show to open, which a search can leave a
   * branch without.
   */
  expanded: boolean | undefined
}

/**
 * Walks the rows a hierarchy currently draws, a closed branch standing for itself alone.
 *
 * @param nodes - The roots, already narrowed by whatever a search left.
 * @param expandedIds - Which branches stand open.
 * @returns The drawn rows, in the order they appear.
 */
export function drawnTreeRows(nodes: TreeNode[], expandedIds: Set<string>): DrawnTreeRow[] {
  /**
   * Walks the rows one level of siblings draws, and the open branches among them.
   *
   * @param siblings - The nodes side by side at this level.
   * @param level - How deep they sit.
   * @returns Their rows, each followed by whatever its open branch draws.
   */
  function walk(siblings: TreeNode[], level: number): DrawnTreeRow[] {
    // Each sibling in turn, in the order the hierarchy declares them
    return siblings.flatMap((node, index) => {
      // Whether its children are showing, for a node with any on show to open
      const expanded = node.children?.length ? expandedIds.has(node.id) : undefined

      // The node's own row
      const row = { node, level, positionInSet: index + 1, setSize: siblings.length, expanded }

      // An open branch draws its children under it, one level further in
      return expanded ? [row, ...walk(node.children ?? [], level + 1)] : [row]
    })
  }

  // Walked from the roots
  return walk(nodes, 0)
}

/**
 * Lists the rows standing for a tree's selection: every node selected in its own right, and for one the tree does
 * not draw, the deepest branch above it that it does, since that branch is the nearest the tree comes to it. A pick
 * goes undrawn under a closed branch, and under a search drawing its branch without it.
 *
 * @param selectedIds - The ids selected in their own right.
 * @param rows - The rows the tree draws.
 * @param allNodes - The roots of the tree the selection belongs to.
 * @returns The row ids standing for the selection, in no particular order.
 */
export function treeRowsStandingForSelection(
  selectedIds: string[],
  rows: DrawnTreeRow[],
  allNodes: TreeNode[]
): string[] {
  // The nodes the tree draws a row for
  const drawnIds = new Set(rows.map((row) => row.node.id))

  // Each selected node, followed, where it goes undrawn, by the deepest of its ancestors that is drawn
  return selectedIds.flatMap((nodeId) => {
    // A pick on show stands for itself
    if (drawnIds.has(nodeId)) return [nodeId]

    // The nearest the tree comes to it, absent where a search drew nothing of its branch
    const drawnAncestorId = getAllAncestorIds(nodeId, allNodes).findLast((ancestorId) =>
      drawnIds.has(ancestorId)
    )

    // The pick, and the branch standing in for it
    return drawnAncestorId ? [nodeId, drawnAncestorId] : [nodeId]
  })
}

/**
 * Locates a node anywhere in a tree.
 *
 * @param nodes - The roots to search.
 * @param id - The node to find.
 * @returns The node, or null when the tree does not hold it.
 */
function findNodeById(nodes: TreeNode[], id: string): TreeNode | null {
  // Each node of this level is checked before its subtree is descended into
  for (const node of nodes) {
    // The node itself is the one being looked for
    if (node.id === id) return node

    // Otherwise keep descending, one subtree at a time
    const found = node.children ? findNodeById(node.children, id) : null

    // A hit below propagates straight back up
    if (found) return found
  }

  // Nothing in this branch holds the id
  return null
}
