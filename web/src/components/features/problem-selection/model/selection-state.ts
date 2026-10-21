import type { HostedCompetitionCategory } from '@/components/features/hosted-competitions/model/hosted-competition-types'
import { groupBy } from '@/components/shared/utils/collection-utils'
import { type Locale, SUPPORTED_LOCALES } from '@/i18n/i18n'

import { STEPS_PER_POINT } from './rating-scale'
import type {
  Board,
  Cycle,
  Paper,
  Proposal,
  ProposalRating,
  ProposalText,
  RatingAspect,
  ReviewConversation,
  SelectionCategory,
  SelectionData,
  SlotAddress,
} from './selection-types'

/**
 * A paper, and the board it is on.
 */
export type PaperOnBoard = {
  /** The paper. */
  paper: Paper
  /** The board holding it. */
  board: Board
}

/**
 * The selection as read: its categories, the reader's lead categories, its boards, its cycles and the languages its
 * problems need as they came, its papers looked up by id, and its proposals and their conversations looked up by
 * proposal id.
 */
export type SelectionIndex = Pick<
  SelectionData,
  'categories' | 'leadCategories' | 'boards' | 'cycles' | 'needsEveryLanguage'
> & {
  /** Every paper on the boards, with the board holding it, by the paper's id. */
  papersById: ReadonlyMap<string, PaperOnBoard>
  /** Every proposal, by id. */
  proposalsById: ReadonlyMap<string, Proposal>
  /** Every conversation about each proposal, by the proposal's id, newest first. */
  conversationsByProposal: ReadonlyMap<string, ReviewConversation[]>
}

/**
 * The selection as it was read, with the lookups by paper and by proposal built.
 *
 * @param data - The selection as it was read.
 *
 * @returns The selection with its lookups.
 */
export function indexSelection(data: SelectionData): SelectionIndex {
  // Every paper under its id, beside the board holding it
  const papersById = new Map(
    data.boards.flatMap((board) =>
      board.papers.map((paper) => [paper.id, { paper, board }] as const)
    )
  )

  // Every proposal under its id
  const proposalsById = new Map(data.proposals.map((proposal) => [proposal.id, proposal]))

  // The conversations under the proposal each was about, keeping the read's newest-first order
  const conversationsByProposal = groupBy(
    data.conversations,
    (conversation) => conversation.proposalId
  )

  // The categories, the reader's lead categories, the boards, the cycles and the languages needed as they came,
  // with the lookups beside them
  return {
    categories: data.categories,
    leadCategories: data.leadCategories,
    boards: data.boards,
    cycles: data.cycles,
    needsEveryLanguage: data.needsEveryLanguage,
    papersById,
    proposalsById,
    conversationsByProposal,
  }
}

/**
 * The hue a category wears, which is its index among the selection's categories.
 *
 * @param categories - The selection's categories, in the order they run.
 * @param category - The category, by name.
 *
 * @returns The hue's index, from zero; null for a category the selection doesn't list.
 */
export function categoryHue(
  categories: readonly SelectionCategory[],
  category: string
): number | null {
  // Where the category stands, -1 where nowhere
  const place = categories.findIndex((candidate) => candidate.name === category)

  // The place, or none where the category stands nowhere
  return place === -1 ? null : place
}

/**
 * The hosted level a category is, which picks the round a paper of that category goes into.
 *
 * @param category - The category, by name.
 * @param categories - The selection's categories.
 *
 * @returns The level; null for a category the selection doesn't list, or one no hosted round runs.
 */
export function hostedLevelOf(
  category: string,
  categories: readonly SelectionCategory[]
): HostedCompetitionCategory | null {
  // The level of the category of that name, where the selection lists one
  return categories.find((candidate) => candidate.name === category)?.hostedCategory ?? null
}

/**
 * Whether every paper of a board goes into a round when the board is finalized: each fills a category that is a
 * hosted level.
 *
 * @param board - The board.
 * @param categories - The selection's categories.
 *
 * @returns True once every paper's category is a hosted level.
 */
export function mapsToRounds(board: Board, categories: readonly SelectionCategory[]): boolean {
  // Every paper of a category at some level
  return board.papers.every((paper) => hostedLevelOf(paper.category, categories) !== null)
}

/**
 * Whether the reader leads a paper's category, which is what lets them change its slots.
 *
 * @param leadCategories - The names of the categories the reader leads.
 * @param paper - The paper.
 *
 * @returns True when the reader leads the paper's category.
 */
export function isLeadOf(leadCategories: readonly string[], paper: Paper): boolean {
  // The paper's category among the reader's
  return leadCategories.includes(paper.category)
}

/**
 * Whether the reader can put a problem onto a board: the problem is live in the pool, the board is a draft with a
 * paper the reader leads, and the problem stands in no paper they do not lead, which a placement would
 * change too.
 *
 * @param board - The board.
 * @param proposal - The problem.
 * @param leadCategories - The names of the categories the reader leads.
 *
 * @returns True when some slot of the board takes the problem from the reader.
 */
