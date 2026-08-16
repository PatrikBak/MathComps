// The competition taxonomy as a tree of arbitrary depth, and the build that makes one out of the
// hierarchy the API sends.

import type { TreeNode } from '@/components/shared/components/facets/model/facet-types'

import type { CompetitionNodeOption } from '../types/problem-api-types'

/** Sits between the ancestor names in a node's path label. */
const LABEL_SEPARATOR = ' - '

/**
 * A node in the competition taxonomy, addressed by the path of slugs leading down to it.
 */
export type CompetitionNode = {
  /** The slugs from the root down to this node, joined, e.g. `csmo-a-i`. */
  path: string
  /** The node's own label. */
  displayName: string
  /** The node's name in full, where its label is only as much of it as its surroundings leave to say. */
  fullName?: string
  /** Every ancestor's label and this node's, joined, e.g. "SKMO - Kategória A - Školské kolo". */
  pathLabel: string
  /** How many problems sit under this node, counting its whole subtree. */
  count: number
  /** The nodes one level below, empty at a leaf. */
  children: CompetitionNode[]
}

/**
 * The taxonomy, both as the tree it is and as a lookup, so a path resolves to its node without guessing
 * which level a segment belongs to.
 */
export type CompetitionTree = {
  /** The competitions, in the taxonomy's own order. */
  roots: CompetitionNode[]
  /** Every node in the tree, at whatever depth, keyed by its path. */
  byPath: Map<string, CompetitionNode>
}

/**
 * Joins an ancestor's label to a node's own.
 *
 * @param parentLabel - The parent's label, empty at a root.
 * @param displayName - The node's own label.
 * @returns The label the node reads under on its own.
 */
function joinLabel(parentLabel: string, displayName: string): string {
  // A root reads under nothing but its own name
  return parentLabel === '' ? displayName : `${parentLabel}${LABEL_SEPARATOR}${displayName}`
}

/**
 * Builds the taxonomy from the hierarchy the API sends, taking every node's identity and label from the
 * unfiltered one and only its count from the filtered one, so a node keeps its place in the tree even
 * when the current filters leave nothing under it.
 *
 * @param base - The whole hierarchy, which decides which nodes exist and how they are ordered.
 * @param filtered - The hierarchy under the current filters, which supplies the counts.
 * @returns The tree and its lookup, per {@link CompetitionTree}.
 */
export function buildCompetitionTree(
  base: CompetitionNodeOption[],
  filtered: CompetitionNodeOption[]
): CompetitionTree {
  // Every node built so far, keyed by its path
  const byPath = new Map<string, CompetitionNode>()

  // What the filters left of each node, keyed by path so a node finds its twin at any depth
  const filteredByPath = new Map(flattenOptions(filtered).map((option) => [option.path, option]))

  /**
   * Builds one generation and everything below it, with each node's count taken from its filtered twin.
   *
   * @param options - The options in the whole hierarchy, which supply identity, label and order.
   * @param parentLabel - The label of the node above, empty at a root.
   * @returns The nodes, in the order the hierarchy offers them.
   */
  function buildNodes(options: CompetitionNodeOption[], parentLabel: string): CompetitionNode[] {
    // One node per option, each carrying whatever hangs off it
    return options.map((option) => {
      // Every ancestor's label and this node's
      const pathLabel = joinLabel(parentLabel, option.displayName)

      // Built bottom-up, so a node knows its children before anything can look it up
      const node: CompetitionNode = {
        path: option.path,
        displayName: option.displayName,
        fullName: option.fullName,
        pathLabel,
        count: filteredByPath.get(option.path)?.count ?? 0,
        children: buildNodes(option.children, pathLabel),
      }

      // Paths are unique across the whole tree, so one map holds every depth at once
      byPath.set(node.path, node)

      // The node, now recorded
      return node
    })
  }

  // The competitions, each carrying everything below it
  const roots = buildNodes(base, '')

  // The tree and its lookup
  return { roots, byPath }
}

/**
 * Reads a hierarchy out as a flat list of every node in it, at whatever depth.
 *
 * @param options - The nodes to read out, at any depth.
 * @returns The same nodes, one level deep.
 */
function flattenOptions(options: CompetitionNodeOption[]): CompetitionNodeOption[] {
  // Every node at every depth, each ahead of the ones under it
  return options.flatMap((option) => [option, ...flattenOptions(option.children)])
}

/**
 * Renders the taxonomy as the shared facet's own node shape, which addresses a node by an opaque id and
 * reads a leaf as one carrying no children at all rather than an empty list.
 *
 * @param nodes - The nodes to render, at any depth.
 * @returns The same nodes as {@link TreeNode}s.
 */
export function toFacetNodes(nodes: CompetitionNode[]): TreeNode[] {
  // The path is unique across the tree, so it serves as the facet's id unchanged
  return nodes.map((node) => ({
    id: node.path,
    displayName: node.displayName,
    fullName: node.fullName,
    count: node.count,
    children: node.children.length > 0 ? toFacetNodes(node.children) : undefined,
  }))
}

/**
 * Checks paths against the taxonomy. A path naming no node means the URL was written for a taxonomy
 * this one no longer matches, which is treated as a broken URL rather than quietly dropping the filter
 * the reader asked for.
 *
 * @param paths - The paths to validate.
 * @param tree - The taxonomy to check them against.
 * @returns The same paths, or null when any of them names no node.
 */
export function validateCompetitionPaths(paths: string[], tree: CompetitionTree): string[] | null {
  // One path naming nothing condemns the whole set, since a partly understood filter is worse than
  // an obviously broken one
  if (paths.some((path) => !tree.byPath.has(path))) return null

  // Every path landed
  return paths
}

/**
 * The nodes that start out open, which is every node with anything under it plus the roots, so the whole
 * hierarchy is visible without any clicking.
 *
 * @param tree - The taxonomy.
 * @returns Their paths.
 */
export function expandedByDefault(tree: CompetitionTree): string[] {
  /**
   * Collects a node and everything below it worth opening.
   *
   * @param nodes - The nodes to collect from.
   * @returns Their paths, in the order the tree draws them.
   */
  function collect(nodes: CompetitionNode[]): string[] {
    // A node with nothing under it opens onto nothing, so only branches are worth naming
    return nodes.flatMap((node) =>
      node.children.length > 0 ? [node.path, ...collect(node.children)] : []
    )
  }

  // The roots come first whether or not they branch, since a competition heads its own section
  return tree.roots.flatMap((root) =>
    root.children.length > 0 ? [root.path, ...collect(root.children)] : [root.path]
  )
}
