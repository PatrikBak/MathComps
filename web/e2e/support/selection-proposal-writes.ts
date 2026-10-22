import {
  type Proposal,
  RATING_ASPECTS,
  type RatingAspect,
  type RatingScores,
} from '@/components/features/problem-selection/model/selection-types'
import type { UserIdentity } from '@/components/features/profile/model/user-identity'

import { READER_NAME } from './comments'
import {
  emptiedOnDrafts,
  GUID,
  type HeldSelection,
  liveProposal,
  readFields,
  refuseWith,
  SELECTION_API_PATH,
  SELECTION_CATEGORIES,
} from './selection-writes'

/**
 * The path of a proposal write: the proposal, and a trailing set-aside, recommended or rating naming the change.
 */
export const PROPOSAL_WRITE_PATH = new RegExp(
  `^${SELECTION_API_PATH}/proposals/(${GUID})(/set-aside|/recommended|/rating)?$`
)

/** The reader, as the backend names the reviewer reading the selection. */
export const READER: UserIdentity = { id: 'selection-reader', username: READER_NAME, email: null }

/**
 * The shape of a number as written, in a number or a string, that the backend reads as a score: a sign, digits with a
 * point anywhere among them, and an exponent, but no spaces or digit grouping.
 */
const DECIMAL_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/

/** The largest size of number the backend binds, which it holds as a decimal. */
const LARGEST_BINDABLE_SIZE = 79228162514264337593543950335

/** The lowest score the backend's rating scale holds. */
const MIN_SCORE = 1

/** The highest score the backend's rating scale holds. */
const MAX_SCORE = 5

/** How many steps of the backend's rating scale make up one whole score. */
const STEPS_PER_POINT = 10

/**
 * Every score the backend's rating scale holds, lowest first. Built here rather than imported, so the fake refuses
 * what the backend refuses whatever the app's own scale offers.
 */
const SCORES: number[] = Array.from(
  { length: (MAX_SCORE - MIN_SCORE) * STEPS_PER_POINT + 1 },
  (_slot, step) => (MIN_SCORE * STEPS_PER_POINT + step) / STEPS_PER_POINT
)

/**
 * A proposal's recommendation for one category, as a write switches it.
 */
type Recommendation = {
  /** The category, by name. */
  category: string
  /** Whether the proposal is recommended for it afterwards. */
  isRecommended: boolean
}

/**
 * What the backend holds with one proposal replaced.
 *
 * @param held - What the backend holds.
 * @param proposal - The proposal as it stands afterwards.
 *
 * @returns What the backend holds then.
 */
function withProposal(held: HeldSelection, proposal: Proposal): HeldSelection {
  // Every other proposal as it was
  return {
    ...held,
    proposals: held.proposals.map((candidate) =>
      candidate.id === proposal.id ? proposal : candidate
    ),
  }
}

/**
 * Reads whether a set-aside write sets the proposal aside, refusing a body that says neither, as the backend does.
 *
 * @param body - The body as it went out; null when there was none.
 *
 * @returns True to set it aside, false to bring it back.
 */
function readSetAside(body: string | null): boolean {
  // The flag sent
  const { isSetAside } = readFields(body)

  // Missing, null, or not a flag, none of which says which way
  if (typeof isSetAside !== 'boolean') refuseWith('MalformedRequest')

  // Which way
  return isSetAside
}

/**
 * Reads which category a recommendation switches and which way, the category by its name, refusing a body missing
 * either, as the backend does.
 *
 * @param body - The body as it went out; null when there was none.
 *
 * @returns The category and which way it goes.
 */
function readRecommendation(body: string | null): Recommendation {
  // The category and the flag sent
  const { category, isRecommended } = readFields(body)

  // No name, or a flag that says neither way
  if (typeof category !== 'string' || typeof isRecommended !== 'boolean') {
    refuseWith('MalformedRequest')
  }

  // The switch
  return { category, isRecommended }
}

