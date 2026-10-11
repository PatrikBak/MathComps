import type { RouteHref } from '@/components/shared/components/AppLink'
import { parseMember } from '@/components/shared/utils/collection-utils'
import { ROUTES } from '@/i18n/i18n'

/** The query parameter naming the problem open in full. */
export const OPEN_PROPOSAL_PARAM = 'problem'

/** The query parameter naming the paper open in full, or the one a problem open in full was opened over. */
export const OPEN_PAPER_PARAM = 'paper'

/** The query parameter naming the tab a page opens on. */
const DETAIL_TAB_PARAM = 'tab'

/** Every query parameter the page open over the pool owns. */
export const DETAIL_PARAMS = [OPEN_PROPOSAL_PARAM, OPEN_PAPER_PARAM, DETAIL_TAB_PARAM] as const

/** The tabs of a problem's page, the first being the one a problem opens on by default. */
export const PROPOSAL_TABS = ['conversations', 'comments'] as const

/** One tab of a problem's page. */
export type ProposalTab = (typeof PROPOSAL_TABS)[number]

/** The tabs of a paper's page, the first being the one a paper opens on by default. */
export const PAPER_TABS = ['problems', 'comments'] as const

/** One tab of a paper's page. */
export type PaperTab = (typeof PAPER_TABS)[number]

/**
 * One page of a kind open over the pool, whichever of its tabs shows.
 */
type OpenPage<TKind extends string> = {
  /** What the page shows. */
  kind: TKind
  /** The page's subject. */
  id: string
}

/**
 * One page of a kind, as an address opens it.
 */
type PageOn<TKind extends string, TTab extends string> = OpenPage<TKind> & {
  /** The tab it opens on; the first when undefined. */
  tab: TTab | undefined
}

/** A page the pool makes way for, as an address opens it. */
export type DetailPage = PageOn<'proposal', ProposalTab> | PageOn<'paper', PaperTab>

/** The page open over the pool, whichever of its tabs shows. */
export type OpenDetail = OpenPage<'proposal'> | OpenPage<'paper'>

/** The query parameter naming each kind of page's subject. */
const SUBJECT_PARAMS: Record<DetailPage['kind'], string> = {
  proposal: OPEN_PROPOSAL_PARAM,
  paper: OPEN_PAPER_PARAM,
}

/**
 * Every query parameter each kind of page writes itself. A problem's leaves the paper it was opened over as it
 * stands, so a problem opened while the address names a paper opens over that paper. A paper's owns them all.
 */
export const PAGE_PARAMS: Record<DetailPage['kind'], readonly string[]> = {
  proposal: [OPEN_PROPOSAL_PARAM, DETAIL_TAB_PARAM],
  paper: DETAIL_PARAMS,
}

/**
 * The query parameters that open one page in full, naming the tab only where one is asked for.
 *
 * @param page - The page and the tab it opens on.
 *
 * @returns The parameters, by name.
 */
function detailSearch({ kind, id, tab }: DetailPage): Record<string, string> {
  // The page's subject, and the tab where one is asked for
  return {
    [SUBJECT_PARAMS[kind]]: id,
    ...(tab === undefined ? {} : { [DETAIL_TAB_PARAM]: tab }),
  }
}

/**
 * The query string that opens one page in full.
 *
 * @param page - The page and the tab it opens on.
 *
 * @returns The query string, without its `?`.
 */
export function detailQuery(page: DetailPage): string {
  // The parameters, written out as a query string
  return new URLSearchParams(detailSearch(page)).toString()
}

/**
 * The paper the problem an address opens was opened over.
 *
 * @param searchParams - The address's query parameters.
 *
 * @returns The paper's id, or null when the address opens no problem or the problem was opened over none.
 */
export function paperBeneathOf(searchParams: URLSearchParams): string | null {
  // An address opening no problem has nothing open over a paper
  if (searchParams.get(OPEN_PROPOSAL_PARAM) === null) return null

  // The paper named beside the problem, if any
  return searchParams.get(OPEN_PAPER_PARAM)
}

/**
 * Where one page lives, named by its route so each language gets its own path. The paper an address names stays
 * beside a page that leaves it standing, as {@link PAGE_PARAMS} has it, so the page opens over it.
 *
 * @param page - The page and the tab it opens on.
 * @param paperId - The paper the current address names; null for none.
 *
 * @returns The pool's route with the page open over it.
 */
export function detailHref(page: DetailPage, paperId: string | null): RouteHref {
  // The paper, wherever the page leaves it standing
  const paper =
    paperId === null || PAGE_PARAMS[page.kind].includes(OPEN_PAPER_PARAM)
      ? {}
      : { [OPEN_PAPER_PARAM]: paperId }

  // The pool's route, carrying the page's subject, the tab where one is asked for, and the paper beneath
  return { pathname: ROUTES.PROBLEM_SELECTION, query: { ...detailSearch(page), ...paper } }
}

/**
 * The page an address opens over the pool, a problem winning over a paper named beside it.
 *
 * @param searchParams - The address's query parameters.
 *
 * @returns The page, or null when the address names none.
 */
export function detailOf(searchParams: URLSearchParams): OpenDetail | null {
  // The problem the address names
  const proposalId = searchParams.get(OPEN_PROPOSAL_PARAM)

  // A problem's page
  if (proposalId !== null) return { kind: 'proposal', id: proposalId }

  // The paper the address names
  const paperId = searchParams.get(OPEN_PAPER_PARAM)

  // A paper's page, or the pool alone when the address names no paper either
  return paperId === null ? null : { kind: 'paper', id: paperId }
}

/**
 * The tab an address opens a page on.
 *
 * @param searchParams - The address's query parameters.
 * @param tabs - The page's tabs, the first being the one it opens on by default.
 *
 * @returns The tab the address names, or the first tab when it names none the page has.
 */
export function tabOf<TTab extends string>(
  searchParams: URLSearchParams,
  tabs: readonly [TTab, ...TTab[]]
): TTab {
  // The tab the address names, or the first one when it names none the page has
  return parseMember(searchParams.get(DETAIL_TAB_PARAM), tabs) ?? tabs[0]
}
