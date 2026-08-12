// The competition taxonomy as a tree of arbitrary depth, and the build that makes one out of the
// hierarchy the API sends.

import type { TreeNode } from '@/components/shared/components/facets/model/facet-types'

import type { CompetitionFilterOption, FacetOption } from '../types/problem-api-types'
import type { ContestSelection } from '../types/problem-library-types'
import {
  type LegacyApiContest,
  legacyCategory,
  legacyCompetition,
  legacyRound,
} from './contest-api-legacy'

/** Joins a node's slug to its parent's path. */
const PATH_SEPARATOR = '-'

/** Sits between the ancestor names in a node's path label. */
const LABEL_SEPARATOR = ' - '

/**
 * A node in the competition taxonomy, addressed by the path of slugs leading down to it.
 */
export type ContestNode = {
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
  children: ContestNode[]
  /** How the backend names this node. */
  apiSelection: LegacyApiContest
}

/**
 * The taxonomy, both as the tree it is and as a lookup, so a path resolves to its node without guessing
 * which level a segment belongs to.
 */
export type ContestTree = {
  /** The competitions, in the taxonomy's own order. */
  roots: ContestNode[]
  /** Every node in the tree, at whatever depth, keyed by its path. */
  byPath: Map<string, ContestNode>
}

/**
 * Joins a parent's path to a child's slug.
 *
 * @param parentPath - The parent's path, empty at a root.
 * @param slug - The child's own slug.
 * @returns The child's path.
 */
