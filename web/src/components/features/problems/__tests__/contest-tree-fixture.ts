// Writes a taxonomy of any depth as a terse nested literal, so a test naming a node five levels down
// does not have to spell out every path the payload carries. The real builder turns that payload into
// the tree.

import type { ContestNodeOption } from '../types/problem-api-types'
import { buildContestTree, type ContestTree } from '../utils/contest-tree'

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
 * Writes the specs out as the payload the API sends, filling in each node's path.
 *
 * @param specs - The nodes to write out, at any depth.
 * @param parentPath - The path of the node above, left off at a root.
 * @returns The same nodes, each addressed by its path.
 */
export function makeContestOptions(specs: ContestNodeSpec[], parentPath = ''): ContestNodeOption[] {
  // One option per spec, each carrying everything below it
  return specs.map((spec) => {
    // The path down to this node, which is what addresses it everywhere
    const path = parentPath === '' ? spec.slug : `${parentPath}-${spec.slug}`

    // The node's own label, which stands as its full name too
    const displayName = spec.displayName ?? spec.slug.toUpperCase()

    // The node, with the generation below it written out under it
    return {
      path,
      displayName,
      fullName: displayName,
      count: spec.count ?? 0,
      children: makeContestOptions(spec.children ?? [], path),
    }
  })
}

/**
 * Builds a taxonomy from a nested literal, every node counting only what the literal gives it.
 *
 * @param specs - The roots to build.
 * @returns The tree and its lookup.
 */
export function makeContestTree(specs: ContestNodeSpec[]): ContestTree {
  // The payload both sides of the merge read, so every node keeps the count the literal wrote
  const options = makeContestOptions(specs)

  // The tree the real builder makes of it
  return buildContestTree(options, options)
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
