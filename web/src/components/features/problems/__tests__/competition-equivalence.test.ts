// Pins the depth-agnostic competition code against a golden capture of the three-level behaviour, taken
// over a corpus from the live taxonomy. The capture addresses a node by the
// `competition/<c>/category/<cat>` grammar, so its ids are read as paths before anything is compared.
//
// The two taxonomy fixtures hold that same corpus in the tree shape the API sends, value for value,
// so what is compared here is the code and never the data underneath it.

import { describe, expect, it } from 'vitest'

import type { CompetitionNodeOption } from '../types/problem-api-types'
import { foldPickedPaths } from '../utils/competition-selection-fold'
import { buildCompetitionTree, expandedByDefault, toFacetNodes } from '../utils/competition-tree'
import { serializeFilters } from '../utils/search-url-serialization'
import {
  createDefaultFilters,
  initializeFiltersFromUrlOrDefaults,
} from '../utils/url-initialization'
import goldenFixture from './fixtures/competition-golden.json'
import taxonomyFixture from './fixtures/competition-taxonomy.json'
import filteredTaxonomyFixture from './fixtures/competition-taxonomy-filtered.json'

/** The whole live taxonomy, which decides which nodes exist and how they are ordered. */
const competitions = taxonomyFixture as unknown as CompetitionNodeOption[]

/**
 * The same taxonomy narrowed to one edition, which drops some competitions outright and empties
 * others.
 */
const filteredCompetitions = filteredTaxonomyFixture as unknown as CompetitionNodeOption[]

/** One node as the golden capture holds it. */
type GoldenNode = {
  /** The node's id in the capture's own grammar, e.g. `competition/csmo/category/a`. */
  id: string
  /** The node's own label, which is what its row reads. */
  displayName: string
  /** The node's own name in full, absent where its label already says all of it. */
  fullName?: string
  /** How many problems sat under it. */
  count: number
  /** The nodes one level below, absent at a leaf. */
  children?: GoldenNode[]
}

/**
 * The part of a captured selection the comparison reads, which is the three levels the backend names a
 * competition by.
 */
type GoldenSelection = {
  /** The competition the selection sits under. */
  competitionSlug: string
  /** The category, absent for a selection reaching no further than its competition. */
  categorySlug?: string
  /** The round, absent for a selection above the round level. */
  roundSlug?: string
}

/** The taxonomy as the capture holds it. */
type GoldenTree = {
  /** The whole hierarchy, every node counting everything under it. */
  unfiltered: GoldenNode[]
  /** The same hierarchy with counts taken from the payload narrowed to one edition. */
  yearFiltered: GoldenNode[]
  /** The ids of the branches that start out open. */
  defaultExpandedIds: string[]
}

/** One set of picked nodes and the covering selection it folds to. */
type GoldenFoldCase = {
  /** What the case is called, which is also what its test reads under. */
  label: string
  /** The ids picked in their own right. */
  ids: string[]
  /** The nodes the picks fold to, in the order they came out. */
  selections: GoldenSelection[]
}

/** One `competitions=` value and what reading it produced. */
type GoldenUrlCase = {
  /** The value as it appeared in the query string. */
  value: string
  /** Whether the URL was rejected outright. */
  hasInvalidParams: boolean
  /** The competitions the URL filtered on. */
  competitionSelection: GoldenSelection[]
  /** The query string the resulting filters serialise back to. */
  reserialized: string
}

/** The part of the golden capture these tests read. */
type GoldenCapture = {
  /** Every path in the taxonomy, at every depth. */
  allPaths: string[]
  /** The taxonomy, per {@link GoldenTree}. */
  tree: GoldenTree
  /** Every fold case, per {@link GoldenFoldCase}. */
  fold: GoldenFoldCase[]
  /** Every URL case, per {@link GoldenUrlCase}. */
  url: GoldenUrlCase[]
}

/** Everything the cases here are pinned against. */
const golden = goldenFixture as unknown as GoldenCapture

/**
 * Reads a captured node id as the path addressing the same node, by keeping the slugs and dropping the
 * level names that sat between them.
 *
 * @param id - The captured id, e.g. `competition/csmo/category/a/round/i`.
 * @returns The path, e.g. `csmo-a-i`.
 */
function idToPath(id: string): string {
  // The slugs sit at the odd positions, the level names at the even ones
  return id
    .split('/')
    .filter((segment, index) => index % 2 === 1)
    .join('-')
}

/**
 * Reads a captured selection as the path addressing the same node.
 *
 * @param selection - The captured selection.
 * @returns Its path.
 */
function selectionToPath(selection: GoldenSelection): string {
  // The levels the selection reaches, in order, with the ones it stops short of left out
  return [selection.competitionSlug, selection.categorySlug, selection.roundSlug]
    .filter((slug): slug is string => slug != null)
    .join('-')
}

/**
 * Restates a captured node with its id normalised to a path, so it can be compared to a built one.
 *
 * @param nodes - The captured nodes.
 * @returns The same nodes, addressed by path.
 */
function normaliseNodes(nodes: GoldenNode[]): GoldenNode[] {
  // Every level is normalised, since ids repeat the grammar all the way down
  return nodes.map((node) => ({
    ...node,
    id: idToPath(node.id),
    children: node.children ? normaliseNodes(node.children) : undefined,
  }))
}

