import type { HostedCompetitionCategory } from '@/components/features/hosted-competitions/model/hosted-competition-types'
import { groupBy } from '@/components/shared/utils/collection-utils'
import { type Locale, SUPPORTED_LOCALES } from '@/i18n/i18n'

import type {
  Board,
  Cycle,
  Paper,
  Proposal,
  ProposalText,
  ReviewConversation,
  SelectionData,
  SlotAddress,
} from './selection-types'

/**
 * The selection as read: its boards and cycles as they came, and its proposals and their conversations looked up
 * by proposal id.
 */
export type SelectionIndex = Pick<SelectionData, 'boards' | 'cycles'> & {
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

  // The boards and cycles as they came, with the lookups beside them
  return { boards: data.boards, cycles: data.cycles, proposalsById, conversationsByProposal }
}

/**
 * The board to put on screen: the one kept there while the selection still holds it, else the first draft, else
 * the first board there is.
 *
 * @param boards - Every board.
 * @param keptBoardId - The board kept on screen, by id; null while none has been shown.
 *
 * @returns The board; null when the selection holds none.
 */
export function pickActiveBoard(
  boards: readonly Board[],
  keptBoardId: string | null
): Board | null {
  // The board kept on screen, else the first one still being drafted, else the first one there is
  return (
    boards.find((board) => board.id === keptBoardId) ??
    boards.find((board) => board.finalization === null) ??
    boards[0] ??
    null
  )
}

/**
 * The letter a paper goes by in its slots' short labels: its name's initial, in capitals.
 *
 * @param paperName - The paper's name.
 *
 * @returns The initial.
 */
export function paperInitial(paperName: string): string {
  // The name's first letter, in capitals
  return paperName.charAt(0).toUpperCase()
}

/**
 * The short label a slot goes by: the paper's initial and the slot's number, like E2.
 *
 * @param paperName - The name of the paper holding the slot.
 * @param index - The slot's position, from zero.
 *
 * @returns The label.
 */
export function slotLabel(paperName: string, index: number): string {
  // The paper's initial in capitals, then the slot counted from one
  return `${paperInitial(paperName)}${index + 1}`
}

/**
 * Whether two addresses name the same slot.
 *
 * @param first - One address.
 * @param second - The other address.
 *
 * @returns True when the board, the paper and the position all match.
 */
export function sameSlot(first: SlotAddress, second: SlotAddress): boolean {
  // The same board, the same paper within it, the same position within that
  return (
    first.boardId === second.boardId &&
    first.paperId === second.paperId &&
    first.index === second.index
  )
}

/**
 * Where one slot sits within its paper.
 */
export type SlotPosition = {
  /** The paper holding the slot. */
  paper: Paper
  /** The slot's position in the paper, from zero. */
  index: number
}

/**
 * One slot on a board, with the board and the paper holding it.
 */
export type BoardSlot = SlotPosition & {
  /** The board holding the slot. */
  board: Board
}

/**
 * Every slot the proposal fills, across every board.
 *
 * @param boards - Every board.
 * @param proposalId - The proposal.
 *
 * @returns Its placements, in board order.
 */
export function placementsOf(boards: readonly Board[], proposalId: string): BoardSlot[] {
  // Every slot holding the proposal, on any paper of any board
  return boards.flatMap((board) =>
    board.papers.flatMap((paper) =>
      paper.slots.flatMap((slot, index) => (slot === proposalId ? [{ board, paper, index }] : []))
    )
  )
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

/**
 * One slotted proposal a round would refuse, with the languages it falls short in.
 */
type UnreadyProposal = {
  /** The proposal. */
  proposal: Proposal
  /** The languages it lacks a statement or a solution in. */
  languages: Locale[]
}

/**
 * What stands between a board and finalizing it, whichever cycle it goes into.
 */
export type FinalizeBlockers = {
  /** How many slots stand empty. */
  emptySlots: number
  /** Each slotted proposal a round would refuse. */
  unready: UnreadyProposal[]
}

/**
 * What stops the board from being finalized, whichever cycle it goes into.
 *
 * @param board - The board.
 * @param proposals - Every proposal, by id.
 *
 * @returns The blockers, every one of them clear on a full board of ready proposals.
 */
export function finalizeBlockers(
  board: Board,
  proposals: ReadonlyMap<string, Proposal>
): FinalizeBlockers {
  // Every slot across every paper
  const slots = board.papers.flatMap((paper) => paper.slots)

  // The slotted proposals, which a board never holds twice
  const slotted = slots.flatMap((slot) => (slot === null ? [] : (proposals.get(slot) ?? [])))

  // How many slots are empty, and every slotted proposal falling short in some language
  return {
    emptySlots: slots.filter((slot) => slot === null).length,
    unready: slotted.flatMap((proposal) => {
      // The languages the proposal falls short in
      const languages = unreadyLanguages(proposal)

      // Ready in every language, or listed with the ones it lacks
      return languages.length === 0 ? [] : [{ proposal, languages }]
    }),
  }
}

/**
 * What keeps a board's papers from pairing up with a cycle's rounds, one paper to each round of its category,
 * each paper as long as the rounds are.
 */
export type CycleMisfit = {
  /** Papers no round of the cycle is left for: no category, one the cycle lacks, or one an earlier paper took. */
  unmatched: Paper[]
  /** Papers whose slot count differs from the problem count the cycle's rounds take. */
  wrongSize: Paper[]
  /** The categories of the cycle's rounds no paper fills. */
  uncovered: HostedCompetitionCategory[]
}

/**
 * What keeps a board's papers from pairing up with one cycle's rounds, whatever their slots hold.
 *
 * @param board - The board.
 * @param cycle - The cycle.
 *
 * @returns The misfits, every list empty once the papers fit the rounds.
 */
export function cycleMisfit(board: Board, cycle: Cycle): CycleMisfit {
  // The papers left without a round, a round going to the first paper of its category and no other
  const unmatched = board.papers.filter(
    (paper, index) =>
      paper.category === null ||
      !cycle.categories.includes(paper.category) ||
      board.papers.findIndex((other) => other.category === paper.category) !== index
  )

  // The papers of the wrong length, every round of the cycle taking the same number of problems
  const wrongSize = board.papers.filter((paper) => paper.slots.length !== cycle.problemCount)

  // The categories of the rounds no paper stands for
  const uncovered = cycle.categories.filter(
    (category) => !board.papers.some((paper) => paper.category === category)
  )

  // Everything in the way
  return { unmatched, wrongSize, uncovered }
}

/**
 * Whether nothing keeps a board's papers from pairing up with a cycle's rounds.
 *
 * @param misfit - Where a board's papers miss a cycle's rounds, as {@link cycleMisfit} found it.
 *
 * @returns True once the papers pair up with the rounds.
 */
export function fitsCycle(misfit: CycleMisfit): boolean {
  // Every paper with a round and the right length, and every round with a paper
  return (
    misfit.unmatched.length === 0 && misfit.wrongSize.length === 0 && misfit.uncovered.length === 0
  )
}
