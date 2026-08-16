// Whether a problem belongs on the screen a set of filters describes. The reader can edit a problem
// into or out of the very view they are reading it in, and this is what says which of the two just
// happened.

import { assertNever } from '@/components/shared/utils/assert-never'

import type { Problem } from '../types/problem-api-types'
import type { SearchFiltersState } from '../types/problem-library-types'

/** A state of a problem that is the reader's own, and that they can turn on and off. */
export type ReaderState = 'liked' | 'marked'

/**
 * Whether a problem still answers to the filters a screen was drawn under.
 *
 * Only the filters the reader can move from the problem itself are read: their like, their mark, and
 * the lists they keep. Everything else about a search is a fact about the problem that no button on
 * it changes.
 *
 * @param filters - The filters the screen was drawn under, null when it is not a filtered screen.
 * @param problem - The problem as it now stands.
 *
 * @returns Whether the screen still has a place for it.
 */
export function belongsUnderFilters(filters: SearchFiltersState | null, problem: Problem): boolean {
  // A screen filtered by nothing at all keeps whatever it was given
  if (filters === null) return true

  // A screen of the reader's own likes is no place for one they do not like
  if (filters.favoritesOnly && !problem.liked) return false

  // A screen of marked problems is no place for an unmarked one, and the other way round
  switch (filters.markStatus) {
    // Marked only, which an unmarked problem has no place on
    case 'marked':
      if (!problem.marked) return false
      break

    // Unmarked only, which a marked problem has just left
    case 'unmarked':
      if (problem.marked) return false
      break

    // A screen saying nothing about marks, which keeps a problem either way
    case null:
      break

    // A status outside the union, which the type system rules out
    default:
      return assertNever(filters.markStatus)
  }

  // A list holds what the reader put in it, and nothing they have taken back out
  if (filters.listContentId !== null && !problem.listContentIds.includes(filters.listContentId)) {
    return false
  }

  // Nothing the reader can move from the problem itself rules it out
  return true
}

/**
 * Whether a screen is filtered on a state the reader can turn on and off, and so holds a different
 * set of problems once they have turned it. A screen saying nothing about that state answers the same
 * either way.
 *
 * @param filters - The filters the screen was drawn under.
 * @param state - The state in question.
 *
 * @returns Whether the screen turns on it.
 */
export function filtersOnState(filters: SearchFiltersState | null, state: ReaderState): boolean {
  switch (state) {
    // The reader's own likes, which a screen either narrows to or says nothing about
    case 'liked':
      return filters?.favoritesOnly === true

    // Their marks, which a screen can narrow to either side of
    case 'marked':
      return filters?.markStatus !== null && filters?.markStatus !== undefined

    // A state outside the union, which the type system rules out
    default:
      return assertNever(state)
  }
}
