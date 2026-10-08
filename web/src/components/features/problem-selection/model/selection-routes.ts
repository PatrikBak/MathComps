import type { RouteHref } from '@/components/shared/components/AppLink'
import { parseMember } from '@/components/shared/utils/collection-utils'
import { ROUTES } from '@/i18n/i18n'

/** The query parameter naming the problem open in full. */
export const OPEN_PROPOSAL_PARAM = 'problem'

/** The query parameter naming the tab a problem opens on. */
const DETAIL_TAB_PARAM = 'tab'

/** The tabs of a problem's page, the first being the one a problem opens on by default. */
export const DETAIL_TABS = ['conversations', 'comments'] as const

/** One tab of a problem's page. */
export type DetailTab = (typeof DETAIL_TABS)[number]

/**
 * One problem's page, as an address opens it.
 */
export type ProposalPage = {
  /** The problem. */
  proposalId: string
  /** The tab it opens on; the first when undefined. */
  tab: DetailTab | undefined
}

/**
 * The query parameters that open one proposal in full, naming the tab only where one is asked for.
 *
 * @param page - The proposal and the tab it opens on.
 *
 * @returns The parameters, by name.
 */
function proposalSearch({ proposalId, tab }: ProposalPage): Record<string, string> {
  // The proposal, and the tab where one is asked for
  return {
    [OPEN_PROPOSAL_PARAM]: proposalId,
    ...(tab === undefined ? {} : { [DETAIL_TAB_PARAM]: tab }),
  }
}

/**
 * The query string that opens one proposal in full.
 *
 * @param page - The proposal and the tab it opens on.
 *
 * @returns The query string, without its `?`.
 */
export function proposalQuery(page: ProposalPage): string {
  // The parameters, written out as a query string
  return new URLSearchParams(proposalSearch(page)).toString()
}

/**
 * Where one proposal lives, named by its route so each language gets its own path.
 *
 * @param page - The proposal and the tab it opens on.
 *
 * @returns The pool's route with the proposal open over it.
 */
export function proposalHref(page: ProposalPage): RouteHref {
  // The pool's route, carrying the proposal and the tab where one is asked for
  return { pathname: ROUTES.PROBLEM_SELECTION, query: proposalSearch(page) }
}

/**
 * The tab an address opens a problem on.
 *
 * @param searchParams - The address's query parameters.
 *
 * @returns The tab the address names, or the first tab when it names none the page has.
 */
export function detailTabOf(searchParams: URLSearchParams): DetailTab {
  // The tab the address names, or the first one when it names none the page has
  return parseMember(searchParams.get(DETAIL_TAB_PARAM), DETAIL_TABS) ?? DETAIL_TABS[0]
}