/**
 * Reads the number a rating gives one aspect as the backend binds it: a number written plainly, in a number or a
 * string, that fits in a decimal. Anything else is refused as a malformed body.
 *
 * @param fields - The body's fields.
 * @param aspect - The aspect.
 *
 * @returns The number, or null where the body gives none.
 */
function readNumber(fields: Record<string, unknown>, aspect: RatingAspect): number | null {
  // The score sent, null where none was
  const sent = fields[aspect] ?? null

  // None given
  if (sent === null) return null

  // The score as text: a number written out, anything else as sent
  const text = typeof sent === 'number' ? String(sent) : sent

  // Anything but a number written plainly, which the backend cannot bind
  if (typeof text !== 'string' || !DECIMAL_NUMBER.test(text)) refuseWith('MalformedRequest')

  // The number written
  const number = Number(text)

  // A number past a decimal's size, which the backend cannot bind
  if (Math.abs(number) > LARGEST_BINDABLE_SIZE) refuseWith('MalformedRequest')

  // The number
  return number
}

/**
 * Reads a number a rating gives as a score on the rating scale, refusing one off the scale as no rating holds.
 *
 * @param number - The number; null where none was given.
 *
 * @returns The score, or null where none was given.
 */
function scoreOnScale(number: number | null): number | null {
  // None given
  if (number === null) return null

  // The number's score on the scale
  const score = SCORES.find((candidate) => candidate === number)

  // A number off the scale
  if (score === undefined) refuseWith('ProposalRatingValue')

  // The score
  return score
}

/**
 * Reads the scores a rating gives, a score left out or null being one not given.
 *
 * @param body - The body as it went out; null when there was none.
 *
 * @returns The score for each aspect, null for one not given.
 */
function readScores(body: string | null): RatingScores {
  // A write with nothing to read
  if (body === null) refuseWith('MalformedRequest')

  // The fields sent
  const fields = readFields(body)

  // Each aspect's number, both bound before either meets the scale, as the backend binds the whole body first
  const beauty = readNumber(fields, 'beauty')
  const difficulty = readNumber(fields, 'difficulty')

  // Each aspect's score
  return { beauty: scoreOnScale(beauty), difficulty: scoreOnScale(difficulty) }
}

/**
 * Rates a proposal as the reader, or takes the reader's rating back when it scores nothing, as the backend does.
 * Every other reviewer's rating stays as it was, and the ratings run in the order of the reviewers' names, a nameless
 * one last.
 *
 * @param held - What the backend holds.
 * @param proposalId - The proposal.
 * @param scores - The reader's score for each aspect afterwards.
 *
 * @returns What the backend holds afterwards.
 */
function rate(held: HeldSelection, proposalId: string, scores: RatingScores): HeldSelection {
  // The proposal, as it stands
  const proposal = liveProposal(held, proposalId)

  // Every other reviewer's rating
  const others = proposal.ratings.filter((rating) => !rating.isOwn)

  // The reader's, where it scores anything
  const own = RATING_ASPECTS.some((aspect) => scores[aspect] !== null)
    ? [{ rater: READER, isOwn: true, ...scores }]
    : []

  // The proposal with its ratings, by the reviewers' names, the nameless last
  return withProposal(held, {
    ...proposal,
    ratings: [...others, ...own].sort(
      (first, second) =>
        Number(first.rater.username === null) - Number(second.rater.username === null) ||
        (first.rater.username ?? '').localeCompare(second.rater.username ?? '')
    ),
  })
}

/**
 * Sets a proposal aside or brings it back, as the backend does, a proposal a round has taken included.
 *
 * @param held - What the backend holds.
 * @param proposalId - The proposal.
 * @param isSetAside - Whether it is set aside afterwards.
 * @param leadCategories - The names of the categories the writer leads.
 *
 * @returns What the backend holds afterwards.
 */
function setAside(
  held: HeldSelection,
  proposalId: string,
  isSetAside: boolean,
  leadCategories: readonly string[]
): HeldSelection {
  // The proposal, as it stands
  const proposal = liveProposal(held, proposalId)

  // Only a lead of some category sets the proposal aside or brings it back
  if (leadCategories.length === 0) refuseWith('ProposalNotLead')

  // Set aside or back, as asked
  return withProposal(held, { ...proposal, isSetAside })
}

