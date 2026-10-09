import type {
  Board,
  Paper,
  SlotAddress,
  SlotDirection,
} from '@/components/features/problem-selection/model/selection-types'

import {
  draftBoard,
  GUID,
  type HeldSelection,
  isGuid,
  liveProposal,
  readFields,
  refuseWith,
} from './selection-writes'

/** How far a move takes a slot: up is the slot before it, down the slot after. */
const MOVE_OFFSET: Record<SlotDirection, number> = { up: -1, down: 1 }

/**
 * The path of a slot write: the board, the paper and the slot's index, and a trailing move for a trade with a
 * neighbour.
 */
export const SLOT_WRITE_PATH = new RegExp(
  `^/problem-selection/boards/(${GUID})/papers/(${GUID})/slots/(-?\\d+)(/move)?$`
)

/**
 * Where a slot sits on its board.
 */
type BoardPosition = Pick<SlotAddress, 'paperId' | 'index'>

/**
 * A slot a write may change, with the board and the paper holding it.
 */
type DraftSlot = {
  /** The board, a draft. */
  board: Board
  /** The paper, one of the board's own. */
  paper: Paper
}

/**
 * The board and the paper a slot names, refused the way the backend refuses them before any write.
 *
 * @param held - What the backend holds.
 * @param slot - The slot.
 *
 * @returns The slot's board and paper.
 */
function draftSlot(held: HeldSelection, slot: SlotAddress): DraftSlot {
  // The board, which has to be a draft
  const board = draftBoard(held, slot.boardId)

  // The paper, one of this board's own
  const paper =
    board.papers.find((candidate) => candidate.id === slot.paperId) ??
    refuseWith('SelectionTargetNotFound')

  // A slot past either end of the paper names nothing
  if (slot.index < 0 || slot.index >= paper.slots.length) refuseWith('SelectionTargetNotFound')

  // The board and the paper holding the slot
  return { board, paper }
}

/**
 * What a board holds at a position.
 *
 * @param board - The board.
 * @param position - The position.
 *
 * @returns The problem's id, or null for an empty slot.
 */
function heldAt(board: Board, position: BoardPosition): string | null {
  // The slot of that paper at that index
  return board.papers.find((paper) => paper.id === position.paperId)?.slots[position.index] ?? null
}

/**
 * Where a problem stands on a board.
 *
 * @param board - The board.
 * @param proposalId - The problem.
 *
 * @returns Its position; undefined when the board does not hold it.
 */
function positionOn(board: Board, proposalId: string): BoardPosition | undefined {
  // The one slot holding the problem, a board never holding one twice
  return board.papers
    .flatMap((paper) => paper.slots.map((held, index) => ({ paperId: paper.id, index, held })))
    .find((position) => position.held === proposalId)
}

/**
 * Some of a board's slots set to new contents, every other one left as it was.
 *
 * @param board - The board.
 * @param changes - Each position changed, with what it holds afterwards.
 *
 * @returns The board after the change.
 */
function withSlots(board: Board, changes: [BoardPosition, string | null][]): Board {
  // Every paper with the slots named in the changes replaced
  return {
    ...board,
    papers: board.papers.map((paper) => ({
      ...paper,
      slots: paper.slots.map((current, index) => {
        // The change naming this slot, if any
        const change = changes.find(
          ([position]) => position.paperId === paper.id && position.index === index
        )

        // What the change puts there, or what was there
        return change === undefined ? current : change[1]
      }),
    })),
  }
}

/**
 * What the backend holds with one board replaced.
 *
 * @param held - What the backend holds.
 * @param board - The board as it stands afterwards.
 *
 * @returns What the backend holds then.
 */
function withBoard(held: HeldSelection, board: Board): HeldSelection {
  // Every other board as it was
  return {
    ...held,
    boards: held.boards.map((candidate) => (candidate.id === board.id ? board : candidate)),
  }
}

/**
 * Reads which proposal a placement names, refusing a body that names none, as the backend does.
 *
 * @param body - The body as it went out; null when there was none.
 *
 * @returns The proposal's id.
 */
function readPlacement(body: string | null): string {
  // The proposal named, which has to be an id
  const { proposalId } = readFields(body)

  // Missing, null, or not an id, none of which names a proposal
  if (!isGuid(proposalId)) refuseWith('MalformedRequest')

  // The proposal's id
  return proposalId
}

