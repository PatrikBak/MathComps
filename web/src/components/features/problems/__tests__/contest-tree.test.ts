import { describe, expect, it } from 'vitest'

import type { CompetitionFilterOption } from '../types/problem-api-types'
import {
  buildContestTree,
  expandedByDefault,
  resolveContestPaths,
  toFacetNodes,
} from '../utils/contest-tree'
import { DEEP_TAXONOMY, makeContestTree } from './contest-tree-fixture'

/** The taxonomy every case here runs against, five levels at its deepest. */
const tree = makeContestTree(DEEP_TAXONOMY)

describe('addressing a node by its path', () => {
  it('indexes every node at every depth', () => {
    // One entry per node, whatever depth it sits at
    expect([...tree.byPath.keys()]).toEqual([
      'mo-a-i-navodne-x',
      'mo-a-i-navodne-y',
      'mo-a-i-navodne',
      'mo-a-i-doplnujuce',
      'mo-a-i',
      'mo-a-ii',
      'mo-a',
      'mo-b-i',
      'mo-b',
      'mo',
      'mid-i',
      'mid-t',
      'mid',
      'flat',
    ])
  })

  it('resolves paths at any depth', () => {
    // Three paths resolved at once, one per depth from a root down to the deepest leaf
    const resolved = resolveContestPaths(['flat', 'mo-a', 'mo-a-i-navodne-y'], tree)

    // Each lands on the node it names
    expect(resolved?.map((selection) => selection.path)).toEqual([
      'flat',
      'mo-a',
      'mo-a-i-navodne-y',
    ])
  })

  it('rejects the whole URL when a path names no node, at any depth', () => {
    // A path that names nothing condemns the URL whether it is one segment long or five
    expect(resolveContestPaths(['ghost'], tree)).toBeNull()
    expect(resolveContestPaths(['mo-zz'], tree)).toBeNull()
    expect(resolveContestPaths(['mo-a-i-navodne-zz'], tree)).toBeNull()
    expect(resolveContestPaths(['mo-a-i-navodne-x-deeper'], tree)).toBeNull()

    // Including when it arrives alongside paths that would have resolved
    expect(resolveContestPaths(['flat', 'ghost'], tree)).toBeNull()
  })

  it('resolves nothing to nothing rather than to a broken URL', () => {
    // No paths at all is what an absent parameter looks like, which is not an error
    expect(resolveContestPaths([], tree)).toEqual([])
  })
})

describe('handing the taxonomy to the facet', () => {
  it('leaves a leaf carrying no children at all', () => {
    // The roots as the facet's own nodes, with the middle one left alone here
    const [mo, _mid, flat] = toFacetNodes(tree.roots)

    // A root with nothing under it
    expect(flat.children).toBeUndefined()

    // The node five levels down, reached one level at a time
    const deepLeaf = mo.children?.[0].children?.[0].children?.[0].children?.[0]

    // The walk reached the bottom rather than running out of levels on the way
    expect(deepLeaf?.id).toBe('mo-a-i-navodne-x')

    // And what it reached is a leaf
    expect(deepLeaf?.children).toBeUndefined()
  })

  it('gives a node deep in the tree its path as its id', () => {
    // The facet's id is the path, which is what lets a click be read straight back as a selection
    expect(toFacetNodes(tree.roots)[0].children?.[0].children?.[0].id).toBe('mo-a-i')
  })
})

describe('which branches start open', () => {
  it('opens every branch and every root, and nothing that is a leaf below a root', () => {
    // Every node with something under it, plus the childless roots, in the tree's own order
    expect(expandedByDefault(tree)).toEqual([
      'mo',
      'mo-a',
      'mo-a-i',
      'mo-a-i-navodne',
      'mo-b',
      'mid',
      'flat',
    ])
  })
})

/**
 * A competition carrying both levels at once: a category with a round under it, and a round hanging
 * straight off the competition. The API's shape allows the mix, so the tree has to draw both under the
 * one competition.
 */
const MIXED_COMPETITION: CompetitionFilterOption[] = [
  {
    competitionData: { slug: 'mixed', displayName: 'MIXED', count: 9 },
    categoryData: [
      {
        categoryData: { slug: 'a', displayName: 'A', count: 6 },
        roundData: [{ slug: 'i', displayName: 'I', count: 6 }],
      },
    ],
    roundData: [{ slug: 'finale', displayName: 'FINALE', count: 3 }],
  },
]

/** That payload as the real builder reads it, with its counts taken from the payload itself. */
const mixedTree = buildContestTree(MIXED_COMPETITION, MIXED_COMPETITION)

describe('naming a node to the backend', () => {
  it('names each node by the levels reaching down to it', () => {
    // A competition stands for everything under it, so no level below it is named
    expect(mixedTree.byPath.get('mixed')?.apiSelection).toEqual({ competitionSlug: 'mixed' })

    // A category stands for every round in it
    expect(mixedTree.byPath.get('mixed-a')?.apiSelection).toEqual({
      competitionSlug: 'mixed',
      categorySlug: 'a',
    })

    // A round under a category names all three levels
    expect(mixedTree.byPath.get('mixed-a-i')?.apiSelection).toEqual({
      competitionSlug: 'mixed',
      categorySlug: 'a',
      roundSlug: 'i',
    })

    // A round hanging off the competition leaves the category unnamed, which is what tells the backend
    // there is no category level to match on
    expect(mixedTree.byPath.get('mixed-finale')?.apiSelection).toEqual({
      competitionSlug: 'mixed',
      roundSlug: 'finale',
    })
  })

  it('hangs both levels off a competition carrying each, categories first', () => {
    // The competition's children, which are its one category and its one direct round
    expect(mixedTree.roots[0].children.map((child) => child.path)).toEqual([
      'mixed-a',
      'mixed-finale',
    ])
  })
})
