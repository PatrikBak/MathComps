'use client'

import { useAuth } from '@clerk/nextjs'
import { useLocale } from 'next-intl'

import { assertNever } from '@/components/shared/utils/assert-never'
import { errorCodeOf } from '@/lib/api/api-error'
import { useProblem } from '@/stores/problem-store'

import type { Problem } from '../types/problem-api-types'
import { useSingleProblem } from './use-problem-search-query'

/**
 * A problem of the archive, read by its slug.
 */
type FoundProblem = {
  /** The discriminant. */
  kind: 'found'
  /** The problem. */
  problem: Problem
}

/**
 * A slug the archive answered that no problem goes by.
 */
type MissingProblem = {
  /** The discriminant. */
  kind: 'missing'
}

/**
 * A problem whose read failed for a reason other than there being no such problem.
 */
type FailedProblem = {
  /** The discriminant. */
  kind: 'failed'
  /** Reads the problem again. */
  retry: () => void
}

/**
 * A problem not in hand yet: still on its way, or read into a store emptied since.
 */
type UnreadProblem = {
  /** The discriminant. */
  kind: 'unread'
}

/**
 * What became of reading a problem by its slug.
 */
export type ProblemBySlug = FoundProblem | MissingProblem | FailedProblem | UnreadProblem

/**
 * One problem of the archive by its slug, whether or not the list has loaded it. A problem the store lacks is fetched
 * on its own and put in the store.
 *
 * @param problemSlug - The slug of the problem.
 *
 * @returns What became of reading the problem.
 */
export function useProblemBySlug(problemSlug: string): ProblemBySlug {
  // The slug in the archive's own lower case, which the store keys problems by; the archive reads a slug in any case
  const slug = problemSlug.toLowerCase()

  // The problem, once the store holds it
  const problem = useProblem(slug)

  // Who is signed in, and whether that is settled yet
  const { userId, isLoaded: isUserDataLoaded } = useAuth()

  // The locale the archive reads in
  const locale = useLocale()

  // The fetch of the problem by its slug while the store lacks it, held until auth settles because a problem carries
  // whether the reader liked it
  const { uiState, retry } = useSingleProblem(
    locale,
    slug,
    isUserDataLoaded ? (userId ?? null) : null,
    problem === undefined && isUserDataLoaded
  )

  // The problem, once either the list or the fetch has put it in the store
  if (problem !== undefined) return { kind: 'found', problem }

  // Otherwise what the fetch has come to
  switch (uiState.kind) {
    // Still on its way
    case 'loading':
    case 'retrying':
    case 'offline':
      return { kind: 'unread' }

    // Read earlier, into a store emptied since
    case 'ready':
      return { kind: 'unread' }

    // Failed
    case 'failed':
      // The archive's answer that no problem goes by the slug
      if (errorCodeOf(uiState.error) === 'ProblemNotFound') return { kind: 'missing' }

      // Any other failure, which another read may get past
      return { kind: 'failed', retry }

    // Every fetch state is handled above
    default:
      return assertNever(uiState)
  }
}
