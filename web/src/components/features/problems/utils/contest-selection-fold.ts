// Folding the picked paths up to the shallowest nodes that cover exactly them, at any depth.

import type { ContestNode, ContestTree } from './contest-tree'

/**
 * Whether a node is wholly covered: picked in its own right, or a branch every one of whose children is
 * wholly covered. A leaf is only ever covered by being picked, since it has nothing below it to stand in.
 *
 * @param node - The node to judge.
 * @param picked - The paths picked in their own right.
 * @returns Whether the node's whole subtree is covered.
 */
function isWhollyCovered(node: ContestNode, picked: Set<string>): boolean {
  // Picked outright, so nothing below it needs looking at
  if (picked.has(node.path)) return true

  // A leaf that was not picked is not covered, and an empty list must not read as "all covered"
  if (node.children.length === 0) return false

  // A branch stands for its children, so it is covered exactly when all of them are
  return node.children.every((child) => isWhollyCovered(child, picked))
}

/**
 * Folds the nodes picked in the tree up to the shallowest ones that cover exactly them: every round of a
 * category gives way to the category, every category of a competition to the competition, and so on for
 * as deep as the taxonomy runs. A partially covered branch stays broken into whatever below it is
 * covered, so nothing is ever recorded twice and nothing that was not picked is swept in.
 *
 * @param pickedPaths - The paths picked in their own right, which may name nodes the tree no longer holds.
 * @param tree - The taxonomy, which says what a complete set of siblings is.
 * @returns The covering nodes, in the order the tree draws them.
 */
export function foldPickedPaths(pickedPaths: string[], tree: ContestTree): ContestNode[] {
  // The picked paths that still name a node, which is what the cover test asks after
  const picked = new Set(pickedPaths.filter((path) => tree.byPath.has(path)))

  // Nothing picked folds to nothing
  if (picked.size === 0) return []

  /**
   * Collects the shallowest covered nodes at or below the ones given.
   *
   * @param nodes - The nodes to collect from.
   * @returns The covering nodes among them and their descendants.
   */
  function collect(nodes: ContestNode[]): ContestNode[] {
    // A covered node stands for its whole subtree, so it is emitted and not descended into
    return nodes.flatMap((node) =>
      isWhollyCovered(node, picked) ? [node] : collect(node.children)
    )
  }

  // Starting from the roots is what makes the result come out in the tree's own order
  return collect(tree.roots)
}
