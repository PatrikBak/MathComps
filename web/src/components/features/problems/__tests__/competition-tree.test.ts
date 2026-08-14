import { describe, expect, it } from 'vitest'

import {
  buildCompetitionTree,
  expandedByDefault,
  resolveCompetitionPaths,
  toFacetNodes,
} from '../utils/competition-tree'
import {
  DEEP_TAXONOMY,
  makeCompetitionOptions,
  makeCompetitionTree,
} from './competition-tree-fixture'

/** The taxonomy every case here runs against, five levels at its deepest. */
const tree = makeCompetitionTree(DEEP_TAXONOMY)

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
    const resolved = resolveCompetitionPaths(['flat', 'mo-a', 'mo-a-i-navodne-y'], tree)

    // Each lands on the node it names
    expect(resolved?.map((selection) => selection.path)).toEqual([
      'flat',
      'mo-a',
      'mo-a-i-navodne-y',
    ])
  })

  it('rejects the whole URL when a path names no node, at any depth', () => {
    // A path that names nothing condemns the URL whether it is one segment long or five
    expect(resolveCompetitionPaths(['ghost'], tree)).toBeNull()
    expect(resolveCompetitionPaths(['mo-zz'], tree)).toBeNull()
    expect(resolveCompetitionPaths(['mo-a-i-navodne-zz'], tree)).toBeNull()
    expect(resolveCompetitionPaths(['mo-a-i-navodne-x-deeper'], tree)).toBeNull()

    // Including when it arrives alongside paths that would have resolved
    expect(resolveCompetitionPaths(['flat', 'ghost'], tree)).toBeNull()
  })

  it('resolves nothing to nothing rather than to a broken URL', () => {
    // No paths at all is what an absent parameter looks like, which is not an error
    expect(resolveCompetitionPaths([], tree)).toEqual([])
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

/** The whole taxonomy as the API sends it, which decides which nodes exist and how they are ordered. */
const baseOptions = makeCompetitionOptions(DEEP_TAXONOMY)

/**
 * The same taxonomy under a filter that leaves one branch standing all the way down and one root
 * beside it. A node the filter empties never comes back in this payload at all, which is what the
 * merge has to survive.
 */
const filteredOptions = makeCompetitionOptions([
  {
    slug: 'mo',
    count: 7,
    children: [
      {
        slug: 'a',
        count: 7,
        children: [
          {
            slug: 'i',
            count: 7,
            children: [{ slug: 'navodne', count: 7, children: [{ slug: 'y', count: 7 }] }],
          },
        ],
      },
    ],
  },
  { slug: 'flat', count: 2 },
])

/** The two payloads merged, which is how the facet is drawn under a live filter. */
const mergedTree = buildCompetitionTree(baseOptions, filteredOptions)

describe('taking counts from the filtered hierarchy', () => {
  it('counts a node five levels down off its filtered twin', () => {
    // The deepest node the filter left standing
    expect(mergedTree.byPath.get('mo-a-i-navodne-y')?.count).toBe(7)
  })

  it('keeps a node the filter emptied, reading zero', () => {
    // Its sibling, which the filtered payload leaves out entirely
    const emptied = mergedTree.byPath.get('mo-a-i-navodne-x')

    // Still in the tree, so the facet never loses a row mid-filter
    expect(emptied?.count).toBe(0)

    // As is everything under the one root the filter dropped outright
    expect(mergedTree.byPath.get('mid-t')?.count).toBe(0)
  })

  it('takes identity, order and labels from the whole hierarchy', () => {
    // The roots, including the one the filtered payload never mentions
    expect(mergedTree.roots.map((root) => root.path)).toEqual(['mo', 'mid', 'flat'])

    // A branch the filter cut short still offers everything below it, in the order it always did
    expect(mergedTree.byPath.get('mo-a')?.children.map((child) => child.path)).toEqual([
      'mo-a-i',
      'mo-a-ii',
    ])

    // And a node reads under the ancestors the whole hierarchy gives it, not the filtered one
    expect(mergedTree.byPath.get('mo-a-i-navodne-x')?.pathLabel).toBe('MO - A - I - NAVODNE - X')
  })
})
