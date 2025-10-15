/**
 * Tree selection utilities
 */

export type TreeNode = {
  id: string
  displayName: string
  count?: number
  children?: TreeNode[]
}

/**
 * Gets all descendant IDs from a tree node
 */
export function getAllDescendantIds(node: TreeNode, includeNode = false): string[] {
  const ids: string[] = includeNode ? [node.id] : []

  if (node.children) {
    for (const child of node.children) {
      ids.push(...getAllDescendantIds(child, true))
    }
  }

  return ids
}

/**
 * Gets all ancestor IDs for a given node ID within a tree
 */
export function getAllAncestorIds(nodeId: string, allNodes: TreeNode[]): string[] {
  const ancestors: string[] = []

  function findAncestors(nodes: TreeNode[], path: string[] = []): boolean {
    for (const node of nodes) {
      const currentPath = [...path, node.id]

      if (node.id === nodeId) {
        ancestors.push(...path)
        return true
      }

      if (node.children && findAncestors(node.children, currentPath)) {
        return true
      }
    }
    return false
  }

  findAncestors(allNodes)
  return ancestors
}

/**
 * Calculates the parent state based on selected descendants and explicit parent selection
 */
export function calculateParentState(
  node: TreeNode,
  selectedIds: string[]
): 'checked' | 'indeterminate' | 'unchecked' {
  if (!node.children || node.children.length === 0) {
    return selectedIds.includes(node.id) ? 'checked' : 'unchecked'
  }

  // If this node is explicitly selected, it's checked
  if (selectedIds.includes(node.id)) {
    return 'checked'
  }

  const allDescendants = getAllDescendantIds(node)
  const selectedDescendants = allDescendants.filter((id) => selectedIds.includes(id))

  if (selectedDescendants.length === allDescendants.length && allDescendants.length > 0) {
    return 'checked'
  } else if (selectedDescendants.length > 0) {
    return 'indeterminate'
  } else {
    return 'unchecked'
  }
}

/**
 * Checks if a node should be considered checked based on explicit selection or ancestor selection
 */
export function isNodeEffectivelyChecked(
  nodeId: string,
  selectedIds: string[],
  allNodes: TreeNode[]
): boolean {
  // Direct selection
  if (selectedIds.includes(nodeId)) {
    return true
  }

  // Check if any ancestor is explicitly selected
  const ancestors = getAllAncestorIds(nodeId, allNodes)
  return ancestors.some((ancestorId) => selectedIds.includes(ancestorId))
}

/**
 * Toggles node selection (handles both leaf and parent nodes)
 */
export function toggleNodeSelection(
  node: TreeNode,
  currentSelected: string[],
  allNodes?: TreeNode[]
): string[] {
  if (!node.children || node.children.length === 0) {
    // Leaf node - check if it's effectively selected due to parent
    const isDirectlySelected = currentSelected.includes(node.id)

    if (isDirectlySelected) {
      // Directly selected - just remove it
      return currentSelected.filter((id) => id !== node.id)
    } else if (allNodes) {
      // Check if it's selected due to a parent being selected
      const ancestors = getAllAncestorIds(node.id, allNodes)
      const selectedAncestor = ancestors.find((ancestorId) => currentSelected.includes(ancestorId))

      if (selectedAncestor) {
        // Parent is selected - we need to "break down" the parent selection
        // Remove the selected parent and add all its children except this node
        let result = currentSelected.filter((id) => id !== selectedAncestor)

        // Find the selected ancestor node to get all its descendants
        const ancestorNode = findNodeById(allNodes, selectedAncestor)
        if (ancestorNode && ancestorNode.children) {
          // Get all leaf descendants (only the actual selectable items, not intermediate parents)
          const allDescendants = getAllDescendantIds(ancestorNode)
          const leafDescendants = allDescendants.filter((id) => {
            const descendantNode = findNodeById(allNodes, id)
            return (
              descendantNode && (!descendantNode.children || descendantNode.children.length === 0)
            )
          })

          // Add all leaf descendants except the one we're deselecting
          const siblingsToKeep = leafDescendants.filter((id) => id !== node.id)
          result = [...result, ...siblingsToKeep]
        }

        return result
      } else {
        // No parent selected - just add this node
        return [...currentSelected, node.id]
      }
    } else {
      // No tree context provided - just add this node
      return [...currentSelected, node.id]
    }
  }

  // Parent node - check if explicitly selected
  const isExplicitlySelected = currentSelected.includes(node.id)
  const allDescendants = getAllDescendantIds(node)

  if (isExplicitlySelected) {
    // Parent is explicitly selected - deselect it
    return currentSelected.filter((id) => id !== node.id)
  } else {
    // Parent not explicitly selected - select it and remove any individual descendants
    const otherSelected = currentSelected.filter((id) => !allDescendants.includes(id))
    return [...otherSelected, node.id]
  }
}

/**
 * Toggles expansion state of a node
 */
export function toggleExpansion(nodeId: string, expandedIds: string[]): string[] {
  if (expandedIds.includes(nodeId)) {
    return expandedIds.filter((id) => id !== nodeId)
  } else {
    return [...expandedIds, nodeId]
  }
}

/**
 * Finds a node by ID in a tree
 */
function findNodeById(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNodeById(node.children, id)
      if (found) return found
    }
  }
  return null
}
