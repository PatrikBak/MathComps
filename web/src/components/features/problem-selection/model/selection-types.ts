import type { StoredTurn } from '@/components/features/defense/model/defense-types'
import type { HostedCompetitionCategory } from '@/components/features/hosted-competitions/model/hosted-competition-types'
import type { Locale } from '@/i18n/i18n'

/** Every area a proposal can be filed under. */
export const PROPOSAL_AREAS = ['algebra', 'combinatorics', 'geometry', 'numberTheory'] as const

/** One area a proposal is filed under. */
export type ProposalArea = (typeof PROPOSAL_AREAS)[number]

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
 * One paper on a board: a named run of numbered slots.
 */
export type Paper = {
  /** Identity of the paper. */
  id: string
  /** What the paper is called. */
  name: string
  /** The MathComps category the paper fills, null for a paper outside the categories, which no round takes. */
  category: HostedCompetitionCategory | null
  /** The problem in each slot, by id, null where the slot stands empty. */
  slots: (string | null)[]
}

/**
 * The rounds a board was finalized into.
 */
type Finalization = {
  /** The name of the cycle whose rounds took the papers, in the language the site is read in. */
  cycleName: string
  /** When those rounds open, as an ISO-8601 string; the board leaves the selection once they do. */
  opensAt: string
}

/**
 * One board of the selection: a named set of papers whose slots are filled from the pool, tied to no cycle
 * until it is finalized into one.
 */
export type Board = {
  /** Identity of the board. */
  id: string
  /** What the board is called. */
  name: string
  /** Its papers, in the order the board sets them out. */
  papers: Paper[]
  /** The rounds it was finalized into, null while it is still a draft. */
  finalization: Finalization | null
}

/**
 * A summary of one reviewer's conversation with Mathilda about a proposal, whose full text is a
 * {@link ReviewTranscript}.
 */
export type ReviewConversation = {
  /** Identity of the conversation. */
  id: string
  /** The proposal it was about. */
  proposalId: string
  /** The username of whoever held it, null without one or for a deleted account. */
  author: string | null
  /** When it started, as an ISO-8601 string. */
  startedAt: string
  /** How many messages were said in it. */
  messageCount: number
  /** Whether it was argued against a statement the proposal no longer has in any language. */
  hasOlderStatement: boolean
}

/**
 * Everything said in one conversation with Mathilda about a proposal.
 */
export type ReviewTranscript = {
  /** The statement as it stood when the conversation started. */
  savedStatement: string
  /** Everything said, in order. */
  turns: StoredTurn[]
}

/**
 * Everything the selection reads, which arrives in one go.
 */
export type SelectionData = {
  /** Every proposal still in the selection, the set-aside and used ones included, lowest number first. */
  proposals: Proposal[]
  /** Every board still in the selection, oldest first. */
  boards: Board[]
  /** Every conversation about a proposal still in the selection, newest first. */
  conversations: ReviewConversation[]
}
