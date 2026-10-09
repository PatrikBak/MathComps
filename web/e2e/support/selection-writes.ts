import type {
  Board,
  Cycle,
  Proposal,
} from '@/components/features/problem-selection/model/selection-types'
import type { AppErrorCode } from '@/lib/api/api-error-codes'

/**
 * Every refusal the fake's selection writes give, past the sign-in, the grant and the rate limit, each against the
 * status the backend answers it with.
 */
export const SELECTION_WRITE_REFUSALS = {
  MalformedRequest: 400,
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
 * A hosted group the backend holds, which a board can be finalized into while it has not opened and its rounds are
 * still empty.
 */
export type HeldCycle = Cycle & {
  /** Whether its rounds already hold problems, a board having filled them or an import. */
  isFilled: boolean
}

/**
 * Everything the backend holds about the boards, their problems and the cycles they go into, which the read answers
 * out of and every write changes.
 */
export type HeldSelection = {
  /** Every live proposal, the ones in the rounds of an opened board included. */
  proposals: Proposal[]
  /** Every board, oldest first, the opened ones included. */
  boards: Board[]
  /** Every hosted group, the filled and the opened ones included, the ones yet to open soonest first. */
  cycles: HeldCycle[]
}

/**
 * Whether a board's rounds have opened, which the read leaves out and every write refuses.
 *
 * @param board - The board.
 *
 * @returns True for a finalized board whose rounds' opening has passed.
 */
export function hasOpened(board: Board): boolean {
  // Finalized, into rounds already open
  return board.finalization !== null && Date.parse(board.finalization.opensAt) <= Date.now()
}

/**
 * Whether a cycle still takes a board, as the backend weighs it: not yet open, with its rounds still empty. Every
 * cycle the fake holds closes at some point, which the backend asks too.
 *
 * @param cycle - The cycle.
 *
 * @returns True while a board can go into it.
 */
export function takesBoard(cycle: HeldCycle): boolean {
  // Not yet open, and nothing in its rounds
  return Date.parse(cycle.opensAt) > Date.now() && !cycle.isFilled
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

/** The shape of an id the backend's routes take, any other answering as a path it does not serve. */
export const GUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

/**
 * Whether a value read off a request body is an id the backend can bind.
 *
 * @param value - The value.
 *
 * @returns True for a string shaped like an id.
 */
export function isGuid(value: unknown): value is string {
  // A string, and nothing but an id
  return typeof value === 'string' && new RegExp(`^${GUID}$`).test(value)
}

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

  // Its rounds, once open, being what students sit
  if (hasOpened(board)) refuseWith('SelectionBoardOpened')

  // And a draft, a finalized board's slots being its rounds, which take no change
  if (board.finalization !== null) refuseWith('SelectionBoardFinalized')

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
    board.finalization !== null
      ? board
      : {
          ...board,
          papers: board.papers.map((paper) => ({
            ...paper,
            slots: paper.slots.map((slot) =>
              slot !== null && problemIds.includes(slot) ? null : slot
            ),
          })),
        }
  )
}
