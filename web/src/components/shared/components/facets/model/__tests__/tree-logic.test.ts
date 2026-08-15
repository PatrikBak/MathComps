import { describe, expect, it } from 'vitest'

import type { TreeNode } from '../facet-types'
import {
  calculateParentState,
  drawnRowIds,
  expandableRowIds,
  filterTreeBySearch,
  getAllAncestorIds,
  getAllDescendantIds,
  isNodeEffectivelyChecked,
  toggleNodeSelection,
} from '../tree-logic'

/** A competition hierarchy three levels deep, alongside a flatter one to keep it honest. */
const mockTree: TreeNode[] = [
  {
    id: 'competition/csmo',
    displayName: 'Matematická Olympiáda',
    children: [
      {
        id: 'competition/csmo/category/a',
        displayName: 'A',
        children: [
          { id: 'competition/csmo/category/a/round/i', displayName: 'Domáce kolo' },
          { id: 'competition/csmo/category/a/round/s', displayName: 'Školské kolo' },
          { id: 'competition/csmo/category/a/round/k', displayName: 'Krajské kolo' },
        ],
      },
      {
        id: 'competition/csmo/category/b',
        displayName: 'B',
        children: [
          { id: 'competition/csmo/category/b/round/i', displayName: 'Domáce kolo' },
          { id: 'competition/csmo/category/b/round/s', displayName: 'Školské kolo' },
        ],
      },
    ],
  },
  {
    id: 'competition/memo',
    displayName: 'Middle European Mathematical Olympiad',
    children: [
      { id: 'competition/memo/round/i', displayName: 'Individuálna súťaž' },
      { id: 'competition/memo/round/t', displayName: 'Tímová súťaž' },
    ],
  },
]

// Handles into the fixture, so no test has to spell a nested id out and risk drifting from it.
const CSMO = mockTree[0]
const CATEGORY_A = CSMO.children![0]
const CATEGORY_B = CSMO.children![1]
const A_HOME = CATEGORY_A.children![0]
const A_SCHOOL = CATEGORY_A.children![1]
const A_REGIONAL = CATEGORY_A.children![2]
const B_HOME = CATEGORY_B.children![0]
const B_SCHOOL = CATEGORY_B.children![1]
const MEMO_INDIVIDUAL = mockTree[1].children![0]

