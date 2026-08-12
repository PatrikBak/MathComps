// Pins the contest path a single problem's filters stand on, derived from its source. The path is a
// plain join of slugs that nothing type-checks, and the levels it joins are declared in the other
// order by both the source type and the backend record it mirrors, so every case here resolves the
// derived path against the live taxonomy: a path built in the wrong order names no node at all.

import { describe, expect, it } from 'vitest'

import type { ApiCaller } from '@/hooks/use-api'

import { getProblemBySlug } from '../services/problem-service'
import type { CompetitionFilterOption, LabeledSlug, Problem } from '../types/problem-api-types'
import type { FilterResponse } from '../types/problem-library-types'
import { buildContestTree } from '../utils/contest-tree'
import taxonomyFixture from './fixtures/contest-taxonomy.json'

/** The whole live taxonomy, which decides which paths name a node. */
const competitions = taxonomyFixture as unknown as CompetitionFilterOption[]

/** The taxonomy the derived paths are resolved against. */
const tree = buildContestTree(competitions, competitions)

/**
 * Names one level of a source.
 *
 * @param slug - The level's slug, which is what the path is built out of.
 * @returns The level, reading under its own slug since nothing here reads a label.
 */
function labeledSlug(slug: string): LabeledSlug {
  // The slug standing as its own name
  return { slug, displayName: slug }
}

/**
 * Builds the source of one problem out of the levels it reaches.
 *
 * @param competition - The competition the problem was set in.
 * @param category - The category, absent in a competition with no category level.
 * @param round - The round, absent where the backend leaves an implicit one out.
 * @returns The source.
 */
function sourceOf(
  competition: string,
  category: string | null,
  round: string | null
): Problem['source'] {
  // The levels named, with the season and position the derivation carries through untouched
  return {
    season: labeledSlug('2023'),
    competition: labeledSlug(competition),
    category: category === null ? null : labeledSlug(category),
    round: round === null ? null : labeledSlug(round),
    number: 1,
  }
}

/**
 * Stands up an API caller answering with one problem carrying the given source.
 *
 * @param source - Where that problem came from.
 * @returns The caller, which answers whatever it is asked.
 */
function apiCallReturning(source: Problem['source']): ApiCaller {
  // The problem the response holds, bare everywhere the derivation does not read it
  const problem: Problem = {
    slug: 'a-problem',
    statementMarkdown: '',
    source,
    tags: [],
    authors: [],
    similarProblems: [],
    liked: false,
    marked: false,
    likeCount: 0,
    commentCount: 0,
    listContentIds: [],
  }

  // The one-problem page the endpoint would serve
  const response: FilterResponse = {
    problems: { items: [problem], page: 1, pageSize: 1, totalCount: 1 },
    updatedOptions: null,
    listName: null,
  }

  // Every call lands on that page, whichever slug it asks for
  return <T>() => Promise.resolve({ success: true, data: response as unknown as T })
}

/**
 * Derives the filters for a problem with the given source and resolves the contest they stand on
 * against the taxonomy, so a path naming no node comes back as nothing at all.
 *
 * @param source - Where the problem came from.
 * @returns The path of the node the derived filter resolves to, absent when it resolves to none.
 */
async function resolvedContestPath(source: Problem['source']): Promise<string | undefined> {
  // The problem and the filters showing it, as the single-problem view asks for them
  const result = await getProblemBySlug(apiCallReturning(source), 'a-problem')

  // A failure derives no filters, so there is no contest to resolve
  if (!result.success) return undefined

  // The one contest the derived filters stand on
  const derived = result.data.filters.contestSelection.at(0)?.path

  // The node it names, which the taxonomy holds only for a path joined in the taxonomy's own order
  return derived === undefined ? undefined : tree.byPath.get(derived)?.path
}

describe('deriving the filters showing one problem', () => {
  it('addresses a source reaching no further than its competition by the competition alone', async () => {
    // A competition the backend serves with its only round left implicit
    const source = sourceOf('imo', null, null)

    // The contest the derived filters name, resolved against the taxonomy
    const path = await resolvedContestPath(source)

    // The competition node itself
    expect(path).toBe('imo')
  })

  it('addresses a round hanging off its competition by both the levels it reaches', async () => {
    // A competition with no category level, whose rounds sit directly under it
    const source = sourceOf('memo', null, 't')

    // The contest the derived filters name, resolved against the taxonomy
    const path = await resolvedContestPath(source)

    // The round, under the competition holding it
    expect(path).toBe('memo-t')
  })

  it('addresses a round under a category by all three levels, category first', async () => {
    // The one competition carrying both levels at once, where the join order is decided
    const source = sourceOf('csmo', 'a', 'i')

    // The contest the derived filters name, resolved against the taxonomy
    const path = await resolvedContestPath(source)

    // Category above round, which is the order the taxonomy nests them in
    expect(path).toBe('csmo-a-i')
  })
})