describe('the taxonomy tree', () => {
  it('is built exactly as the three-level builder built it', () => {
    // The tree over the whole hierarchy, where every node counts everything under it
    const tree = buildCompetitionTree(competitions, competitions)

    // The facet-facing shape, which is what the capture holds
    const facetNodes = toFacetNodes(tree.roots)

    // Identical down to the leaves, once the capture's ids are read as paths
    expect(facetNodes).toEqual(normaliseNodes(golden.tree.unfiltered))
  })

  it('takes counts from the filtered hierarchy and everything else from the whole one', () => {
    // The tree built with its counts taken from the narrowed payload
    const tree = buildCompetitionTree(competitions, filteredCompetitions)

    // The nodes that dropped out still stand, reading zero
    expect(toFacetNodes(tree.roots)).toEqual(normaliseNodes(golden.tree.yearFiltered))
  })

  it('opens the same branches by default', () => {
    // The tree the expansion is taken from
    const tree = buildCompetitionTree(competitions, competitions)

    // Every competition and every category, and no round, exactly as the capture holds
    expect(expandedByDefault(tree)).toEqual(golden.tree.defaultExpandedIds.map(idToPath))
  })
})

/**
 * The fold cases the capture disagrees with, mapped to what they are expected to produce. The capture
 * recorded selections in the order they were picked, grouped by competition, so the same filter
 * serialised differently depending on the order it was clicked in. The fold emits tree order, which
 * makes a URL canonical and matches the order the chips render in.
 */
const APPROVED_ORDER_DEVIATIONS: Record<string, string[]> = {
  crossCompetitionMix: ['csmo-a', 'csmo-b-i', 'memo-t', 'imo'],
}

describe('folding picked nodes', () => {
  // Every fold case the capture holds
  for (const goldenCase of golden.fold) {
    it(`folds ${goldenCase.label} as before`, () => {
      // The tree the fold measures completeness against
      const tree = buildCompetitionTree(competitions, competitions)

      // The same picked nodes, addressed by path
      const folded = foldPickedPaths(goldenCase.ids.map(idToPath), tree)

      // What the capture recorded, unless this case is one of the approved order changes
      const expected =
        APPROVED_ORDER_DEVIATIONS[goldenCase.label] ?? goldenCase.selections.map(selectionToPath)

      // The same covering nodes, in the same order, which is also the whole of what a selection
      // sends the backend
      expect(folded.map((node) => node.path)).toEqual(expected)
    })
  }

  it('covers the same nodes as before in the cases whose order changed', () => {
    // The tree the fold measures completeness against
    const tree = buildCompetitionTree(competitions, competitions)

    // The cases the loop above compares against a hand-written expectation rather than the capture
    const deviatingCases = golden.fold.filter(
      (goldenCase) => goldenCase.label in APPROVED_ORDER_DEVIATIONS
    )

    // Each of them has to be a pure reorder of what the capture recorded
    for (const goldenCase of deviatingCases) {
      // The same picked nodes, addressed by path
      const folded = foldPickedPaths(goldenCase.ids.map(idToPath), tree)

      // The same covering nodes, whatever order each side reports them in
      expect(folded.map((node) => node.path).sort()).toEqual(
        goldenCase.selections.map(selectionToPath).sort()
      )
    }
  })
})

/**
 * The `competitions=` values the capture disagrees with, all of which read as a broken URL. The capture
 * decided whether an unresolvable token broke the URL from how many segments it had: one or four or
 * more were dropped in silence, two or three reset every filter. One rule applies at every depth here,
 * since a segment-count rule cannot survive a taxonomy deeper than three levels.
 */
const APPROVED_URL_DEVIATIONS = new Set(['ghost', 'ghost,imo', 'csmo-a-i-extra'])

describe('reading filters back out of a URL', () => {
  // Every `competitions=` value the capture holds
  for (const goldenCase of golden.url) {
    it(`reads competitions=${goldenCase.value || '(empty)'} as before`, () => {
      // The taxonomy the paths are resolved against
      const tree = buildCompetitionTree(competitions, competitions)

      // The whole URL pipeline, from query string to filter state
      const result = initializeFiltersFromUrlOrDefaults(
        new URLSearchParams(`competitions=${goldenCase.value}`),
        tree
      )

      // An approved deviation reads as a broken URL, whatever the capture recorded
      const expectInvalid =
        APPROVED_URL_DEVIATIONS.has(goldenCase.value) || goldenCase.hasInvalidParams

      // Whether the URL was understood at all
      expect(result.hasInvalidParams).toBe(expectInvalid)

      // A broken URL falls back to no filters, whichever way it broke
      const expectedPaths = expectInvalid
        ? []
        : goldenCase.competitionSelection.map(selectionToPath)

      // The same nodes filtered on, in the same order
      expect(result.filters.competitionSelection.map((selection) => selection.path)).toEqual(
        expectedPaths
      )
    })
  }

  it('writes back exactly the URL it read, for every path in the taxonomy', () => {
    // The taxonomy the paths are resolved against
    const tree = buildCompetitionTree(competitions, competitions)

    // Every node, so a link to any level survives a round trip through the filters unchanged
    for (const path of golden.allPaths) {
      // The filters the URL reads as
      const result = initializeFiltersFromUrlOrDefaults(
        new URLSearchParams(`competitions=${path}`),
        tree
      )

      // Written back exactly as it arrived
      expect(serializeFilters({ ...createDefaultFilters(), ...result.filters })).toBe(
        `competitions=${path}`
      )
    }
  })
})