/**
 * Reads which way a move goes by its name, in any letter case, refusing a body that names neither. The backend
 * also takes the direction's number, which the page never sends.
 *
 * @param body - The body as it went out; null when there was none.
 *
 * @returns The direction.
 */
function readDirection(body: string | null): SlotDirection {
  // The direction named
  const { direction } = readFields(body)

  // Its name in lower case, where it is a name at all
  const name = typeof direction === 'string' ? direction.toLowerCase() : null

  // Anything but a direction's name
  if (name !== 'up' && name !== 'down') refuseWith('MalformedRequest')

  // The direction
  return name
}

/**
 * Puts a proposal into a draft's slot, as the backend does. One already on the board trades places with whatever
 * held the slot, and one from the pool sends that problem back to it.
 *
 * @param held - What the backend holds.
 * @param slot - The slot.
 * @param proposalId - The proposal.
 *
 * @returns What the backend holds afterwards.
 */
function place(held: HeldSelection, slot: SlotAddress, proposalId: string): HeldSelection {
  // The board and the paper, refused where the backend refuses them
  const { board } = draftSlot(held, slot)

  // The proposal, which has to be live
  const proposal = liveProposal(held, proposalId)

  // A draft takes only what is still in the pool
  if (proposal.isUsed) refuseWith('SelectionProposalUsed')

  // What the slot holds now
  const occupant = heldAt(board, slot)

  // Already there, so nothing moves
  if (occupant === proposalId) return held

  // Where on the board the proposal already stands, if anywhere
  const source = positionOn(board, proposalId)

  // One of the board's own problems trades places with the slot's, which empties its old place where the slot
  // stood empty
  if (source !== undefined) {
    return withBoard(
      held,
      withSlots(board, [
        [slot, proposalId],
        [source, occupant],
      ])
    )
  }

  // The slot takes the problem from the pool, its old one going back there
  return withBoard(held, withSlots(board, [[slot, proposalId]]))
}

/**
 * Empties a draft's slot, as the backend does.
 *
 * @param held - What the backend holds.
 * @param slot - The slot.
 *
 * @returns What the backend holds afterwards.
 */
function clear(held: HeldSelection, slot: SlotAddress): HeldSelection {
  // The board and the paper, refused where the backend refuses them
  const { board } = draftSlot(held, slot)

  // The slot standing empty, whatever it held
  return withBoard(held, withSlots(board, [[slot, null]]))
}

/**
 * Trades a draft's slot with its neighbour in the same paper, as the backend does.
 *
 * @param held - What the backend holds.
 * @param slot - The slot.
 * @param direction - Which neighbour.
 *
 * @returns What the backend holds afterwards.
 */
function move(held: HeldSelection, slot: SlotAddress, direction: SlotDirection): HeldSelection {
  // The board and the paper, refused where the backend refuses them
  const { board, paper } = draftSlot(held, slot)

  // The neighbour's position
  const neighbour: BoardPosition = { paperId: paper.id, index: slot.index + MOVE_OFFSET[direction] }

  // Which has to be a slot of the same paper
  if (neighbour.index < 0 || neighbour.index >= paper.slots.length) {
    refuseWith('SelectionTargetNotFound')
  }

  // The two slots trading what they hold, empty ones included
  return withBoard(
    held,
    withSlots(board, [
      [slot, heldAt(board, neighbour)],
      [neighbour, heldAt(board, slot)],
    ])
  )
}

/**
 * One write to a slot, as the backend routes it: a placement or an emptying at the slot's own address, a trade
 * at its move address. The body is read before anything else, so a body the backend cannot read is refused first.
 *
 * @param held - What the backend holds.
 * @param method - The write's HTTP method.
 * @param isMove - Whether it went to the slot's move address.
 * @param slot - The slot.
 * @param body - The body as it went out; null when there was none.
 *
 * @returns What the backend holds afterwards.
 */
export function slotWrite(
  held: HeldSelection,
  method: string,
  isMove: boolean,
  slot: SlotAddress,
  body: string | null
): HeldSelection {
  // A trade, posted to the move address
  if (isMove && method === 'POST') return move(held, slot, readDirection(body))

  // A placement, put at the slot's own address
  if (!isMove && method === 'PUT') return place(held, slot, readPlacement(body))

  // An emptying, deleted at the slot's own address
  if (!isMove && method === 'DELETE') return clear(held, slot)

  // Nothing the app sends, so a fake that reaches here has drifted from the app
  throw new Error(`The backend routes no slot write as ${method}${isMove ? ' to a move' : ''}`)
}