describe('tree-logic', () => {
  describe('getAllDescendantIds', () => {
    it('collects the ids below a node', () => {
      // Act on a node with three leaves under it
      const descendants = getAllDescendantIds(CATEGORY_A)

      // Only the leaves come back, in the order they are declared
      expect(descendants).toEqual([A_HOME.id, A_SCHOOL.id, A_REGIONAL.id])
    })

    it('includes the node itself when asked', () => {
      // Act with the flag that adds the node to its own descendants
      const descendants = getAllDescendantIds(CATEGORY_A, true)

      // The node leads, and its leaves follow in declaration order
      expect(descendants).toEqual([CATEGORY_A.id, A_HOME.id, A_SCHOOL.id, A_REGIONAL.id])
    })

    it('returns nothing for a leaf', () => {
      // Act on a node with no children at all
      const descendants = getAllDescendantIds(A_HOME)

      // An empty list, rather than the leaf itself
      expect(descendants).toEqual([])
    })
  })

  describe('getAllAncestorIds', () => {
    it('collects the ids above a deep node', () => {
      // Act on a third-level node
      const ancestors = getAllAncestorIds(A_HOME.id, mockTree)

      // Both levels above it come back, root first
      expect(ancestors).toEqual([CSMO.id, CATEGORY_A.id])
    })

    it('collects the id above a mid-level node', () => {
      // Act on a second-level node
      const ancestors = getAllAncestorIds(CATEGORY_A.id, mockTree)

      // Its competition, and nothing else
      expect(ancestors).toEqual([CSMO.id])
    })

    it('returns nothing for a root', () => {
      // Act on a top-level node
      const ancestors = getAllAncestorIds(CSMO.id, mockTree)

      // An empty path, which is what a root's ancestry looks like
      expect(ancestors).toEqual([])
    })

    it('returns nothing for an id the tree does not hold', () => {
      // Act on an id belonging to no node
      const ancestors = getAllAncestorIds('competition/nonexistent', mockTree)

      // Absent reads the same as rootless, rather than blowing up
      expect(ancestors).toEqual([])
    })
  })

  describe('isNodeEffectivelyChecked', () => {
    it('counts a node selected in its own right', () => {
      // Arrange one leaf as the whole selection
      const selectedIds = [A_HOME.id]

      // Act on that same leaf
      const isChecked = isNodeEffectivelyChecked(A_HOME.id, selectedIds, mockTree)

      // Covered, with no ancestry to consult
      expect(isChecked).toBe(true)
    })

    it('counts every child of a selected parent, and nothing outside it', () => {
      // Arrange a whole category as the selection
      const selectedIds = [CATEGORY_A.id]

      // Act across that category's own leaves
      const covered = [A_HOME, A_SCHOOL, A_REGIONAL].map((node) =>
        isNodeEffectivelyChecked(node.id, selectedIds, mockTree)
      )

      // Act on a leaf belonging to its sibling
      const outside = isNodeEffectivelyChecked(B_HOME.id, selectedIds, mockTree)

      // Coverage reaches the category's own leaves and stops there
      expect(covered).toEqual([true, true, true])
      expect(outside).toBe(false)
    })

    it('counts a grandchild of a selected node', () => {
      // Arrange an entire competition as the selection
      const selectedIds = [CSMO.id]

      // Act two levels down
      const covered = [CATEGORY_A, A_HOME, B_SCHOOL].map((node) =>
        isNodeEffectivelyChecked(node.id, selectedIds, mockTree)
      )

      // Act on an unrelated competition
      const otherCompetition = isNodeEffectivelyChecked(MEMO_INDIVIDUAL.id, selectedIds, mockTree)

      // Coverage reaches all the way down, and stops at the competition's edge
      expect(covered).toEqual([true, true, true])
      expect(otherCompetition).toBe(false)
    })

    it('does not count a node in an unrelated branch', () => {
      // Arrange a selection in one competition
      const selectedIds = [CATEGORY_A.id]

      // Act on a node in another
      const isChecked = isNodeEffectivelyChecked(MEMO_INDIVIDUAL.id, selectedIds, mockTree)

      // Uncovered, since nothing on its own path is selected
      expect(isChecked).toBe(false)
    })
  })

  describe('calculateParentState', () => {
    it('reads a node selected in its own right as checked', () => {
      // Arrange the node itself as the selection
      const selectedIds = [CATEGORY_A.id]

      // Act on that node
      const state = calculateParentState(CATEGORY_A, selectedIds)

      // Checked, without the subtree getting a say
      expect(state).toBe('checked')
    })

    it('reads a node with every child selected as checked', () => {
      // Arrange all three leaves, but not the parent
      const selectedIds = [A_HOME.id, A_SCHOOL.id, A_REGIONAL.id]

      // Act on their parent
      const state = calculateParentState(CATEGORY_A, selectedIds)

      // Checked, on the strength of the subtree alone
      expect(state).toBe('checked')
    })

    it('reads a node with only some children selected as indeterminate', () => {
      // Arrange two of the three leaves
      const selectedIds = [A_HOME.id, A_SCHOOL.id]

      // Act on their parent
      const state = calculateParentState(CATEGORY_A, selectedIds)

      // The mixed state, since the third leaf is still untouched
      expect(state).toBe('indeterminate')
    })

    it('reads an untouched node as unchecked', () => {
      // Arrange a selection in another competition entirely
      const selectedIds = [MEMO_INDIVIDUAL.id]

      // Act on a node that selection does not reach
      const state = calculateParentState(CATEGORY_A, selectedIds)

      // Untouched, since the selection lies outside its subtree entirely
      expect(state).toBe('unchecked')
    })

    it('reads a leaf from its own selection alone', () => {
      // Arrange one leaf as the selection
      const selectedIds = [A_HOME.id]

      // Act on the selected leaf
      const selectedState = calculateParentState(A_HOME, selectedIds)

      // Act on one of its siblings
      const siblingState = calculateParentState(A_SCHOOL, selectedIds)

      // Neither leaf can be part-selected, so both read outright
      expect(selectedState).toBe('checked')
      expect(siblingState).toBe('unchecked')
    })
  })

  describe('toggleNodeSelection', () => {
    it('selects and deselects a parent as a single entry', () => {
      // Act on an empty selection
      const afterSelect = toggleNodeSelection(CSMO, [], mockTree)

      // Act again on what came back
      const afterDeselect = toggleNodeSelection(CSMO, afterSelect, mockTree)

      // The parent alone goes in, and comes back out again
      expect(afterSelect).toEqual([CSMO.id])
      expect(afterDeselect).toEqual([])
    })

    it('replaces individually selected descendants with the parent', () => {
      // Arrange leaves from two different categories
      const partiallySelected = [A_HOME.id, B_HOME.id]

      // Act on the competition above both
      const result = toggleNodeSelection(CSMO, partiallySelected, mockTree)

      // Only the parent survives, since it already stands for both
      expect(result).toEqual([CSMO.id])
    })

    it('leaves selections outside the toggled branch alone', () => {
      // Arrange a selection belonging to a different competition
      const withOtherSelections = [MEMO_INDIVIDUAL.id]

      // Act on a competition that does not contain it
      const result = toggleNodeSelection(CSMO, withOtherSelections, mockTree)

      // The unrelated selection stays, and the toggled competition joins it
      expect(result).toContain(MEMO_INDIVIDUAL.id)
      expect(result).toContain(CSMO.id)
      expect(result).not.toContain(A_HOME.id)
    })

    it('drops the coverage of a parent that is deselected', () => {
      // Arrange a category as the selection
      const selectedIds = [CATEGORY_A.id]

      // Act on that category
      const nextSelected = toggleNodeSelection(CATEGORY_A, selectedIds, mockTree)

      // Neither the category nor anything under it is covered any more
      expect(nextSelected).not.toContain(CATEGORY_A.id)
      expect(isNodeEffectivelyChecked(CATEGORY_A.id, nextSelected, mockTree)).toBe(false)
      expect(isNodeEffectivelyChecked(A_HOME.id, nextSelected, mockTree)).toBe(false)
      expect(isNodeEffectivelyChecked(A_SCHOOL.id, nextSelected, mockTree)).toBe(false)
    })

    it('breaks a selected parent apart when one of its children is deselected', () => {
      // Arrange the parent category as the whole selection
      const selectedIds = [CATEGORY_A.id]

      // Act on one leaf beneath it
      const nextSelected = toggleNodeSelection(A_HOME, selectedIds, mockTree)

      // The parent gives way to the siblings that are still wanted
      expect(nextSelected).not.toContain(CATEGORY_A.id)
      expect(nextSelected).toContain(A_SCHOOL.id)
      expect(nextSelected).not.toContain(A_HOME.id)

      // And coverage now reflects exactly that
      expect(isNodeEffectivelyChecked(CATEGORY_A.id, nextSelected, mockTree)).toBe(false)
      expect(isNodeEffectivelyChecked(A_HOME.id, nextSelected, mockTree)).toBe(false)
      expect(isNodeEffectivelyChecked(A_SCHOOL.id, nextSelected, mockTree)).toBe(true)
    })

    it('breaks a selected grandparent apart down to its leaves', () => {
      // Arrange an entire competition as the selection
      const selectedIds = [CSMO.id]

      // Act on a single leaf three levels down
      const nextSelected = toggleNodeSelection(A_HOME, selectedIds, mockTree)

      // The competition is replaced by every leaf under it except the one turned off
      expect(nextSelected).not.toContain(CSMO.id)
      expect(nextSelected).not.toContain(A_HOME.id)
      expect(nextSelected).toEqual(
        expect.arrayContaining([A_SCHOOL.id, A_REGIONAL.id, B_HOME.id, B_SCHOOL.id])
      )

      // Coverage follows: everything but the deselected leaf survives
      expect(isNodeEffectivelyChecked(CSMO.id, nextSelected, mockTree)).toBe(false)
      expect(isNodeEffectivelyChecked(A_HOME.id, nextSelected, mockTree)).toBe(false)
      expect(isNodeEffectivelyChecked(A_SCHOOL.id, nextSelected, mockTree)).toBe(true)
      expect(isNodeEffectivelyChecked(B_HOME.id, nextSelected, mockTree)).toBe(true)
    })
  })

  describe('selection read back across levels', () => {
    it('covers a selected node’s entire subtree', () => {
      // Arrange a category as the selection
      const selectedIds = [CATEGORY_A.id]

      // Act across every id beneath it
      const coverage = getAllDescendantIds(CATEGORY_A).map((descendantId) =>
        isNodeEffectivelyChecked(descendantId, selectedIds, mockTree)
      )

      // Every leaf under the category is covered by the one entry
      expect(coverage).toEqual([true, true, true])
    })

    it('distinguishes a fully selected branch from a partly selected one', () => {
      // Arrange one whole category and a single leaf of another
      const selectedIds = [CATEGORY_A.id, B_HOME.id]

      // Act on the fully selected category
      const categoryAState = calculateParentState(CATEGORY_A, selectedIds)

      // Act on the partly selected one
      const categoryBState = calculateParentState(CATEGORY_B, selectedIds)

      // The whole branch reads checked, and its leaves with it
      expect(categoryAState).toBe('checked')
      expect(isNodeEffectivelyChecked(A_HOME.id, selectedIds, mockTree)).toBe(true)

      // The partial one reads mixed, with only its selected leaf covered
      expect(categoryBState).toBe('indeterminate')
      expect(isNodeEffectivelyChecked(B_HOME.id, selectedIds, mockTree)).toBe(true)
      expect(isNodeEffectivelyChecked(B_SCHOOL.id, selectedIds, mockTree)).toBe(false)
    })

    it('covers every level below a selected competition', () => {
      // Arrange the competition as the selection
      const selectedIds = [CSMO.id]

      // Act across both categories and all five rounds
      const coverage = [CATEGORY_A, CATEGORY_B, A_HOME, A_SCHOOL, A_REGIONAL, B_HOME, B_SCHOOL].map(
        (node) => isNodeEffectivelyChecked(node.id, selectedIds, mockTree)
      )

      // Both levels below the competition are covered without exception
      expect(coverage.every(Boolean)).toBe(true)
    })
  })

  describe('filterTreeBySearch', () => {
    it('returns the tree untouched and expands nothing for an empty term', () => {
      // Act on a term that is nothing but whitespace
      const result = filterTreeBySearch(mockTree, '   ')

      // The very same array comes back, so no node is needlessly recreated
      expect(result.tree).toBe(mockTree)
      expect(result.expandedIds.size).toBe(0)
    })

    it('keeps a matching leaf together with its ancestors', () => {
      // Act on a term only a third-level node carries
      const result = filterTreeBySearch(mockTree, 'krajské')

      // The chain down to the match survives, stripped of every non-matching sibling
      expect(result.tree).toHaveLength(1)
      expect(result.tree[0].id).toBe(CSMO.id)
      expect(result.tree[0].children).toHaveLength(1)
      expect(result.tree[0].children![0].children!.map((node) => node.id)).toEqual([A_REGIONAL.id])
    })

    it('reports every ancestor of a match as needing expansion', () => {
      // Act on the same deep match
      const result = filterTreeBySearch(mockTree, 'krajské')

      // Both levels above the match are named, so neither hides it behind a closed chevron
      expect([...result.expandedIds].sort()).toEqual([CSMO.id, CATEGORY_A.id])
    })

    it('drops the children of a node that matched on its own name', () => {
      // Act on a term the parent carries but none of its descendants do
      const result = filterTreeBySearch(mockTree, 'Matematická')

      // The parent stands alone, its children absent rather than empty, so it reads as a leaf
      expect(result.tree).toHaveLength(1)
      expect(result.tree[0].id).toBe(CSMO.id)
      expect(result.tree[0].children).toBeUndefined()
      expect(result.expandedIds.size).toBe(0)
    })

    it('matches on fullName as well as displayName', () => {
      // Arrange a node whose abbreviation is shown but whose full name is not
      const tree: TreeNode[] = [
        { id: 'imo', displayName: 'IMO', fullName: 'International Mathematical Olympiad' },
      ]

      // Act on a term appearing only in the full name
      const result = filterTreeBySearch(tree, 'international')

      // The node survives on a name that is never shown
      expect(result.tree.map((node) => node.id)).toEqual(['imo'])
    })

    it('drops branches with no match anywhere in them', () => {
      // Act on a term no node carries
      const result = filterTreeBySearch(mockTree, 'nothing matches this')

      // Nothing survives, and nothing is asked to be opened
      expect(result.tree).toEqual([])
      expect(result.expandedIds.size).toBe(0)
    })

    it('ignores case and diacritics alike', () => {
      // Act on the word miscased
      const withDiacritics = filterTreeBySearch(mockTree, 'DOMÁCE')

      // Act on it with its diacritics stripped
      const withoutDiacritics = filterTreeBySearch(mockTree, 'domace')

      // Both reach the same round, down the same path
      expect(withDiacritics.tree).toHaveLength(1)
      expect(withoutDiacritics.tree).toHaveLength(1)
      expect(withoutDiacritics.tree[0].children![0].children!.map((node) => node.id)).toEqual([
        A_HOME.id,
      ])
    })
  })

  describe('drawnRowIds', () => {
    it('draws the roots alone while every branch is closed', () => {
      // Act with nothing open
      const drawn = drawnRowIds(mockTree, new Set())

      // Only the two competitions have rows, whatever hangs beneath them
      expect(drawn).toEqual([CSMO.id, mockTree[1].id])
    })

    it('draws the children of an open branch directly under it', () => {
      // Act with one competition open and its categories still closed
      const drawn = drawnRowIds(mockTree, new Set([CSMO.id]))

      // Its categories come between it and the next root, in the order they are declared
      expect(drawn).toEqual([CSMO.id, CATEGORY_A.id, CATEGORY_B.id, mockTree[1].id])
    })

    it('follows a chain of open branches to the leaves', () => {
      // Act with a whole path down to the rounds open
      const drawn = drawnRowIds(mockTree, new Set([CSMO.id, CATEGORY_A.id]))

      // The open category's rounds are drawn, while the closed sibling stays a single row
      expect(drawn).toEqual([
        CSMO.id,
        CATEGORY_A.id,
        A_HOME.id,
        A_SCHOOL.id,
        A_REGIONAL.id,
        CATEGORY_B.id,
        mockTree[1].id,
      ])
    })

    it('draws a leaf marked open as the single row it is', () => {
      // Act with a childless node named among the open branches
      const drawn = drawnRowIds([MEMO_INDIVIDUAL], new Set([MEMO_INDIVIDUAL.id]))

      // Nothing hangs off it, so being open changes nothing
      expect(drawn).toEqual([MEMO_INDIVIDUAL.id])
    })
  })

  describe('expandableRowIds', () => {
    it('collects every branch at every depth, and no leaf', () => {
      // Act on the whole hierarchy
      const expandable = expandableRowIds(mockTree)

      // Both competitions and the two categories under one of them, the rounds being leaves
      expect(expandable).toEqual(new Set([CSMO.id, CATEGORY_A.id, CATEGORY_B.id, mockTree[1].id]))
    })

    it('leaves out a branch a search stripped its children from', () => {
      // A term matching one category by name, which nothing under it carries
      const { tree } = filterTreeBySearch(mockTree, 'B')

      // Act on what the search left standing
      const expandable = expandableRowIds(tree)

      // The category came through carrying nothing, so it has nothing left to open
      expect(expandable.has(CATEGORY_B.id)).toBe(false)

      // While the competition above it survives as the path down to the match
      expect(expandable.has(CSMO.id)).toBe(true)
    })
  })
})
