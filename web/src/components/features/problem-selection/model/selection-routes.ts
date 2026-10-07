import type { RouteHref } from '@/components/shared/components/AppLink'
import { ROUTES } from '@/i18n/i18n'

/** The query parameter naming the problem open in full. */
export const OPEN_PROPOSAL_PARAM = 'problem'

/**
 * The query string that opens one proposal in full.
 *
 * @param proposalId - The proposal.
 *
 * @returns The query string, without its `?`.
 */
export function proposalQuery(proposalId: string): string {
  // The proposal's parameter, written out as a query string
  return new URLSearchParams({ [OPEN_PROPOSAL_PARAM]: proposalId }).toString()
}

/**
 * Where one proposal lives, named by its route so each language gets its own path.
 *
 * @param proposalId - The proposal.
 *
 * @returns The pool's route with the proposal open over it.
 */
export function proposalHref(proposalId: string): RouteHref {
  // The pool's route, carrying the proposal
  return { pathname: ROUTES.PROBLEM_SELECTION, query: { [OPEN_PROPOSAL_PARAM]: proposalId } }
}
