// Pins the competition a single problem's filters stand on, taken off the chain its source carries. The
// chain runs root-first, so reading it from the wrong end still yields a path the taxonomy holds and
// still filters the archive, just to a whole competition instead of the round the reader asked for.
// Every case therefore names the exact node it expects, resolved against the live taxonomy.

import { describe, expect, it } from 'vitest'

import type { ApiCaller } from '@/hooks/use-api'

import { getProblemBySlug } from '../services/problem-service'
import type { CompetitionNodeOption, LabeledSlug, Problem } from '../types/problem-api-types'
import type { FilterResponse } from '../types/problem-library-types'
import { buildCompetitionTree } from '../utils/competition-tree'
import taxonomyFixture from './fixtures/competition-taxonomy.json'

/** The whole live taxonomy, which decides which paths name a node. */
const competitions = taxonomyFixture as unknown as CompetitionNodeOption[]

/** The taxonomy the derived paths are resolved against. */
const tree = buildCompetitionTree(competitions, competitions)

/**
 * Names one competition on a source's chain.
 *
 * @param path - The competition's path, which is what a chain entry's slug carries.
 * @returns The entry, reading under its own path since nothing here reads a label.
 */
function labeledSlug(path: string): LabeledSlug {
  // The path standing as its own name
  return { slug: path, displayName: path }
}

/**
 * Builds the source of one problem out of the competitions it hangs from.
 *
 * @param competitionPaths - Every competition down to the one the problem was set in, root-first.
 * @returns The source.
 */
function sourceOf(competitionPaths: string[]): Problem['source'] {
  // The competition chain under test, with a season and position nothing reads
  return {
    season: labeledSlug('2023'),
    competition: competitionPaths.map(labeledSlug),
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
 * Derives the filters for a problem with the given source and resolves the competition they stand on
 * against the taxonomy, so a path naming no node comes back as nothing at all.
 *
 * @param source - Where the problem came from.
 * @returns The path of the node the derived filter resolves to, absent when it resolves to none.
 */
async function resolvedCompetitionPath(source: Problem['source']): Promise<string | undefined> {
  // The problem and the filters showing it, as the single-problem view asks for them
  const result = await getProblemBySlug(apiCallReturning(source), 'a-problem')

  // A failure derives no filters, so there is no competition to resolve
  if (!result.success) return undefined

  // The one competition the derived filters stand on
  const derived = result.data.filters.competitionSelection.at(0)?.path

  // The node it names, which the taxonomy holds only for a path the derivation read off whole
  return derived === undefined ? undefined : tree.byPath.get(derived)?.path
}

describe('deriving the filters showing one problem', () => {
  it('stands on the competition itself when nothing hangs under it', async () => {
    // A competition the backend serves with its only round left implicit
    const source = sourceOf(['imo'])

    // The competition the derived filters name, resolved against the taxonomy
    const path = await resolvedCompetitionPath(source)

    // The competition node itself, which is the whole of the chain
    expect(path).toBe('imo')
  })

  it('stands on the round rather than the competition above it', async () => {
    // A competition with no category level, whose rounds sit directly under it
    const source = sourceOf(['memo', 'memo-t'])

    // The competition the derived filters name, resolved against the taxonomy
    const path = await resolvedCompetitionPath(source)

    // The round, not the competition heading the chain, which would resolve just as happily
    expect(path).toBe('memo-t')
  })

  it('stands on the deepest competition however long the chain runs', async () => {
    // The one competition carrying a level between its rounds and itself
    const source = sourceOf(['csmo', 'csmo-a', 'csmo-a-i'])

    // The competition the derived filters name, resolved against the taxonomy
    const path = await resolvedCompetitionPath(source)

    // The end of the chain, whatever depth that turns out to be
    expect(path).toBe('csmo-a-i')
  })

  it('shows no problem at all for a source hanging from no competition', async () => {
    // A payload naming where the problem came from and then naming nothing
    const result = await getProblemBySlug(apiCallReturning(sourceOf([])), 'a-problem')

    // Refused outright rather than filtered to a competition nobody named
    expect(result.success).toBe(false)
  })
})
