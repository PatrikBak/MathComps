import { isDraft } from '@/components/features/problem-selection/model/selection-state'
import type {
  Board,
  BoardStage,
  Proposal,
  SelectionCategory,
} from '@/components/features/problem-selection/model/selection-types'
import type { AppErrorCode } from '@/lib/api/api-error-codes'

/**
 * The selection's categories, in the order they run: the ones the backend seeds for MathComps, each named after the
 * hosted level it is, then a C no hosted round runs, like the olympiad's. Written out, so the fake keeps those rows
 * whatever order the app lists its levels in.
 */
export const SELECTION_CATEGORIES: SelectionCategory[] = [
  { name: 'elementary', hostedCategory: 'elementary' },
  { name: 'intermediate', hostedCategory: 'intermediate' },
  { name: 'advanced', hostedCategory: 'advanced' },
  { name: 'C', hostedCategory: null },
]

/**
 * Every refusal the fake's selection writes give, past the sign-in, the membership and the rate limit, each against
 * the status the backend answers it with.
 */
export const SELECTION_WRITE_REFUSALS = {
  MalformedRequest: 400,
  ProposalRatingValue: 400,
  SelectionNotLead: 403,
  ProposalNotLead: 403,
  SelectionTargetNotFound: 404,
  SelectionBoardOpened: 409,
  SelectionBoardFinalized: 409,
  SelectionProposalUsed: 409,
  SelectionFinalizeBlocked: 422,
  SelectionProblemIncomplete: 422,
} as const satisfies Partial<Record<AppErrorCode, number>>

/** The code a refused selection write carries. */
type SelectionWriteRefusal = keyof typeof SELECTION_WRITE_REFUSALS

/**
 * Thrown when the backend refuses a selection write, carrying the code it refuses it with.
 */
export class SelectionWriteRefused extends Error {
  /**
   * @param code - Why the write was refused.
   */
  constructor(readonly code: SelectionWriteRefusal) {
    // The code doubles as the message, which only a failing test's output shows
    super(code)
  }
}

/**
 * Everything the backend holds about the boards and their problems, which the read answers out of and every write
 * changes. Each board holds where it stands against its cycle, as the backend reads it.
 */
export type HeldSelection = {
  /** Every live proposal, the ones in the rounds of an opened board included. */
  proposals: Proposal[]
  /** Every board, oldest first, the opened ones included. */
  boards: Board[]
}

/**
 * The refusal a write on a board meets at each stage: none for a draft, and one for each way of being finalized,
 * since a finalized board's slots are its cycle's rounds.
 */
const WRITE_REFUSAL_AT_STAGE = {
  finalizable: null,
  unfinalizable: null,
  finalized: 'SelectionBoardFinalized',
  opened: 'SelectionBoardOpened',
} as const satisfies Record<BoardStage, SelectionWriteRefusal | null>

/**
 * The refusal a write on a board meets, by where the board stands against its cycle.
 *
 * @param board - The board.
 *
 * @returns The refusal; null for a draft, which takes the write.
 */
function writeRefusalOf(board: Board): SelectionWriteRefusal | null {
  // A board picking for no cycle stays a draft
  if (board.cycle === null) return null

  // Otherwise by its stage
  return WRITE_REFUSAL_AT_STAGE[board.cycle.stage]
}

/**
 * A live proposal, the ones in the rounds of an opened board included, refused the way the backend refuses one it
 * does not hold.
 *
 * @param held - What the backend holds.
 * @param proposalId - The proposal.
 *
 * @returns The proposal.
 */
export function liveProposal(held: HeldSelection, proposalId: string): Proposal {
  // The proposal, which has to be live, a deleted one answering as one never held
  return (
    held.proposals.find((candidate) => candidate.id === proposalId) ??
    refuseWith('SelectionTargetNotFound')
  )
}

/** The slug of the organization preparing the competitions the site hosts, whose selection the specs open. */
export const MATHCOMPS_ORGANIZATION_SLUG = 'mathcomps'

/** The path MathComps' selection hangs off on the backend, which every read and write of it goes under. */
export const SELECTION_API_PATH = `/problem-selection/${MATHCOMPS_ORGANIZATION_SLUG}`

/**
 * Refuses the write.
 *
 * @param code - Why.
 */
export function refuseWith(code: SelectionWriteRefusal): never {
  // Answered by the route with the code's status
  throw new SelectionWriteRefused(code)
}

/**
 * Reads the request body of a JSON write, refusing what the backend cannot read.
 *
 * @param body - The body as it went out; null when there was none.
 *
 * @returns The body's fields, by name.
 */
export function readFields(body: string | null): Record<string, unknown> {
  // A write with nothing to read
  if (body === null) refuseWith('MalformedRequest')

  // The body, parsed
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    // Anything but JSON
    refuseWith('MalformedRequest')
  }

  // Anything but an object has no fields to bind
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    refuseWith('MalformedRequest')
  }

  // The fields
  return parsed as Record<string, unknown>
}

/**
 * A board a write may change, refused the way the backend refuses it before any write.
 *
 * @param held - What the backend holds.
 * @param boardId - The board.
 *
 * @returns The board, a draft.
 */
export function draftBoard(held: HeldSelection, boardId: string): Board {
  // The board, which has to exist
  const board =
    held.boards.find((candidate) => candidate.id === boardId) ??
    refuseWith('SelectionTargetNotFound')

  // The refusal a write on it meets, if any
  const refusal = writeRefusalOf(board)

  // Refused unless a draft
  if (refusal !== null) refuseWith(refusal)

  // The draft
  return board
}

/**
 * Every board with some problems taken off each draft, as the backend does when they leave the pool or the
 * selection. A finalized board keeps them, its slots being its rounds.
 *
 * @param boards - Every board.
 * @param problemIds - The problems.
 *
 * @returns The boards, each draft's slots holding one of the problems emptied.
 */
export function emptiedOnDrafts(boards: Board[], problemIds: string[]): Board[] {
  // Each draft with the problems' slots emptied, each finalized board as it was
  return boards.map((board) =>
    isDraft(board)
      ? {
          ...board,
          papers: board.papers.map((paper) => ({
            ...paper,
            slots: paper.slots.map((slot) =>
              slot !== null && problemIds.includes(slot) ? null : slot
            ),
          })),
        }
      : board
  )
}
