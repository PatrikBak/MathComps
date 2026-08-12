// Builds a taxonomy of any depth for the tests. buildContestTree reads the API's three levels and so
// can never emit deeper than that, which leaves the recursion below them untested; this constructs the
// tree directly instead.

import type { ContestNode, ContestTree } from '../utils/contest-tree'

/** How deep the legacy projection can reach before it runs out of levels to name. */
const LEGACY_LEVELS = 3

/**
 * A node to build, carrying only what the build cannot work out for itself.
 */
export type ContestNodeSpec = {
  /** The node's own slug, unique among its siblings. */
  slug: string
  /** The node's own label, defaulting to the slug in upper case. */
  displayName?: string
  /** How many problems sit under it, defaulting to zero. */
  count?: number
  /** The nodes one level below. */
  children?: ContestNodeSpec[]
}

/**
 * Builds a taxonomy from a nested literal, filling in each node's path, label and lookup entry.
 *
 * @param specs - The roots to build.
 * @returns The tree and its lookup.
 */
export function makeContestTree(specs: ContestNodeSpec[]): ContestTree {
  // Filled in as the build walks down
  const byPath = new Map<string, ContestNode>()

  /**
   * Builds one node and everything below it.
   *
   * @param spec - The node to build.
   * @param parentPath - The path of the node above, empty at a root.
   * @param parentLabel - The label of the node above, empty at a root.
   * @returns The node.
   */
  function build(spec: ContestNodeSpec, parentPath: string, parentLabel: string): ContestNode {
    // The path down to this node, which is what addresses it everywhere
    const path = parentPath === '' ? spec.slug : `${parentPath}-${spec.slug}`

    // The node's own label
    const displayName = spec.displayName ?? spec.slug.toUpperCase()

    // Every ancestor's label and this node's
    const pathLabel = parentLabel === '' ? displayName : `${parentLabel} - ${displayName}`

    // The first segments read positionally as the legacy three levels. Position alone cannot tell a
    // round hanging straight off a competition from a category, so nothing may assert on this
    const [competitionSlug, categorySlug, roundSlug] = path.split('-').slice(0, LEGACY_LEVELS)

    // Built bottom-up, so a node knows its children before it is recorded
    const node: ContestNode = {
      path,
      displayName,
      pathLabel,
      count: spec.count ?? 0,
      children: (spec.children ?? []).map((child) => build(child, path, pathLabel)),
      apiSelection: { competitionSlug, categorySlug, roundSlug },
    }

    // Recorded once complete, so the lookup never holds a half-built node
    byPath.set(path, node)

    // The node, with everything below it already built
    return node
  }

  // One root per top-level spec
  return { roots: specs.map((spec) => build(spec, '', '')), byPath }
}

/**
 * A five-deep taxonomy: a competition, its categories, their rounds, the "návodné a doplňujúce úlohy"
 * hanging off a round, and one level below even that.
 *
 * `mo` runs the full five levels, `flat` has none below itself, and `mid` stops at two, so a single
 * tree covers a leaf at every depth.
 */
export const DEEP_TAXONOMY: ContestNodeSpec[] = [
  {
    slug: 'mo',
    children: [
      {
        slug: 'a',
        children: [
          {
            slug: 'i',
            children: [
              { slug: 'navodne', children: [{ slug: 'x' }, { slug: 'y' }] },
              { slug: 'doplnujuce' },
            ],
          },
          { slug: 'ii' },
        ],
      },
      { slug: 'b', children: [{ slug: 'i' }] },
    ],
  },
  { slug: 'mid', children: [{ slug: 'i' }, { slug: 't' }] },
  { slug: 'flat' },
]