/**
 * Recommends a proposal for one category or takes it back, as the backend does, leaving the others as they stand. A
 * name the organization doesn't list is refused like a proposal the backend doesn't hold.
 *
 * @param held - What the backend holds.
 * @param proposalId - The proposal.
 * @param recommendation - The category and which way it goes.
 * @param leadCategories - The names of the categories the writer leads.
 *
 * @returns What the backend holds afterwards.
 */
function recommend(
  held: HeldSelection,
  proposalId: string,
  { category, isRecommended }: Recommendation,
  leadCategories: readonly string[]
): HeldSelection {
  // The proposal, as it stands
  const proposal = liveProposal(held, proposalId)

  // Only a lead of some category switches the proposal's categories
  if (leadCategories.length === 0) refuseWith('ProposalNotLead')

  // Every category the organization lists by name, in the order they run
  const names = SELECTION_CATEGORIES.map((candidate) => candidate.name)

  // A name the organization doesn't list, refused like a missing proposal
  if (!names.includes(category)) refuseWith('SelectionTargetNotFound')

  // Every category recommended after the switch, in the order the categories run
  const recommended = names.filter((candidate) =>
    candidate === category ? isRecommended : proposal.recommended.includes(candidate)
  )

  // The proposal with them
  return withProposal(held, { ...proposal, recommended })
}

/**
 * Deletes a proposal from the selection, as the backend does: it leaves every read and every draft's slot it
 * stood in, while one a round has taken stays.
 *
 * @param held - What the backend holds.
 * @param proposalId - The proposal.
 * @param leadCategories - The names of the categories the writer leads.
 *
 * @returns What the backend holds afterwards.
 */
function remove(
  held: HeldSelection,
  proposalId: string,
  leadCategories: readonly string[]
): HeldSelection {
  // The proposal, as it stands
  const proposal = liveProposal(held, proposalId)

  // Only a lead of some category deletes the proposal
  if (leadCategories.length === 0) refuseWith('ProposalNotLead')

  // A problem a paper has taken stays in its round
  if (proposal.isUsed) refuseWith('SelectionProposalUsed')

  // Gone from the proposals the backend reads, and off every draft
  return {
    ...held,
    proposals: held.proposals.filter((candidate) => candidate.id !== proposalId),
    boards: emptiedOnDrafts(held.boards, [proposalId]),
  }
}

/**
 * One write to a proposal, as the backend routes it: a delete at the proposal's own address, a set-aside, a
 * recommendation and a rating each at its own. A body is read before anything else, so a body the backend cannot
 * read is refused first.
 *
 * @param held - What the backend holds.
 * @param leadCategories - The names of the categories the writer leads.
 * @param method - The write's HTTP method.
 * @param change - The trailing part of the address naming the change; undefined at the proposal's own.
 * @param proposalId - The proposal.
 * @param body - The body as it went out; null when there was none.
 *
 * @returns What the backend holds afterwards.
 */
export function proposalWrite(
  held: HeldSelection,
  leadCategories: readonly string[],
  method: string,
  change: string | undefined,
  proposalId: string,
  body: string | null
): HeldSelection {
  // A set-aside, put at its address
  if (change === '/set-aside' && method === 'PUT') {
    return setAside(held, proposalId, readSetAside(body), leadCategories)
  }

  // A recommendation, put at its address
  if (change === '/recommended' && method === 'PUT') {
    return recommend(held, proposalId, readRecommendation(body), leadCategories)
  }

  // A rating, put at its address
  if (change === '/rating' && method === 'PUT') return rate(held, proposalId, readScores(body))

  // A delete, at the proposal's own address
  if (change === undefined && method === 'DELETE') return remove(held, proposalId, leadCategories)

  // Nothing the app sends, so a fake that reaches here has drifted from the app
  throw new Error(`The backend routes no proposal write as ${method} ${change ?? ''}`)
}
