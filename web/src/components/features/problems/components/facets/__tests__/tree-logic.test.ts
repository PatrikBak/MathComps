import { describe, expect, it } from 'vitest'

import {
  calculateParentState,
  getAllAncestorIds,
  getAllDescendantIds,
  isNodeEffectivelyChecked,
  toggleNodeSelection,
  type TreeNode,
} from '../utils/tree-logic'

// Mock tree structure representing competition hierarchy
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

describe('Tree Logic Utilities', () => {
  describe('getAllDescendantIds', () => {
    it('gets all descendant IDs without including the node itself', () => {
      const categoryA = mockTree[0].children![0]
      const descendants = getAllDescendantIds(categoryA)

      expect(descendants).toEqual([
        'competition/csmo/category/a/round/i',
        'competition/csmo/category/a/round/s',
        'competition/csmo/category/a/round/k',
      ])
    })

    it('gets all descendant IDs including the node itself when requested', () => {
      const categoryA = mockTree[0].children![0]
      const descendants = getAllDescendantIds(categoryA, true)

      expect(descendants).toEqual([
        'competition/csmo/category/a',
        'competition/csmo/category/a/round/i',
        'competition/csmo/category/a/round/s',
        'competition/csmo/category/a/round/k',
      ])
    })

    it('returns empty array for leaf nodes', () => {
      const leafNode = mockTree[0].children![0].children![0]
      const descendants = getAllDescendantIds(leafNode)

      expect(descendants).toEqual([])
    })
  })

  describe('getAllAncestorIds', () => {
    it('gets all ancestor IDs for a deep node', () => {
      const ancestors = getAllAncestorIds('competition/csmo/category/a/round/i', mockTree)

      expect(ancestors).toEqual(['competition/csmo', 'competition/csmo/category/a'])
    })

    it('gets ancestor for a mid-level node', () => {
      const ancestors = getAllAncestorIds('competition/csmo/category/a', mockTree)

      expect(ancestors).toEqual(['competition/csmo'])
    })

    it('returns empty array for root nodes', () => {
      const ancestors = getAllAncestorIds('competition/csmo', mockTree)

      expect(ancestors).toEqual([])
    })

    it('returns empty array for non-existent nodes', () => {
      const ancestors = getAllAncestorIds('competition/nonexistent', mockTree)

      expect(ancestors).toEqual([])
    })
  })

  describe('isNodeEffectivelyChecked', () => {
    it('returns true for directly selected nodes', () => {
      const selectedIds = ['competition/csmo/category/a/round/i']

      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/i', selectedIds, mockTree)
      ).toBe(true)
    })

    it('returns true for children when parent is selected (propagation down)', () => {
      const selectedIds = ['competition/csmo/category/a'] // Category A selected

      // All children should be effectively checked
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/i', selectedIds, mockTree)
      ).toBe(true)
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/s', selectedIds, mockTree)
      ).toBe(true)
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/k', selectedIds, mockTree)
      ).toBe(true)

      // But children of other categories should not be checked
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/b/round/i', selectedIds, mockTree)
      ).toBe(false)
    })

    it('returns true for children when grandparent is selected (deep propagation)', () => {
      const selectedIds = ['competition/csmo'] // Entire competition selected

      // All descendants should be effectively checked
      expect(isNodeEffectivelyChecked('competition/csmo/category/a', selectedIds, mockTree)).toBe(
        true
      )
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/i', selectedIds, mockTree)
      ).toBe(true)
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/b/round/s', selectedIds, mockTree)
      ).toBe(true)

      // But other competitions should not be affected
      expect(isNodeEffectivelyChecked('competition/memo/round/i', selectedIds, mockTree)).toBe(
        false
      )
    })

    it('returns false for unrelated nodes', () => {
      const selectedIds = ['competition/csmo/category/a']

      expect(isNodeEffectivelyChecked('competition/memo/round/i', selectedIds, mockTree)).toBe(
        false
      )
    })
  })

  describe('calculateParentState', () => {
    it('returns checked when node is explicitly selected', () => {
      const selectedIds = ['competition/csmo/category/a']
      const categoryA = mockTree[0].children![0]

      expect(calculateParentState(categoryA, selectedIds)).toBe('checked')
    })

    it('returns checked when all children are selected (propagation up)', () => {
      const selectedIds = [
        'competition/csmo/category/a/round/i',
        'competition/csmo/category/a/round/s',
        'competition/csmo/category/a/round/k',
      ]
      const categoryA = mockTree[0].children![0]

      expect(calculateParentState(categoryA, selectedIds)).toBe('checked')
    })

    it('returns indeterminate when some but not all children are selected', () => {
      const selectedIds = [
        'competition/csmo/category/a/round/i',
        'competition/csmo/category/a/round/s',
        // Missing 'competition/csmo/category/a/round/k'
      ]
      const categoryA = mockTree[0].children![0]

      expect(calculateParentState(categoryA, selectedIds)).toBe('indeterminate')
    })

    it('returns unchecked when no children are selected and node not explicitly selected', () => {
      const selectedIds = ['competition/memo/round/i'] // Something unrelated
      const categoryA = mockTree[0].children![0]

      expect(calculateParentState(categoryA, selectedIds)).toBe('unchecked')
    })

    it('handles leaf nodes correctly', () => {
      const selectedIds = ['competition/csmo/category/a/round/i']
      const leafNode = mockTree[0].children![0].children![0]

      expect(calculateParentState(leafNode, selectedIds)).toBe('checked')

      const unselectedLeaf = mockTree[0].children![0].children![1]
      expect(calculateParentState(unselectedLeaf, selectedIds)).toBe('unchecked')
    })
  })

  describe('toggleNodeSelection - Parent Selection Logic', () => {
    it('should select parent explicitly (not individual descendants)', () => {
      const competition = mockTree[0]

      // When nothing is selected, clicking competition should select it (not descendants)
      const selectParent = toggleNodeSelection(competition, [], mockTree)
      expect(selectParent).toEqual(['competition/csmo'])

      // When competition is selected, clicking it should deselect it
      const deselectParent = toggleNodeSelection(competition, selectParent, mockTree)
      expect(deselectParent).toEqual([])
    })

    it('should replace individual descendants with parent selection', () => {
      const competition = mockTree[0]

      // Start with some individual descendants selected
      const partiallySelected = [
        'competition/csmo/category/a/round/i',
        'competition/csmo/category/b/round/i',
      ] // Some children from different categories

      // Clicking competition should replace them with parent selection
      const result = toggleNodeSelection(competition, partiallySelected, mockTree)
      expect(result).toEqual(['competition/csmo'])

      // The descendants should no longer be explicitly selected
      expect(result).not.toContain('competition/csmo/category/a/round/i')
      expect(result).not.toContain('competition/csmo/category/b/round/i')
    })

    it('should preserve unrelated selections during parent operations', () => {
      const competition = mockTree[0]

      // Start with selections from a different competition
      const withOtherSelections = ['competition/memo/round/i'] // From memo
      const result = toggleNodeSelection(competition, withOtherSelections, mockTree)

      // Should preserve memo selection and add csmo parent selection
      expect(result).toContain('competition/memo/round/i') // Preserved from memo
      expect(result).toContain('competition/csmo') // Added as parent selection
      expect(result).not.toContain('competition/csmo/category/a/round/i') // Not individual descendants
    })
  })

  describe('Parent-Child Selection Integration', () => {
    it('ensures parent selection implies all children are effectively checked', () => {
      // When category A is selected
      const selectedIds = ['competition/csmo/category/a']

      // The category itself should be checked
      expect(isNodeEffectivelyChecked('competition/csmo/category/a', selectedIds, mockTree)).toBe(
        true
      )

      // All its children should be effectively checked (propagation down)
      const categoryA = mockTree[0].children![0]
      const allChildren = getAllDescendantIds(categoryA)

      for (const childId of allChildren) {
        expect(isNodeEffectivelyChecked(childId, selectedIds, mockTree)).toBe(true)
      }
    })

    it('ensures all children selected implies parent should be checked (propagation up)', () => {
      // When all children of category A are individually selected
      const selectedIds = [
        'competition/csmo/category/a/round/i',
        'competition/csmo/category/a/round/s',
        'competition/csmo/category/a/round/k',
      ]

      const categoryA = mockTree[0].children![0]

      // The parent should show as checked (all children selected)
      expect(calculateParentState(categoryA, selectedIds)).toBe('checked')
    })

    it('handles mixed selection levels correctly', () => {
      const selectedIds = [
        'competition/csmo/category/a', // Entire category A
        'competition/csmo/category/b/round/i', // Only one round from category B
      ]

      const categoryA = mockTree[0].children![0]
      const categoryB = mockTree[0].children![1]

      // Category A should be checked (explicitly selected)
      expect(calculateParentState(categoryA, selectedIds)).toBe('checked')
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/i', selectedIds, mockTree)
      ).toBe(true)

      // Category B should be indeterminate (partial selection)
      expect(calculateParentState(categoryB, selectedIds)).toBe('indeterminate')
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/b/round/i', selectedIds, mockTree)
      ).toBe(true)
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/b/round/s', selectedIds, mockTree)
      ).toBe(false)
    })

    it('ensures competition-level selection propagates to all descendants', () => {
      const selectedIds = ['competition/csmo'] // Entire competition

      // All categories should be effectively checked
      expect(isNodeEffectivelyChecked('competition/csmo/category/a', selectedIds, mockTree)).toBe(
        true
      )
      expect(isNodeEffectivelyChecked('competition/csmo/category/b', selectedIds, mockTree)).toBe(
        true
      )

      // All rounds should be effectively checked
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/i', selectedIds, mockTree)
      ).toBe(true)
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/s', selectedIds, mockTree)
      ).toBe(true)
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/k', selectedIds, mockTree)
      ).toBe(true)
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/b/round/i', selectedIds, mockTree)
      ).toBe(true)
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/b/round/s', selectedIds, mockTree)
      ).toBe(true)
    })

    it('allows deselection of explicitly selected parents', () => {
      // Start with category A selected
      let selectedIds = ['competition/csmo/category/a']

      // Children should appear checked
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/i', selectedIds, mockTree)
      ).toBe(true)
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/s', selectedIds, mockTree)
      ).toBe(true)

      // Simulate clicking on category A to deselect it
      const categoryA = mockTree[0].children![0]
      const nextSelected = toggleNodeSelection(categoryA, selectedIds, mockTree)

      // Category A should be deselected, children should no longer appear checked
      expect(nextSelected).not.toContain('competition/csmo/category/a')
      expect(isNodeEffectivelyChecked('competition/csmo/category/a', nextSelected, mockTree)).toBe(
        false
      )
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/i', nextSelected, mockTree)
      ).toBe(false)
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/s', nextSelected, mockTree)
      ).toBe(false)
    })

    it('allows child deselection when parent is explicitly selected (the reported bug)', () => {
      // Start with parent category A selected
      let selectedIds = ['competition/csmo/category/a']

      // All children should appear checked due to parent selection
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/i', selectedIds, mockTree)
      ).toBe(true)
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/s', selectedIds, mockTree)
      ).toBe(true)

      // Now click on round i to deselect just that child
      const roundI = mockTree[0].children![0].children![0] // round i node
      const nextSelected = toggleNodeSelection(roundI, selectedIds, mockTree)

      // The parent should no longer be explicitly selected
      expect(nextSelected).not.toContain('competition/csmo/category/a')

      // Only round s should remain selected (round i was deselected)
      expect(nextSelected).toContain('competition/csmo/category/a/round/s')
      expect(nextSelected).not.toContain('competition/csmo/category/a/round/i')

      // Verify the effective checked states
      expect(isNodeEffectivelyChecked('competition/csmo/category/a', nextSelected, mockTree)).toBe(
        false
      ) // Parent no longer fully selected
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/i', nextSelected, mockTree)
      ).toBe(false) // This was deselected
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/s', nextSelected, mockTree)
      ).toBe(true) // This remains selected
    })

    it('allows grandchild deselection when grandparent competition is selected', () => {
      // Start with entire competition selected
      let selectedIds = ['competition/csmo']

      // All descendants should appear checked due to grandparent selection
      expect(isNodeEffectivelyChecked('competition/csmo/category/a', selectedIds, mockTree)).toBe(
        true
      )
      expect(isNodeEffectivelyChecked('competition/csmo/category/b', selectedIds, mockTree)).toBe(
        true
      )
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/i', selectedIds, mockTree)
      ).toBe(true)
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/s', selectedIds, mockTree)
      ).toBe(true)
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/b/round/i', selectedIds, mockTree)
      ).toBe(true)
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/b/round/s', selectedIds, mockTree)
      ).toBe(true)

      // Now click on round i from category A to deselect just that child
      const roundI = mockTree[0].children![0].children![0] // round i node
      const nextSelected = toggleNodeSelection(roundI, selectedIds, mockTree)

      // The grandparent competition should no longer be explicitly selected
      expect(nextSelected).not.toContain('competition/csmo')

      // All other rounds should remain selected (round i was deselected)
      expect(nextSelected).toContain('competition/csmo/category/a/round/s') // Other round from cat A
      expect(nextSelected).toContain('competition/csmo/category/b/round/i') // Round from cat B
      expect(nextSelected).toContain('competition/csmo/category/b/round/s') // Round from cat B
      expect(nextSelected).not.toContain('competition/csmo/category/a/round/i') // This was deselected

      // Verify the effective checked states
      expect(isNodeEffectivelyChecked('competition/csmo', nextSelected, mockTree)).toBe(false) // Competition no longer fully selected
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/i', nextSelected, mockTree)
      ).toBe(false) // This was deselected
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/a/round/s', nextSelected, mockTree)
      ).toBe(true) // This remains selected
      expect(
        isNodeEffectivelyChecked('competition/csmo/category/b/round/i', nextSelected, mockTree)
      ).toBe(true) // This remains selected
    })
  })
})