function joinPath(parentPath: string, slug: string): string {
  // A root has nothing above it to join to
  return parentPath === '' ? slug : `${parentPath}${PATH_SEPARATOR}${slug}`
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
 * @returns The tree and its lookup, per {@link ContestTree}.
 */
export function buildContestTree(
  base: CompetitionFilterOption[],
  filtered: CompetitionFilterOption[]
): ContestTree {
  // Every node built so far, keyed by its path
  const byPath = new Map<string, ContestNode>()

  // The filtered competitions keyed by slug
  const filteredBySlug = new Map(
    filtered.map((competition) => [competition.competitionData.slug, competition])
  )

  /**
   * Records a node in the lookup and hands it back.
   *
   * @param node - The node to record.
   * @returns The same node.
   */
  function record(node: ContestNode): ContestNode {
    // Paths are unique across the whole tree, so one map holds every depth at once
    byPath.set(node.path, node)

    // The node, now recorded
    return node
  }

  /**
   * Builds one node from a facet option, with the count taken from its filtered twin.
   *
   * @param option - The option in the whole hierarchy, which supplies identity and label.
   * @param filteredOption - The same option under the current filters, absent when it has nothing left.
   * @param parentPath - The path of the node above, empty at a root.
   * @param parentLabel - The label of the node above, empty at a root.
   * @param apiSelection - How the backend names this node.
   * @param children - The nodes one level below.
   * @returns The node.
   */
  function buildNode(
    option: FacetOption,
    filteredOption: FacetOption | undefined,
    parentPath: string,
    parentLabel: string,
    apiSelection: LegacyApiContest,
    children: ContestNode[]
  ): ContestNode {
    // The node, with a count of zero when the filters left nothing under it
    return record({
      path: joinPath(parentPath, option.slug),
      displayName: option.displayName,
      fullName: option.fullName,
      pathLabel: joinLabel(parentLabel, option.displayName),
      count: filteredOption?.count ?? 0,
      children,
      apiSelection,
    })
  }

  // One root per competition, each carrying whatever hangs off it
  const roots = base.map((baseCompetition) => {
    // The competition's own slug
    const competitionSlug = baseCompetition.competitionData.slug

    // The competition's label
    const competitionLabel = baseCompetition.competitionData.displayName

    // What this competition looks like under the current filters
    const filteredCompetition = filteredBySlug.get(competitionSlug)

    // The category level, in competitions that have one
    const categoryChildren = baseCompetition.categoryData.map((baseCategory) => {
      // The category's own slug
      const categorySlug = baseCategory.categoryData.slug

      // What this category looks like under the current filters
      const filteredCategory = filteredCompetition?.categoryData.find(
        (category) => category.categoryData.slug === categorySlug
      )

      // The rounds sitting under the category, which carry nothing below them
      const roundChildren = baseCategory.roundData.map((baseRound) =>
        buildNode(
          baseRound,
          filteredCategory?.roundData.find((round) => round.slug === baseRound.slug),
          joinPath(competitionSlug, categorySlug),
          joinLabel(competitionLabel, baseCategory.categoryData.displayName),
          legacyRound(competitionSlug, baseRound.slug, categorySlug),
          []
        )
      )

      // The category itself, standing for every round under it
      return buildNode(
        baseCategory.categoryData,
        filteredCategory?.categoryData,
        competitionSlug,
        competitionLabel,
        legacyCategory(competitionSlug, categorySlug),
        roundChildren
      )
    })

    // Some competitions have no category level and hang their rounds off the root
    const directRoundChildren = baseCompetition.roundData.map((baseRound) =>
      buildNode(
        baseRound,
        filteredCompetition?.roundData.find((round) => round.slug === baseRound.slug),
        competitionSlug,
        competitionLabel,
        legacyRound(competitionSlug, baseRound.slug),
        []
      )
    )

    // A competition can carry both levels at once, categories first
    return buildNode(
      baseCompetition.competitionData,
      filteredCompetition?.competitionData,
      '',
      '',
      legacyCompetition(competitionSlug),
      [...categoryChildren, ...directRoundChildren]
    )
  })

  // The tree and its lookup
  return { roots, byPath }
}

/**
 * Renders the taxonomy as the shared facet's own node shape, which addresses a node by an opaque id and
 * reads a leaf as one carrying no children at all rather than an empty list.
 *
 * @param nodes - The nodes to render, at any depth.
 * @returns The same nodes as {@link TreeNode}s.
 */
export function toFacetNodes(nodes: ContestNode[]): TreeNode[] {
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
 * Turns a node into the selection the filters hold.
 *
 * @param node - The node the filter names.
 * @returns The selection standing for it.
 */
export function contestSelectionFor(node: ContestNode): ContestSelection {
  // The selection, which addresses the node and names it for the backend
  return {
    path: node.path,
    apiSelection: node.apiSelection,
  }
}

/**
 * Resolves paths against the taxonomy. A path naming no node means the URL was written for a taxonomy
 * this one no longer matches, which is treated as a broken URL rather than quietly dropping the filter
 * the reader asked for.
 *
 * @param paths - The paths to resolve.
 * @param tree - The taxonomy to resolve them against.
 * @returns The selections, or null when any path names no node.
 */
export function resolveContestPaths(paths: string[], tree: ContestTree): ContestSelection[] | null {
  // The selections the paths resolve to
  const selections: ContestSelection[] = []

  // Every path has to land, since a partly understood filter is worse than an obviously broken one
  for (const path of paths) {
    // The node the path names, absent when the taxonomy has moved on since the URL was written
    const node = tree.byPath.get(path)

    // One unresolvable path condemns the whole URL
    if (!node) return null

    // The node stands as a filter at whatever depth it sits
    selections.push(contestSelectionFor(node))
  }

  // Every path landed
  return selections
}

/**
 * The nodes that start out open, which is every node with anything under it plus the roots, so the whole
 * hierarchy is visible without any clicking.
 *
 * @param tree - The taxonomy.
 * @returns Their paths.
 */
export function expandedByDefault(tree: ContestTree): string[] {
  /**
   * Collects a node and everything below it worth opening.
   *
   * @param nodes - The nodes to collect from.
   * @returns Their paths, in the order the tree draws them.
   */
  function collect(nodes: ContestNode[]): string[] {
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
