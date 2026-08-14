import { describe, expect, it } from 'vitest'

import { foldPickedPaths } from '../utils/competition-selection-fold'
import { DEEP_TAXONOMY, makeCompetitionTree } from './competition-tree-fixture'

/** The taxonomy every case here folds against, five levels at its deepest. */
const tree = makeCompetitionTree(DEEP_TAXONOMY)

/**
 * Folds the given paths and reports which nodes came out.
 *
 * @param paths - The paths picked in their own right.
 * @returns The covering nodes' paths.
 */
function fold(paths: string[]): string[] {
  // The covering nodes, by path
  return foldPickedPaths(paths, tree).map((node) => node.path)
}

describe('folding a complete set of siblings', () => {
  it('gives way to the node above them', () => {
    // Both subrounds of one round, which is everything that round holds
    expect(fold(['mo-a-i-navodne-x', 'mo-a-i-navodne-y'])).toEqual(['mo-a-i-navodne'])
  })

  it('carries all the way up in one pass, however many levels that takes', () => {
    // Every leaf under MO, picked individually and never naming a branch
    const everyLeaf = [
      'mo-a-i-navodne-x',
      'mo-a-i-navodne-y',
      'mo-a-i-doplnujuce',
      'mo-a-ii',
      'mo-b-i',
    ]

    // Every level collapses at once, up to the competition itself
    expect(fold(everyLeaf)).toEqual(['mo'])
  })

  it('stops at the highest node that is wholly covered', () => {
    // Everything under A, but nothing under B
    expect(fold(['mo-a-i-navodne-x', 'mo-a-i-navodne-y', 'mo-a-i-doplnujuce', 'mo-a-ii'])).toEqual([
      'mo-a',
    ])
  })
})

describe('folding an incomplete set', () => {
  it('leaves it broken into whatever is covered', () => {
    // One subround short of the set that would fold
    expect(fold(['mo-a-i-navodne-x', 'mo-a-i-doplnujuce'])).toEqual([
      'mo-a-i-navodne-x',
      'mo-a-i-doplnujuce',
    ])
  })

  it('never sweeps in a sibling that was not picked', () => {
    // A round with nothing under it is covered only by being picked, so its unpicked sibling must
    // keep the node above them from folding
    expect(fold(['mid-i'])).toEqual(['mid-i'])
  })

  it('folds a node whose only child is picked', () => {
    // B holds exactly one round, so picking it covers B outright
    expect(fold(['mo-b-i'])).toEqual(['mo-b'])
  })
})

describe('a node picked in its own right', () => {
  it('stands for its whole subtree, and anything below it is dropped', () => {
    // An ancestor and one of its descendants, which would otherwise be recorded twice
    expect(fold(['mo-a', 'mo-a-i-navodne-x'])).toEqual(['mo-a'])
  })

  it('is emitted even when it has nothing under it', () => {
    // A root with no children at all, which only ever stands for itself
    expect(fold(['flat'])).toEqual(['flat'])
  })
})

describe('what the fold refuses', () => {
  it('drops a path the taxonomy does not hold', () => {
    // A URL written against a taxonomy this one no longer matches
    expect(fold(['ghost', 'mo-a-i-navodne-x'])).toEqual(['mo-a-i-navodne-x'])
  })

  it('folds nothing to nothing', () => {
    // No paths at all, which is what an absent parameter looks like
    expect(fold([])).toEqual([])

    // Every path dropped comes to the same thing
    expect(fold(['ghost'])).toEqual([])
  })
})

describe('the order the fold reports in', () => {
  it('reads the tree top to bottom, whatever order the picks arrived in', () => {
    // Picked shallowest-first and from the last root backwards
    const picked = ['flat', 'mid-t', 'mo-a-i-doplnujuce']

    // The tree's own order, so the same filter always serialises the same way
    expect(fold(picked)).toEqual(['mo-a-i-doplnujuce', 'mid-t', 'flat'])
  })
})