export function canPlaceOn(
  board: Board,
  proposal: Proposal,
  leadCategories: readonly string[]
): boolean {
  // The paper the problem stands in on the board, where it stands in one
  const holdingPaper = board.papers.find((paper) => paper.slots.includes(proposal.id))

  // A live problem, a draft with a paper the reader leads, and no paper they do not lead to take the problem out of
  return (
    !proposal.isSetAside &&
    !proposal.isUsed &&
    board.finalization === null &&
    board.papers.some((paper) => isLeadOf(leadCategories, paper)) &&
    (holdingPaper === undefined || isLeadOf(leadCategories, holdingPaper))
  )
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
 * The languages nothing of a set of proposals can be read in yet.
 *
 * @param proposals - The proposals.
 *
 * @returns Every language none of them has a statement in, in the order {@link SUPPORTED_LOCALES} lists them;
 * none for an empty set.
 */
export function unwrittenAcross(proposals: readonly Proposal[]): Locale[] {
  // An empty set rules no language out
  if (proposals.length === 0) return []

  // Every language none of the proposals has a text in
  return SUPPORTED_LOCALES.filter((language) =>
    proposals.every((proposal) => proposal.texts[language] === undefined)
  )
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
 * The text Mathilda argues a proposal from: the one in the reader's language where it is solved there, or else
 * the one it was first written in, where that is solved.
 *
 * @param proposal - The proposal.
 * @param language - The language the reader is in.
 *
 * @returns The text, or null where neither the reader's language nor the original is solved.
 */
export function arguedText(proposal: Proposal, language: Locale): ProposalText | null {
  // The proposal's text in the reader's language, if it has one
  const readersText = proposal.texts[language]

  // Argued in the reader's language wherever it is solved there
  if (readersText !== undefined && hasSolution(readersText)) return readersText

  // The proposal's text in the language it was first written in, if it has one
  const originalText =
    proposal.originalLanguage === null ? undefined : proposal.texts[proposal.originalLanguage]

  // Argued in the original where it is solved there, and in no language otherwise
  return originalText !== undefined && hasSolution(originalText) ? originalText : null
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
 * The average score the reviewers gave one aspect of a proposal, counting only those who scored it.
 *
 * @param ratings - The proposal's ratings.
 * @param aspect - The aspect.
 *
 * @returns The average, or null while nobody has scored the aspect.
 */
export function averageScore(
  ratings: readonly ProposalRating[],
  aspect: RatingAspect
): number | null {
  // The scores given to the aspect, the reviewers who gave none left out
  const scores = ratings.flatMap((rating) => {
    // The score this reviewer gave the aspect, if any
    const score = rating[aspect]

    // Kept where there is one
    return score === null ? [] : [score]
  })

  // None without a score
  if (scores.length === 0) return null

  // The scores summed in whole tenths, so two equal averages come out the same number
  const tenths = scores.reduce((sum, score) => sum + Math.round(score * STEPS_PER_POINT), 0)

  // Their average, back in whole scores
  return tenths / (scores.length * STEPS_PER_POINT)
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
 * What keeps a board's papers from pairing up with a cycle's rounds, one paper to each round of its category's
 * level, each paper as long as the rounds are.
 */
export type CycleMisfit = {
  /** Papers no round of the cycle is left for: no level, one the cycle lacks, or one an earlier paper took. */
  unmatched: Paper[]
  /** Papers whose slot count differs from the problem count the cycle's rounds take. */
  wrongSize: Paper[]
  /** The levels of the cycle's rounds no paper fills. */
  uncovered: HostedCompetitionCategory[]
}

/**
 * What keeps a board's papers from pairing up with one cycle's rounds, whatever their slots hold.
 *
 * @param board - The board.
 * @param cycle - The cycle.
 * @param categories - The selection's categories, which say the level of each paper's category.
 *
 * @returns The misfits, every list empty once the papers fit the rounds.
 */
export function cycleMisfit(
  board: Board,
  cycle: Cycle,
  categories: readonly SelectionCategory[]
): CycleMisfit {
  // The level of each paper's category, in the board's order
  const levels = board.papers.map((paper) => hostedLevelOf(paper.category, categories))

  // The papers left without a round, a round going to the first paper of its level and no other
  const unmatched = board.papers.filter((_paper, index) => {
    // The paper's level
    const level = levels[index]

    // No level, one the cycle runs no round in, or one an earlier paper took
    return level === null || !cycle.categories.includes(level) || levels.indexOf(level) !== index
  })

  // The papers of the wrong length, every round of the cycle taking the same number of problems
  const wrongSize = board.papers.filter((paper) => paper.slots.length !== cycle.problemCount)

  // The levels of the rounds no paper stands for
  const uncovered = cycle.categories.filter((level) => !levels.includes(level))

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
