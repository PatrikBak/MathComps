import type { HostedCompetitionCategory } from '@/components/features/hosted-competitions/model/hosted-competition-types'
import type { Locale } from '@/i18n/i18n'

/** One area a proposal is filed under. */
export type ProposalArea = 'algebra' | 'combinatorics' | 'geometry' | 'numberTheory'

/** The language most proposals are authored in. */
export const PROPOSAL_AUTHORING_LANGUAGE = 'en' as const satisfies Locale

/**
 * One proposal's text in one language.
 */
export type ProposalText = {
  /** The statement as markdown/math source. */
  statement: string
  /** The full solution as markdown/math source, null until somebody writes one in this language. */
  solution: string | null
  /** The hints as markdown/math source, weakest nudge first. */
  hints: string[]
}

/**
 * One proposed problem, still in the pool or already taken by a round.
 */
export type Proposal = {
  /** The problem's id, which is also the proposal's. */
  id: string
  /** The number people quote when they talk about it, the same wherever it moves. */
  number: number
  /** Working name, never shown to a student. */
  title: string
  /** The area it belongs to. */
  area: ProposalArea
  /** The categories it is recommended for, in the order the categories run. */
  recommended: HostedCompetitionCategory[]
  /** Its text in each language it has a statement in. */
  texts: Partial<Record<Locale, ProposalText>>
  /** Whether the reviewers have set it aside, which leaves it in the selection. */
  isSetAside: boolean
  /** Whether a round has taken it out of the pool. */
  isUsed: boolean
}

/**
 * Everything the selection reads, which arrives in one go.
 */
export type SelectionData = {
  /** Every proposal still in the selection, the set-aside and used ones included, lowest number first. */
  proposals: Proposal[]
}
