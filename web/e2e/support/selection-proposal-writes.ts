import type { HostedCompetitionCategory } from '@/components/features/hosted-competitions/model/hosted-competition-types'
import type { Proposal } from '@/components/features/problem-selection/model/selection-types'

import {
  emptiedOnDrafts,
  GUID,
  type HeldSelection,
  liveProposal,
  readFields,
  refuseWith,
} from './selection-writes'

/**
 * The path of a proposal write: the proposal, and a trailing set-aside or recommended naming the change.
 */
export const PROPOSAL_WRITE_PATH = new RegExp(
  `^/problem-selection/proposals/(${GUID})(/set-aside|/recommended)?$`
)

/**
 * Every category, in the order the backend's enum declares them, which a proposal's recommendations keep. Written
 * out rather than imported, so the fake keeps the backend's order whatever the app's own list does.
 */
const CATEGORIES: HostedCompetitionCategory[] = ['elementary', 'intermediate', 'advanced']

/**
 * A proposal's recommendation for one category, as a write switches it.
 */
type Recommendation = {
  /** The category. */
  category: HostedCompetitionCategory
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
 * Reads which category a recommendation switches and which way, the category by its name in any letter case,
 * refusing a body missing either, as the backend does. The backend also takes the category's number, which the
 * page never sends.
 *
 * @param body - The body as it went out; null when there was none.
 *
 * @returns The category and which way it goes.
 */
function readRecommendation(body: string | null): Recommendation {
  // The category and the flag sent
  const { category, isRecommended } = readFields(body)

  // The category named, in lower case, where it is a name at all
  const named = CATEGORIES.find(
    (candidate) => typeof category === 'string' && candidate === category.toLowerCase()
  )

  // No category's name, or a flag that says neither way
  if (named === undefined || typeof isRecommended !== 'boolean') refuseWith('MalformedRequest')

  // The switch
  return { category: named, isRecommended }
}

/**
 * Sets a proposal aside or brings it back, as the backend does, a proposal a round has taken included.
 *
 * @param held - What the backend holds.
 * @param proposalId - The proposal.
 * @param isSetAside - Whether it is set aside afterwards.
 *
 * @returns What the backend holds afterwards.
 */
function setAside(held: HeldSelection, proposalId: string, isSetAside: boolean): HeldSelection {
  // The proposal, as it stands
  const proposal = liveProposal(held, proposalId)

  // Set aside or back, as asked
  return withProposal(held, { ...proposal, isSetAside })
}

/**
 * Recommends a proposal for one category or takes it back, as the backend does, leaving the others as they stand.
 *
 * @param held - What the backend holds.
 * @param proposalId - The proposal.
 * @param recommendation - The category and which way it goes.
 *
 * @returns What the backend holds afterwards.
 */
function recommend(
  held: HeldSelection,
  proposalId: string,
  { category, isRecommended }: Recommendation
): HeldSelection {
  // The proposal, as it stands
  const proposal = liveProposal(held, proposalId)

  // Every category recommended after the switch, in the order the categories run
  const recommended = CATEGORIES.filter((candidate) =>
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
 *
 * @returns What the backend holds afterwards.
 */
function remove(held: HeldSelection, proposalId: string): HeldSelection {
  // The proposal, as it stands
  const proposal = liveProposal(held, proposalId)

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
 * One write to a proposal, as the backend routes it: a delete at the proposal's own address, a set-aside and a
 * recommendation each at its own. A body is read before anything else, so a body the backend cannot read is
 * refused first.
 *
 * @param held - What the backend holds.
 * @param method - The write's HTTP method.
 * @param change - The trailing part of the address naming the change; undefined at the proposal's own.
 * @param proposalId - The proposal.
 * @param body - The body as it went out; null when there was none.
 *
 * @returns What the backend holds afterwards.
 */
export function proposalWrite(
  held: HeldSelection,
  method: string,
  change: string | undefined,
  proposalId: string,
  body: string | null
): HeldSelection {
  // A set-aside, put at its address
  if (change === '/set-aside' && method === 'PUT') {
    return setAside(held, proposalId, readSetAside(body))
  }

  // A recommendation, put at its address
  if (change === '/recommended' && method === 'PUT') {
    return recommend(held, proposalId, readRecommendation(body))
  }

  // A delete, at the proposal's own address
  if (change === undefined && method === 'DELETE') return remove(held, proposalId)

  // Nothing the app sends, so a fake that reaches here has drifted from the app
  throw new Error(`The backend routes no proposal write as ${method} ${change ?? ''}`)
}
