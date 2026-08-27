// The two values every spec about a reader's own edits needs: a screen filtering nothing, and a
// problem carrying only the state the reader can move from the problem itself.

import type { Problem } from '../../types/problem-api-types'
import type { SearchFiltersState } from '../../types/problem-library-types'
import { createDefaultFilters } from '../../utils/url-initialization'

/** Nothing filtered on, which a case sets one filter of. */
export const noFilters: SearchFiltersState = createDefaultFilters()

/**
 * Builds a problem carrying the reader's own state on it, which is all these specs read.
 *
 * @param state - The state to carry, defaulted to a problem the reader has never touched.
 *
 * @returns The problem.
 */
export function problemWith(state: Partial<Problem> = {}): Problem {
  // Everything else is there because the type asks for it
  return {
    slug: 'problem',
    statementMarkdown: '',
    solutionLink: null,
    source: {
      season: { slug: '75', displayName: '75', fullName: null },
      startYear: 2025,
      competition: [],
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
    ...state,
  }
}
