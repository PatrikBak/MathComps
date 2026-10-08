import { groupBy } from '@/components/shared/utils/collection-utils'
import { type Locale, SUPPORTED_LOCALES } from '@/i18n/i18n'

import type { Proposal, ProposalText, ReviewConversation, SelectionData } from './selection-types'

/**
 * The selection as read, with its proposals and their conversations looked up by proposal id.
 */
export type SelectionIndex = {
  /** Every proposal, by id. */
  proposalsById: ReadonlyMap<string, Proposal>
  /** Every conversation about each proposal, by the proposal's id, newest first. */
  conversationsByProposal: ReadonlyMap<string, ReviewConversation[]>
}

/**
 * The selection as it was read, with the lookups by proposal built.
 *
 * @param data - The selection as it was read.
 *
 * @returns The selection with its lookups.
 */
export function indexSelection(data: SelectionData): SelectionIndex {
  // Every proposal under its id
  const proposalsById = new Map(data.proposals.map((proposal) => [proposal.id, proposal]))

  // The conversations under the proposal each was about, keeping the read's newest-first order
  const conversationsByProposal = groupBy(
    data.conversations,
    (conversation) => conversation.proposalId
  )

  // The lookups by proposal
  return { proposalsById, conversationsByProposal }
}

/**
 * A problem's text, with the language it came in.
 */
export type ResolvedText = {
  /** The text. */
  text: ProposalText
  /** The language it is in. */
  language: Locale
}

/**
 * A problem's text in the language asked for, or else in the first language it is written in, taken in
 * {@link SUPPORTED_LOCALES} order.
 *
 * @param proposal - The problem.
 * @param language - The language asked for.
 *
 * @returns The text and the language it came in, or null for a problem with no text at all.
 */
export function resolveText(proposal: Proposal, language: Locale): ResolvedText | null {
  // The language asked for, then every other language in order
  const order = [language, ...SUPPORTED_LOCALES.filter((candidate) => candidate !== language)]

  // The problem's texts in that order, each with its language
  const written = order.flatMap((candidate) => {
    // The problem's text in this language, if it has one
    const text = proposal.texts[candidate]

    // The text with its language, where there is one
    return text === undefined ? [] : [{ text, language: candidate }]
  })

  // The first text found, or nothing for a problem written in no language
  return written.at(0) ?? null
}

/**
 * The languages nothing of a proposal can be read in yet.
 *
 * @param proposal - The proposal.
 *
 * @returns Every language with no statement, in the order {@link SUPPORTED_LOCALES} lists them.
 */
export function unwrittenLanguages(proposal: Proposal): Locale[] {
  // Every language the proposal has no text in
  return SUPPORTED_LOCALES.filter((language) => proposal.texts[language] === undefined)
}

/**
 * A proposal's text in one language with a solution to it.
 */
type TextWithSolution = ProposalText & {
  /** The solution, as markdown/math source. */
  solution: string
}

/**
 * Whether a text carries a solution, one of nothing but whitespace counting as none, as it does for a round.
 *
 * @param text - The text in one language.
 *
 * @returns True when the solution says something.
 */
export function hasSolution(text: ProposalText): text is TextWithSolution {
  // A solution written, and saying more than whitespace
  return text.solution !== null && text.solution.trim() !== ''
}

/**
 * The languages a round would refuse a proposal in.
 *
 * @param proposal - The proposal.
 *
 * @returns Every language with no statement or no solution, in the order {@link SUPPORTED_LOCALES} lists them.
 */
export function unreadyLanguages(proposal: Proposal): Locale[] {
  // Every language the proposal falls short in
  return SUPPORTED_LOCALES.filter((language) => {
    // The proposal's text in this language, if it has one
    const text = proposal.texts[language]

    // A language falls short without a statement, or without a solution to go with it
    return text === undefined || !hasSolution(text)
  })
}
