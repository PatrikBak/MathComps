// What the single-problem service does with an answer it cannot show a problem from. The filters it
// hands on come off the wire, so what is left to decide is which answers it refuses outright and
// which it serves half-built.

import { describe, expect, it } from 'vitest'

import type { ApiCaller } from '@/hooks/use-api'

import { getProblemBySlug } from '../services/problem-service'
import type { Problem } from '../types/problem-api-types'
import type {
  FilterOptionsWithCounts,
  FilterResult,
  SingleProblemResponse,
} from '../types/problem-library-types'

/**
 * Stands in for an option block, since nothing here reads a facet count.
 *
 * @returns Options offering nothing.
 */
function emptyOptions(): FilterOptionsWithCounts {
  // Every facet, each offering no rows
  return { competitions: [], seasons: [], problemNumbers: [], tags: [], authors: [] }
}

/**
 * Stands up an API caller answering with one problem.
 *
 * @param withoutOptions - Which option blocks to leave out, both being carried by default.
 * @returns The caller, which answers whatever it is asked.
 */
function apiCallReturning(
  withoutOptions: Partial<Pick<FilterResult, 'baseOptions' | 'updatedOptions'>> = {}
): ApiCaller {
  // The problem the response holds, bare everywhere the service does not read it
  const problem: Problem = {
    slug: 'a-problem',
    statementMarkdown: '',
    solutionLink: null,
    source: {
      season: { slug: '2023', displayName: '2023', fullName: null },
      startYear: 2023,
      competition: [{ slug: 'imo', displayName: 'imo', fullName: null }],
      number: 1,
    },
    tags: [],
    authors: [],
    similarProblems: [],
    liked: false,
    marked: false,
    likeCount: 0,
    commentCount: 0,
    listContentIds: [],
  }

  // The answer the endpoint would serve, carrying both option blocks bar those left out
  const response: SingleProblemResponse = {
    filterResult: {
      problems: { items: [problem], page: 1, pageSize: 1, totalCount: 1 },
      baseOptions: emptyOptions(),
      updatedOptions: emptyOptions(),
      ...withoutOptions,
    },
    filters: { season: 2023, competitionPath: 'imo', problemNumber: 1 },
  }

  // Every call lands on that answer, whichever slug it asks for
  return <T>() => Promise.resolve({ success: true, data: response as unknown as T })
}

describe('showing the one problem the archive answered with', () => {
  it('shows no problem at all when the answer carried no counts for it', async () => {
    // An answer whose problem is fine but whose own option counts never came
    const apiCall = apiCallReturning({ updatedOptions: null })

    // The problem, as the single-problem view asks for it
    const result = await getProblemBySlug(apiCall, 'a-problem', true)

    // Refused, since the sidebar would otherwise read nought against every filter on offer
    expect(result.success).toBe(false)
  })

  it('shows the problem without the library options when it did not ask for them', async () => {
    // The answer a reader gets clicking through from an archive that already holds them
    const apiCall = apiCallReturning({ baseOptions: null })

    // The problem, as the single-problem view asks for it having them already
    const result = await getProblemBySlug(apiCall, 'a-problem', false)

    // Served, with only the counts the problem itself narrows to
    expect(result.success).toBe(true)
  })
})
