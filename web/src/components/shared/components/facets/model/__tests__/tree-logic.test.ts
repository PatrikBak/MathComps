import { describe, expect, it } from 'vitest'

import type { TreeNode } from '../facet-types'
import {
  calculateParentState,
  drawnTreeRows,
  filterTreeBySearch,
  isNodeEffectivelyChecked,
  toggleNodeSelection,
  treeCheckState,
  treeRowsStandingForSelection,
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
  describe('isNodeEffectivelyChecked', () => {
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

  describe('treeCheckState', () => {
    it('reads a node under a picked branch as checked, though nothing in its own subtree is picked', () => {
      // Act on a category of a competition picked whole
      const state = treeCheckState(CATEGORY_A, [CSMO.id], mockTree)

      // Checked, the competition above it outranking the subtree
      expect(state).toBe('checked')
    })

    it('reads a branch nothing above covers as its subtree does', () => {
      // Act on a category with one of its rounds picked
      const state = treeCheckState(CATEGORY_A, [A_HOME.id], mockTree)

      // Part-picked, from the round beneath it
      expect(state).toBe('indeterminate')
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

    it('breaks a selected parent apart around a whole branch turned off inside it', () => {
      // Arrange an entire competition as the selection
      const selectedIds = [CSMO.id]

      // Act on one of its categories
      const nextSelected = toggleNodeSelection(CATEGORY_A, selectedIds, mockTree)

      // The competition gives way to the other category's rounds alone
      expect(nextSelected).toHaveLength(2)
      expect(nextSelected).toEqual(expect.arrayContaining([B_HOME.id, B_SCHOOL.id]))

      // Coverage follows: the category and its rounds are off, the rest still on
      expect(isNodeEffectivelyChecked(CATEGORY_A.id, nextSelected, mockTree)).toBe(false)
      expect(isNodeEffectivelyChecked(A_HOME.id, nextSelected, mockTree)).toBe(false)
      expect(isNodeEffectivelyChecked(B_SCHOOL.id, nextSelected, mockTree)).toBe(true)
    })

    it('keeps the picks outside a selected ancestor while breaking it apart', () => {
      // Arrange a whole competition beside a round of another
      const selectedIds = [CSMO.id, MEMO_INDIVIDUAL.id]

      // Act on one round inside the competition
      const nextSelected = toggleNodeSelection(A_HOME, selectedIds, mockTree)

      // The other competition's round stays picked
      expect(nextSelected).toContain(MEMO_INDIVIDUAL.id)
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

    it('opens a node matching on its own name that keeps matches beneath it too', () => {
      // Act on a term the competition carries, as do some of the rounds beneath it
      const result = filterTreeBySearch(mockTree, 'a')

      // The competition is opened to show the matches under it
      expect(result.expandedIds.has(CSMO.id)).toBe(true)
    })

    it('drops branches with no match anywhere in them', () => {
      // Act on a term no node carries
      const result = filterTreeBySearch(mockTree, 'nothing matches this')

      // Nothing survives, and nothing is asked to be opened
      expect(result.tree).toEqual([])
      expect(result.expandedIds.size).toBe(0)
    })
  })

  describe('drawnTreeRows', () => {
    it('places each row at its depth among the siblings drawn beside it, saying whether it stands open', () => {
      // Act with a whole path down to the rounds open
      const drawn = drawnTreeRows(mockTree, new Set([CSMO.id, CATEGORY_A.id]))

      // Each row's depth, its place among its siblings, how many there are, and whether it stands open
      expect(
        drawn.map(({ node, level, positionInSet, setSize, expanded }) => [
          node.id,
          level,
          positionInSet,
          setSize,
          expanded,
        ])
      ).toEqual([
        [CSMO.id, 0, 1, 2, true],
        [CATEGORY_A.id, 1, 1, 2, true],
        [A_HOME.id, 2, 1, 3, undefined],
        [A_SCHOOL.id, 2, 2, 3, undefined],
        [A_REGIONAL.id, 2, 3, 3, undefined],
        [CATEGORY_B.id, 1, 2, 2, false],
        [mockTree[1].id, 0, 2, 2, false],
      ])
    })

    it('draws a leaf marked open as the single row it is, with nothing to open', () => {
      // Act with a childless node named among the open branches
      const drawn = drawnTreeRows([MEMO_INDIVIDUAL], new Set([MEMO_INDIVIDUAL.id]))

      // Nothing hangs off it, so being open changes nothing
      expect(drawn).toEqual([
        { node: MEMO_INDIVIDUAL, level: 0, positionInSet: 1, setSize: 1, expanded: undefined },
      ])
    })

    it('leaves a branch a search stripped its children from with nothing to open', () => {
      // A term matching one category by name, which nothing under it carries
      const { tree, expandedIds } = filterTreeBySearch(mockTree, 'B')

      // Act on what the search left standing, opened the way the search opens it
      const drawn = drawnTreeRows(tree, expandedIds)

      // The competition stands open over the match, while the category came through with nothing to open
      expect(drawn.map(({ node, expanded }) => [node.id, expanded])).toEqual([
        [CSMO.id, true],
        [CATEGORY_B.id, undefined],
      ])
    })
  })

  describe('treeRowsStandingForSelection', () => {
    it('stands the closed branch hiding a pick in for it, and no open one', () => {
      // Act on a round picked under a closed category of an open competition, beside a pick drawn in the open
      const standing = treeRowsStandingForSelection(
        [A_HOME.id, MEMO_INDIVIDUAL.id],
        drawnTreeRows(mockTree, new Set([CSMO.id, mockTree[1].id])),
        mockTree
      )

      // Each pick, and the closed category hiding the first, while the open competitions above stand for nothing
      expect(standing).toEqual([A_HOME.id, CATEGORY_A.id, MEMO_INDIVIDUAL.id])
    })

    it('stands a branch a search drew without its children in for a pick under it', () => {
      // A term matching one category by name
      const { tree, expandedIds } = filterTreeBySearch(mockTree, 'B')

      // Act on a round picked under that category, with the category open beside what the search opens
      const standing = treeRowsStandingForSelection(
        [B_HOME.id],
        drawnTreeRows(tree, new Set([...expandedIds, CATEGORY_B.id])),
        mockTree
      )

      // The category, the nearest the search draws to the round, stands in for it
      expect(standing).toEqual([B_HOME.id, CATEGORY_B.id])
    })

    it('stands an open branch in for a pick a search drew that branch without', () => {
      // A term matching MEMO's team round alone, which draws MEMO open over that round
      const { tree, expandedIds } = filterTreeBySearch(mockTree, 'Tímová')

      // Act on the round the search passes over, with the rows the search draws
      const standing = treeRowsStandingForSelection(
        [MEMO_INDIVIDUAL.id],
        drawnTreeRows(tree, expandedIds),
        mockTree
      )

      // MEMO, open though it is, stands in for the round the search left off
      expect(standing).toEqual([MEMO_INDIVIDUAL.id, mockTree[1].id])
    })
  })
})
