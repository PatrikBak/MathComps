// The chips the active-filter bar shows for the competition filter. The folding they are built on is
// pinned against the live taxonomy in contest-equivalence.test.ts and exercised at depth in
// contest-selection-fold.test.ts, the order it reports in included, so what is left here is how the chips
// read and what a click does.

import type * as React from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { ContestSelection, SearchFiltersState } from '../types/problem-library-types'
import { generateCompetitionChips } from '../utils/competition-chips'
import { DEEP_TAXONOMY, makeContestTree } from './contest-tree-fixture'

/** The taxonomy the chips are folded and named against, five levels at its deepest. */
const tree = makeContestTree(DEEP_TAXONOMY)

/**
 * Builds filters carrying nothing but the given contest selections.
 *
 * @param paths - The paths filtered on.
 * @returns The filter state.
 */
function filtersWith(paths: string[]): SearchFiltersState {
  // The contests filtered on, with every other filter left where it starts
  return {
    searchText: '',
    searchInSolution: false,
    seasons: [],
    problemNumbers: [],
    tags: [],
    tagLogic: 'or',
    authors: [],
    authorLogic: 'or',
    contestSelection: paths.map((path) => ({ path })),
    favoritesOnly: false,
    markStatus: null,
    listContentId: null,
  }
}

/** A plain left click, carrying neither modifier. */
const PLAIN_CLICK = { ctrlKey: false, metaKey: false } as React.MouseEvent

/** A click asking for the filter to be narrowed to one chip. */
const EXCLUSIVE_CLICK = { ctrlKey: true, metaKey: false } as React.MouseEvent

describe('which chips are shown', () => {
  it('shows nothing when no competition is filtered on', () => {
    // Nothing to stand for, so no chip stands for it
    expect(generateCompetitionChips(filtersWith([]), tree, () => {})).toEqual([])
  })

  it('shows one chip per node, labelled with every level above it', () => {
    // A node four levels down, whose own name says nothing about where it sits
    const filters = filtersWith(['mo-a-i-navodne'])

    // The chips that node produces
    const chips = generateCompetitionChips(filters, tree, () => {})

    // One chip, reading under the whole branch above it
    expect(chips).toHaveLength(1)
    expect(chips[0].id).toBe('mo-a-i-navodne')
    expect(chips[0].displayName).toBe('MO - A - I - NAVODNE')
  })

  it('folds a complete set of siblings into the one chip that covers them', () => {
    // Both subrounds of a round, which between them are everything it holds
    const filters = filtersWith(['mo-a-i-navodne-x', 'mo-a-i-navodne-y'])

    // The chips the pair produces
    const chips = generateCompetitionChips(filters, tree, () => {})

    // The round above them, rather than one chip apiece
    expect(chips.map((chip) => chip.id)).toEqual(['mo-a-i-navodne'])
  })

  it('drops a selection naming a node the taxonomy no longer holds', () => {
    // A stale filter alongside a live one
    const filters = filtersWith(['ghost', 'flat'])

    // The chips the two of them produce
    const chips = generateCompetitionChips(filters, tree, () => {})

    // Only the one the taxonomy still holds
    expect(chips.map((chip) => chip.id)).toEqual(['flat'])
  })

  it('reads the tree top to bottom, whatever order the filters hold', () => {
    // Filters written from the last root backwards
    const filters = filtersWith(['flat', 'mid-t', 'mo-a-ii'])

    // The chips they produce
    const chips = generateCompetitionChips(filters, tree, () => {})

    // Handed back in the tree's own order rather than the filters'
    expect(chips.map((chip) => chip.id)).toEqual(['mo-a-ii', 'mid-t', 'flat'])
  })
})

describe('clicking a chip', () => {
  it('drops what the chip stands for and leaves the rest', () => {
    // Where the filter state a click produces lands
    const onFiltersChange = vi.fn()

    // Two unrelated filters, one of which is about to go
    const chips = generateCompetitionChips(filtersWith(['mo-a-ii', 'flat']), tree, onFiltersChange)

    // The first chip clicked without any modifier
    chips[0].onClick(PLAIN_CLICK)

    // Only the other filter survives
    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    expect(
      onFiltersChange.mock.calls[0][0].contestSelection.map(
        (selection: ContestSelection) => selection.path
      )
    ).toEqual(['flat'])
  })

  it('drops the whole subtree the chip stands for, however it came to stand for it', () => {
    // Where the filter state a click produces lands
    const onFiltersChange = vi.fn()

    // A chip folded up out of its children, so the filters hold the children rather than the chip
    const chips = generateCompetitionChips(
      filtersWith(['mo-a-i-navodne-x', 'mo-a-i-navodne-y', 'flat']),
      tree,
      onFiltersChange
    )

    // The folded chip clicked, which has to take both children with it
    chips[0].onClick(PLAIN_CLICK)

    // Nothing under it is left behind to keep the chip alive
    expect(
      onFiltersChange.mock.calls[0][0].contestSelection.map(
        (selection: ContestSelection) => selection.path
      )
    ).toEqual(['flat'])
  })

  it('leaves a sibling alone whose slug merely extends the one clicked', () => {
    // Two competitions whose slugs share a prefix, which the taxonomy is full of
    const prefixTree = makeContestTree([{ slug: 'tst' }, { slug: 'tstc' }])

    // Where the filter state a click produces lands
    const onFiltersChange = vi.fn()

    // Both of them filtered on at once
    const chips = generateCompetitionChips(
      filtersWith(['tst', 'tstc']),
      prefixTree,
      onFiltersChange
    )

    // The shorter of the two clicked
    chips[0].onClick(PLAIN_CLICK)

    // The longer one is a competition in its own right rather than something below the one dropped
    expect(
      onFiltersChange.mock.calls[0][0].contestSelection.map(
        (selection: ContestSelection) => selection.path
      )
    ).toEqual(['tstc'])
  })

  it('narrows the whole competition filter to one chip under the modifier', () => {
    // Where the filter state a click produces lands
    const onFiltersChange = vi.fn()

    // Three filters, of which the modifier will keep exactly one
    const chips = generateCompetitionChips(
      filtersWith(['mo-a-ii', 'mid-t', 'flat']),
      tree,
      onFiltersChange
    )

    // The middle chip, ctrl-clicked
    chips[1].onClick(EXCLUSIVE_CLICK)

    // Everything else goes, including the filters that were not part of this chip
    expect(
      onFiltersChange.mock.calls[0][0].contestSelection.map(
        (selection: ContestSelection) => selection.path
      )
    ).toEqual(['mid-t'])
  })

  it('leaves the search term alone', () => {
    // Where the filter state a click produces lands
    const onFiltersChange = vi.fn()

    // A search term riding alongside the competition filter
    const filters = { ...filtersWith(['flat']), searchText: 'algebra' }

    // The only chip there is, clicked away
    generateCompetitionChips(filters, tree, onFiltersChange)[0].onClick(PLAIN_CLICK)

    // The term comes back exactly as it went in
    expect(onFiltersChange.mock.calls[0][0].searchText).toBe('algebra')
  })
})
